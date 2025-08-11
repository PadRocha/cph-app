import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SpeechService } from '@core/services';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Fuzzy, Item, Search } from '@pdf/models';
import { ModalHelpComponent } from '@shared/components';
import { ScrollService } from '@shared/services';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import { LazyImgDirective } from './directives';
import { ItemService } from './services';
import { ModalExcelComponent, ModalPdfComponent } from './components';

type SearchControls = {
  [K in keyof Search]: FormControl<Search[K]>;
};
type Phase = 'results' | 'fuzzy' | 'empty';

@Component({
  selector: 'app-pdf',
  imports: [ReactiveFormsModule, LazyImgDirective],
  templateUrl: './pdf.component.html',
  styleUrl: './pdf.component.scss',
  host: { class: 'd-block container pb-3' },
  animations: [
    trigger('listAnim', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('100ms', [
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true }),
        query(':leave', [
          animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
        ], { optional: true })
      ])
    ])
  ]
})
export class PdfComponent implements OnDestroy  {
  private readonly itemService = inject(ItemService);
  private readonly speech = inject(SpeechService);
  private readonly modal = inject(NgbModal);
  private readonly scrollService = inject(ScrollService);

  /** Lista reactiva de items mostrados */
  public readonly docs = signal<Item[]>([]);
  /** Indicador de carga en curso */
  public readonly isLoading = signal(false);
  /** Total de documentos disponibles */
  public readonly totalDocs = signal(0);
  /** `true` cuando el backend reporta más páginas */
  public readonly hasNextPage = signal(false);
  /** Fase visual actual */
  public readonly phase = signal<Phase>('results');
  public readonly hasItems = computed(() => this.docs().length > 0);
  public readonly noData = computed(() => this.phase() === 'empty');

  /** Sugerencias difusas */
  public readonly hasFuzzy = signal(false);
  public fuzzyData: Fuzzy = { items: [], keys: [] };

  /** Formulario de búsqueda */
  public readonly searchForm = new FormGroup<SearchControls>({
    search: new FormControl('', {
      nonNullable: true,
    }),
    page: new FormControl(1, {
      validators: Validators.required,
      nonNullable: true,
    }),
    status: new FormControl(-1, {
      validators: Validators.required,
      nonNullable: true,
    }),
  });

  private get search() {
    return this.searchForm.get('search') as FormControl<string>;
  }
  private get status() {
    return this.searchForm.get('status') as FormControl<-1 | 5>;
  }

  /** Botón de filtro rápido (imagen/no imagen) */
  public get filter() {
    return this.status.value === 5;
  }
  public toggleStatus(): void {
    const next = this.status.value === 5 ? -1 : 5;
    this.docs.set([]);
    this.searchForm.patchValue({ status: next, page: 1 });
  }

  /** Cambios del formulario (debounced) */
  private readonly formChange = toSignal(
    this.searchForm.valueChanges.pipe(
      debounceTime(500),
      filter(() => this.search.disabled || this.search.valid),
      distinctUntilChanged(
        (a, b) => a?.search === b?.search &&
          a?.page === b?.page &&
          a?.status === b?.status
      ),
      map(() => this.searchForm.getRawValue()),
    ),
    { initialValue: { page: 1, search: '', status: -1 } },
  );

  private request(params: Search): void {
    this.isLoading.set(true);
    this.phase.set('results');
    this.itemService
      .getItems(params)
      .subscribe({
        next: ({ data, metadata }) => {
          const { hasNextPage, totalDocs, page } = metadata;
          this.docs.update((curr) => (page === 1 ? data : curr.concat(data)));
          this.totalDocs.set(totalDocs);
          this.hasNextPage.set(hasNextPage);
          if (totalDocs === 0) this.requestFuzzy(params);
          else this.phase.set('results');
        },
        error: () => {
          this.docs.set([]);
          this.totalDocs.set(0);
          this.hasNextPage.set(false);
          this.requestFuzzy(params);
        },
      })
      .add(() => this.isLoading.set(false));
  }

  private readonly _ = effect(() => {
    this.searchForm.patchValue({ page: 1 }, { emitEvent: false });
    const params = this.formChange();
    this.phase.set('results');
    this.request(params);
  });
  private readonly _load = effect(() => {
    if (!this.scrollService.isBottom()) return;
    if (this.isLoading() || !this.hasNextPage()) return;
    this.isLoading.set(true);
    const params = this.formChange();
    const nextPage = (params.page ?? 1) + 1;
    this.request({ ...params, page: nextPage });
  });

  private requestFuzzy(params: Search): void {
    const q = params.search.trim();
    if (q.length < 2) {
      this.hasFuzzy.set(false);
      this.fuzzyData = { items: [], keys: [] };
      this.phase.set('empty');
      return;
    }
    this.itemService.getFuzzy(params).subscribe({
      next: ({ data }) => {
        this.fuzzyData = data;
        const any =
          (data.items?.length ?? 0) > 0 || (data.keys?.length ?? 0) > 0;
        this.hasFuzzy.set(any);
        this.phase.set(any ? 'fuzzy' : 'empty');
      },
      error: () => {
        this.fuzzyData = { items: [], keys: [] };
        this.hasFuzzy.set(false);
        this.phase.set('empty');
      },
    });
  }

  public _transcript = effect(() => {
    const text = this.speech.transcript();
    if (text && this.listening) this.searchForm.patchValue({ search: text });
  });
  public get listening() {
    return this.speech.isListening();
  }
  public toggleRecorder() {
    this.speech.toggle();
    const input = this.searchForm.controls.search;
    this.listening ? input.disable() : input.enable();
  }

  public searchSuggestion(value: string): void {
    this.searchForm.patchValue({ search: value, page: 1 });
  }
  public async copySuggestion(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* no-op: permisos del navegador */
    }
  }

  public openHelp(): void {
    this.modal.open(ModalHelpComponent, {
      animation: true,
      centered: true,
      size: 'md',
      scrollable: true,
      ariaLabelledBy: 'helpTitle',
      ariaDescribedBy: 'helpBody',
      keyboard: false,
      backdropClass: 'blurred-backdrop',
    });
  }

  public opened = false;

  public toggle(): void {
    this.opened = !this.opened;
  }

  public onExcel(): void {
    const ref = this.modal.open(ModalExcelComponent, {
      animation: true,
      centered: true,
      size: 'xl',
      scrollable: true,
      keyboard: false,
      backdropClass: 'blurred-backdrop',
    });
    ref.componentInstance.params = signal<Search>(this.formChange());
    ref.result.finally(() => this.opened = false);
  }

  public onPdf(): void {
    const ref = this.modal.open(ModalPdfComponent, {
      animation: true,
      centered: true,
      size: 'xl',
      scrollable: true,
      keyboard: false,
      backdropClass: 'blurred-backdrop',
    });
    ref.componentInstance.params = signal<Search>(this.formChange());
    ref.result.finally(() => this.opened = false);
  }

  ngOnDestroy(): void {
    this.modal.dismissAll('component-destroyed');
  }
}
