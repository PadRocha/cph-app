import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { KeyService } from '@home/services';
import { NgbActiveOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { CapitalizePipe } from '@shared/pipes';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';

interface Search {
  page: number;
  code: string;
}
interface Key {
  code: string;
  desc: string;
}

/**
 * Regla de validación para el campo `code`
 *
 * Devuelve `null` cuando la cadena está vacía o coincide con el patrón
 * `[a-z0-9]{1,6}` (ignorando mayúsculas), de lo contrario retorna
 * `{ pattern:true }`
 *
 * @category validation
 * @param ctrl - Control reactivo a evaluar
 * @returns Resultado de validación o `null`
 * @example ts
 * const ok = validators(new FormControl("a1"))
 * const fail = validators(new FormControl("abc1234"))
 */
const validators: ValidatorFn = (ctrl: AbstractControl<string>): ValidationErrors | null => {
  const v = ctrl.value;
  if (v === '') return null;
  return /^[a-z0-9]{1,6}$/i.test(v) ? null : { pattern: true };
};

type SearchControls = {
  [K in keyof Search]: FormControl<Search[K]>;
};

@Component({
  selector: 'app-aside-keys',
  imports: [ReactiveFormsModule, CapitalizePipe],
  templateUrl: './aside-keys.component.html',
  styleUrl: './aside-keys.component.scss'
})
export class AsideKeysComponent {
  private readonly keyService = inject(KeyService);
  private readonly offcanvas = inject(NgbActiveOffcanvas);

  /** Umbral (0–1) que dispara la carga cuando el scroll supera el 90 % */
  private readonly toogleRatio = 0.9;
  /** Lista reactiva de claves mostradas */
  public readonly docs = signal<Key[]>([]);
  /** Indicador de carga en curso */
  public readonly isLoading = signal(false);
  /** Total de documentos disponibles */
  public readonly totalDocs = signal(0);
  /** `true` cuando el backend reporta más páginas */
  public readonly hasNextPage = signal(false);

  /** Formulario de búsqueda y paginación */
  public searchForm = new FormGroup<SearchControls>({
    page: new FormControl(1, {
      validators,
      nonNullable: true
    }),
    code: new FormControl('', {
      validators: Validators.pattern(/^[a-z0-9]{1,6}$/i),
      nonNullable: true
    }),
  });
  private get code() {
    return this.searchForm.get('code') as FormControl<string>;
  }
  /** Signal con cambios válidos del formulario */
  private readonly formChange = toSignal(
    this.searchForm.valueChanges.pipe(
      debounceTime(200),
      filter(() => this.code.valid),
      distinctUntilChanged((a, b) => a?.code === b?.code && a?.page === b?.page),
    ),
    { initialValue: { page: 1, code: '' } }
  );
  /** Signal con cambios válidos del formulario */
  private readonly _ = effect(() => {
    this.searchForm.patchValue({ page: 1 }, { emitEvent: false });
    const params = this.formChange();
    this.isLoading.set(true);
    this.keyService.getKeys(params).subscribe({
      next: ({ data, metadata: { hasNextPage, totalDocs } }) => {
        this.docs.update(curr => (params.page === 1 ? data : curr.concat(data)));
        this.totalDocs.set(totalDocs);
        this.hasNextPage.set(hasNextPage);
      },
      error: () => {
        this.docs.set([]);
        this.totalDocs.set(0);
        this.hasNextPage.set(false);
      },
    }).add(() => this.isLoading.set(false));
  });
  /** `true` cuando no hay resultados y no se está cargando */
  public readonly notFound = computed(() => this.docs().length === 0 && !this.isLoading());

  /**
   * Detecta scroll cercano al fondo y solicita más resultados
   *
   * @param evt - Evento de scroll del contenedor
   * @example ts
   * // se ejecuta internamente, no requiere invocación manual
   */
  @HostListener('scroll', ['$event'])
  onScroll(
    { target: { scrollHeight, clientHeight, scrollTop }, }: Event & { target: HTMLElement }
  ): void {
    const total = scrollHeight - clientHeight;
    const in_range = scrollTop / total > this.toogleRatio;
    if (in_range && !this.isLoading() && this.hasNextPage()) {
      const page = this.searchForm.get('page')?.value || 1;
      this.searchForm.patchValue({ page: page + 1 });
    }
  }
  /**
   * Cierra el panel devolviendo la opción "todas"
   *
   * @example ts
   * <li (click)="onAll()">Todas</li>
   */
  public onAll(): void {
    this.offcanvas.close({ reason: 'all', value: '' });
  }
  /**
   * Cierra el panel devolviendo la clave seleccionada
   *
   * @param key - Clave elegida
   * @example ts
   * <li (click)="onSelected(line)">{{line.code}}</li>
   */
  public onSelected({ code }: Key): void {
    this.offcanvas.close({ value: code, reason: 'selected' });
  }
}
