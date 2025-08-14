import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Brand, IBrand } from '@settings/models';
import { BrandService } from '@settings/services';
import { debounceTime, distinctUntilChanged, map, Observable, startWith } from 'rxjs';

type BrandForm = {
  code: FormControl<string>;
  desc: FormControl<string>;
};

type Mode = 'create' | 'update' | 'delete';

@Component({
  selector: 'config-brands',
  imports: [NgbNavModule, NgbTypeaheadModule, ReactiveFormsModule],
  templateUrl: './config-brands.component.html',
  styleUrl: './config-brands.component.scss'
})
export class ConfigBrandsComponent {

  private readonly destroyRef = inject(DestroyRef);
  private readonly brandService = inject(BrandService);

  public readonly subId = signal<Mode>('create');

  /** Selector derecho para elegir la marca (por código). */
  public readonly parameter = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(2), Validators.maxLength(3)],
  });
  public readonly parameterChange = toSignal(
    this.parameter.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  private readonly selectedBrand = signal<Brand | null>(null);
  public readonly hasBrand = computed(() => this.selectedBrand() !== null);
  public readonly selectedCode = computed(() => this.selectedBrand()?.code.toUpperCase() ?? '—');
  public readonly selectedDesc = computed(() => this.selectedBrand()?.desc ?? '—');

  /** Formulario editable (crear/actualizar). */
  public readonly form = new FormGroup<BrandForm>({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(3)],
    }),
    desc: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(128)],
    }),
  });

  /** Formulario de solo lectura (muestra los valores originales en update). */
  public readonly formOriginal = new FormGroup<BrandForm>({
    code: new FormControl('', { nonNullable: true }),
    desc: new FormControl('', { nonNullable: true }),
  });

  public readonly forceDelete = new FormControl<boolean>(false, { nonNullable: true });

  private readonly brandOptions = signal<string[]>([]);
  private readonly brandMap = signal<Map<string, Brand>>(new Map());

  /** Carga catálogo en memoria para el typeahead del selector derecho. */
  private readonly _loadBrands = effect(() => {
    this.brandService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        this.brandOptions.set(data.map(d => d.code));
        const m = new Map<string, Brand>();
        for (const d of data) m.set(d.code.toUpperCase(), d as Brand);
        this.brandMap.set(m);
      });
  });

  /** Resuelve la marca seleccionada desde el parámetro (código). */
  private readonly _resolveBrand = effect(() => {
    const raw = this.parameterChange()?.trim();
    const code = (raw || '').toUpperCase();
    if (!code || code.length < 2 || code.length > 3) {
      this.selectedBrand.set(null);
      return;
    }
    const found = this.brandMap().get(code) ?? null;
    this.selectedBrand.set(found);
  });

  /** Sincroniza habilitación del form editable y del switch de borrado. */
  private readonly _syncDisabledStates = effect(() => {
    const mode = this.subId();
    const has = this.hasBrand();
    const { code, desc } = this.form.controls;

    const canEdit = mode === 'create' || (mode === 'update' && has);
    if (canEdit) {
      if (code.disabled) code.enable({ emitEvent: false });
      if (desc.disabled) desc.enable({ emitEvent: false });
    } else {
      if (code.enabled) code.disable({ emitEvent: false });
      if (desc.enabled) desc.disable({ emitEvent: false });
    }

    if (mode === 'delete' && has) {
      if (this.forceDelete.disabled) this.forceDelete.enable({ emitEvent: false });
    } else {
      if (this.forceDelete.enabled) this.forceDelete.disable({ emitEvent: false });
    }
  });

  /** Al cambiar selección, copia originales a formOriginal y precarga form editable en update. */
  private readonly lastPatchedId = signal<string | null>(null);
  private readonly _mirrorSelectedIntoForms = effect(() => {
    const mode = this.subId();
    const cur = this.selectedBrand();

    // Siempre reflejar originales
    this.formOriginal.setValue({
      code: cur?.code ?? '',
      desc: cur?.desc ?? '',
    }, { emitEvent: false });

    // Solo precargar el form editable cuando estamos en update y cambia la selección
    if (mode === 'update' && cur && this.lastPatchedId() !== cur._id) {
      this.form.setValue({ code: cur.code, desc: cur.desc }, { emitEvent: false });
      this.lastPatchedId.set(cur._id);
    }
    if (mode !== 'update') {
      this.lastPatchedId.set(null);
      if (mode === 'create') {
        this.form.reset({ code: '', desc: '' }, { emitEvent: false });
      }
    }
  });

  public readonly formValid = toSignal(
    this.form.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.form.valid)),
    { initialValue: this.form.valid },
  );

  /** Typeahead solo para el selector derecho. */
  private filterCodes(source: string[], term: string): string[] {
    const t = (term || '').trim().toUpperCase();
    if (!t) return source.slice(0, 10);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const code of source) {
      const u = code.toUpperCase();
      if (u.startsWith(t)) starts.push(code);
      else if (u.includes(t)) contains.push(code);
    }
    return [...starts, ...contains].slice(0, 10);
  }
  public readonly searchBrands = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map(v => (v ?? '').toString().trim().toUpperCase()),
      debounceTime(150),
      distinctUntilChanged(),
      map(term => this.filterCodes(this.brandOptions(), term)),
    );

  public descOfBrand(code: string | null | undefined): string {
    const c = (code || '').toUpperCase();
    return this.brandMap().get(c)?.desc ?? '';
  }

  public readonly canCreate = computed(() => this.subId() === 'create' && this.formValid());
  public readonly canUpdate = computed(() => this.subId() === 'update' && this.hasBrand() && this.formValid());
  public readonly canDeleteBtn = computed(() => this.subId() === 'delete' && this.hasBrand());

  public onCreate(): void {
    if (this.form.invalid) return;
    const payload: IBrand = {
      code: this.form.controls.code.value,
      desc: this.form.controls.desc.value,
    };
    this.brandService.save(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.reset({ code: '', desc: '' });
      });
  }

  public onUpdate(): void {
    const cur = this.selectedBrand();
    if (!cur || this.form.invalid) return;
    const patch: Partial<IBrand> = {
      code: this.form.controls.code.value,
      desc: this.form.controls.desc.value,
    };
    this.brandService.update(cur._id, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.reset({ code: '', desc: '' });
        this.parameter.setValue('');
        this.selectedBrand.set(null);
      });
  }

  public onDelete(): void {
    const cur = this.selectedBrand();
    if (!cur) return;
    const force = this.forceDelete.value === true;
    this.brandService.delete(cur._id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.parameter.setValue('');
        this.selectedBrand.set(null);
      });
  }
}
