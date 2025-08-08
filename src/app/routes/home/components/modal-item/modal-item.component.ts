import { Component, computed, DestroyRef, effect, ElementRef, inject, model, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { environment } from '@environment';
import { ItemModel, status } from '@home/models';
import { KeyService } from '@home/services';
import { NgbActiveModal, NgbTypeahead, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { ThemeDirective } from '@shared/directives';
import { debounceTime, distinctUntilChanged, filter, fromEvent, map, mergeWith, Observable } from 'rxjs';

interface ItemForm {
  readonly key: string;
  readonly code: string;
  readonly desc: string;
}

@Component({
  selector: 'app-modal-item',
  imports: [ReactiveFormsModule, NgbTypeaheadModule],
  templateUrl: './modal-item.component.html',
  styleUrl: './modal-item.component.scss',
  hostDirectives: [ThemeDirective],
})
export class ModalItemComponent {
  private readonly url = environment.httpUrl;
  private readonly location = environment.location;
  // private readonly itemService = inject(ItemService);
  private readonly keyService = inject(KeyService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly destroyRef = inject(DestroyRef);
  public readonly item = model.required<ItemModel>();
  public readonly itemRef = computed(() => this.item().raw);
  public size = 0;
  public readonly options: status[] = [0, 1, 2, 3, 4];
  public readonly itemForm: FormGroup<{ [K in keyof ItemForm]: FormControl<ItemForm[K]>; }> = new FormGroup({
    key: new FormControl('', {
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      nonNullable: true
    }),
    code: new FormControl('', {
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(4)],
      nonNullable: true
    }),
    desc: new FormControl('', { validators: Validators.required, nonNullable: true }),
  });
  private readonly _fillForm = effect(() => {
    const raw = this.itemRef();
    if (!raw) return;

    this.itemForm.patchValue(
      { key: raw.key, code: raw.code, desc: raw.desc },
      { emitEvent: false }
    );
  });

  public get keyForm(): FormControl<string> {
    return this.itemForm.get('key') as FormControl<string>;
  }

  public readonly eventKey = toSignal(
    this.keyForm.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
    )
  );
  private readonly keyInput = viewChild.required<ElementRef<HTMLInputElement>>('keyInput');
  private readonly keyDirective = viewChild.required<NgbTypeahead>('keyDirective');
  private readonly keyOptions = signal<string[]>([]);
  private readonly _loadKeyOptions = effect(() => {
    const code = this.eventKey()?.trim();
    if (!code) {
      this.keyOptions.set([]);
      return;
    }

    this.keyService.getKeys({ code })
      .pipe(map(r => r.data.map(d => d.code)))
      .subscribe(codes => this.keyOptions.set(codes));
  });

  public readonly statusForm = new FormControl('', { validators: Validators.required, nonNullable: true });
  public readonly reference = viewChild.required<HTMLDivElement>('reference');
  private createTypeaheadStream(
    { nativeElement: el }: ElementRef<HTMLInputElement>,
    dir: NgbTypeahead,
    text$: Observable<string>,
    callback: (v: string) => string[]
  ) {
    const focus$ = fromEvent(el, 'focus').pipe(map(() => el.value));
    const click$ = fromEvent(el, 'click').pipe(filter(() => !dir.isPopupOpen()), map(() => el.value));
    return text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      mergeWith(focus$, click$),
      map(callback),
      takeUntilDestroyed(this.destroyRef),
    );
  }
  public readonly searchKeys = (text$: Observable<string>) =>
    this.createTypeaheadStream(
      this.keyInput(),
      this.keyDirective(),
      text$,
      () => this.keyOptions().slice(0, 10)
    );

  public close(reason?: string): void {
    if (reason) {
      this.activeModal.dismiss(reason)
    } else {
      this.activeModal.close();
    }
  }

  public onSubmit(): void {

  }

  public onDelete(): void {

  }

  public onReset(): void {

  }

  public get hasImages(): boolean {
    return this.item().hasImages;
  }

  public get images(): number[] {
    return this.item().allIDN;
  }

  public src(index: number): string {
    const { key, code, images: itemImages } = this.item();
    const image = itemImages.at(index - 1)!;
    let query = 'mode=LOW&';
    if (this.location) query += `location=${encodeURIComponent(this.location)}&`;
    const imageId = encodeURIComponent(`${code} ${image.idN}`);
    return `${this.url}/image/${key}/${imageId}?${query}width=100`;
  }

  public notReseted(status: status): boolean {
    return !this.item().isReseted(status);
  }

  public selectClass(): string {
    return `value-${this.statusForm.value}`;
  }

  public statusChar(value: status): string {
    switch (value) {
      case 0: return "❌";
      case 1: return "✅";
      case 2: return "📸";
      case 3: return "🛠";
      case 4: return "✏️";
      case 5: return "💾";
      default: return "❓";
    }
  }
}
