import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Brand, IKey, Key, Line } from '@settings/models';
import { BrandService, KeyService, LineService } from '@settings/services';
import { debounceTime, distinctUntilChanged, map, Observable, startWith, switchMap } from 'rxjs';

type KeyForm = {
  [K in keyof IKey]: FormControl<IKey[K]>;
};
type Mode = 'create' | 'update' | 'delete' | 'reset';

@Component({
  selector: 'config-keys',
  imports: [NgbNavModule, NgbTypeaheadModule, ReactiveFormsModule],
  templateUrl: './config-keys.component.html',
  styleUrl: './config-keys.component.scss'
})
export class ConfigKeysComponent {

  private readonly destroyRef = inject(DestroyRef);
  private readonly keyService = inject(KeyService);
  private readonly lineService = inject(LineService);
  private readonly brandService = inject(BrandService);

  public readonly subId = signal<Mode>('create');

  private readonly keys = signal<Map<string, string>>(new Map());

  public readonly parameter = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(5), Validators.maxLength(6)],
  });

  public readonly parameterChange = toSignal(
    this.parameter.valueChanges.pipe(debounceTime(400), distinctUntilChanged()),
    { initialValue: '' },
  );

  private readonly selectedKey = signal<Key | null>(null);
  public readonly hasKey = computed(() => this.selectedKey() !== null);
  public readonly selectedCode = computed(() => this.selectedKey()?.code.toUpperCase() ?? '—');

  private readonly lineExists: ValidatorFn = (ctrl: AbstractControl<string>) => {
    const v = (ctrl.value || '').toString().trim().toUpperCase();
    if (!v) return null;
    const m = this.lineMap();
    if (m.size === 0) return { catalogLoading: true };
    return m.has(v) ? null : { notFound: true };
  };

  private readonly brandExists: ValidatorFn = (ctrl: AbstractControl<string>) => {
    const v = (ctrl.value || '').toString().trim().toUpperCase();
    if (!v) return null;
    const m = this.brandMap();
    if (m.size === 0) return { catalogLoading: true };
    return m.has(v) ? null : { notFound: true };
  };

  /** Form editable (crear/actualizar). */
  public readonly form = new FormGroup<KeyForm>({
    line: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(3),
        this.lineExists,
      ],
    }),
    brand: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(3),
        this.brandExists,
      ],
    }),
  });

  /** Form solo lectura (originales en update). */
  public readonly formOriginal = new FormGroup<KeyForm>({
    line: new FormControl('', { nonNullable: true }),
    brand: new FormControl('', { nonNullable: true }),
  });

  public readonly resetStatus = new FormControl<number | null>(null);
  public readonly forceDelete = new FormControl<boolean>(false, { nonNullable: true });

  private readonly lineOptions = signal<string[]>([]);
  private readonly brandOptions = signal<string[]>([]);

  private readonly lineMap = signal<Map<string, Line>>(new Map());
  private readonly brandMap = signal<Map<string, Brand>>(new Map());

  /** Helpers */
  private parseKey(code: string): { line: string; brand: string } {
    const up = (code || '').trim().toUpperCase();
    const line = up.slice(0, 3);
    const brand = up.slice(3);
    return { line, brand };
  }

  /** Catálogos para typeahead. */
  private readonly _loadLineBrand = effect(() => {
    this.lineService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        this.lineOptions.set(data.map(d => d.code));
        const m = new Map<string, Line>();
        for (const d of data) m.set(d.code.toUpperCase(), d);
        this.lineMap.set(m);
        this.form.controls.line.updateValueAndValidity({ emitEvent: true });
      });

    this.brandService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        this.brandOptions.set(data.map(d => d.code));
        const m = new Map<string, Brand>();
        for (const d of data) m.set(d.code.toUpperCase(), d);
        this.brandMap.set(m);
        this.form.controls.brand.updateValueAndValidity({ emitEvent: true });
      });
  });

  /** Resolver key por code y guardar selección. */
  private readonly _resolveKey = effect(() => {
    const raw = this.parameterChange()?.trim();
    const code = (raw || '').toUpperCase();

    if (!code || code.length < 5 || code.length > 6) {
      this.selectedKey.set(null);
      return;
    }

    this.keyService.searchByCode(code, 1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        const exact = data.find(k => k.code.toUpperCase() === code) || null;
        if (!exact) {
          this.selectedKey.set(null);
          return;
        }
        // guarda _id por si lo necesitas en otras acciones
        const mapNow = new Map(this.keys());
        mapNow.set(exact.code, exact._id);
        this.keys.set(mapNow);
        this.selectedKey.set(exact);
      });
  });

  /** Descripciones de los inputs del form editable. */
  private readonly lineValue = toSignal(
    this.form.controls.line.valueChanges.pipe(startWith(this.form.controls.line.value)),
    { initialValue: this.form.controls.line.value }
  );
  private readonly brandValue = toSignal(
    this.form.controls.brand.valueChanges.pipe(startWith(this.form.controls.brand.value)),
    { initialValue: this.form.controls.brand.value }
  );
  public readonly lineDesc = computed(() => {
    const c = (this.lineValue() || '').toUpperCase();
    return this.lineMap().get(c)?.desc ?? '';
  });
  public readonly brandDesc = computed(() => {
    const c = (this.brandValue() || '').toUpperCase();
    return this.brandMap().get(c)?.desc ?? '';
  });

  /** Descripciones de los originales (ligadas al formOriginal). */
  private readonly origLineValue = toSignal(
    this.formOriginal.controls.line.valueChanges.pipe(startWith(this.formOriginal.controls.line.value)),
    { initialValue: this.formOriginal.controls.line.value }
  );
  private readonly origBrandValue = toSignal(
    this.formOriginal.controls.brand.valueChanges.pipe(startWith(this.formOriginal.controls.brand.value)),
    { initialValue: this.formOriginal.controls.brand.value }
  );
  public readonly origLineDesc = computed(() => {
    const c = (this.origLineValue() || '').toUpperCase();
    return this.lineMap().get(c)?.desc ?? '';
  });
  public readonly origLineUpper = computed(() =>(this.origLineValue() || '').toUpperCase());
  public readonly origBrandUpper = computed(() =>(this.origBrandValue() || '').toUpperCase());
  public readonly origBrandDesc = computed(() => {
    const c = (this.origBrandValue() || '').toUpperCase();
    return this.brandMap().get(c)?.desc ?? '';
  });

  /** Copiar originales (derivados del code) y precargar el editable en update. */
  private readonly lastPatchedCode = signal<string | null>(null);
  private readonly _mirrorSelectedIntoForms = effect(() => {
    const mode = this.subId();
    const key = this.selectedKey();

    if (key) {
      const { line, brand } = this.parseKey(key.code);

      // Originales: que EMITAN para que origLineDesc()/origBrandDesc() se actualicen
      this.formOriginal.setValue({ line, brand }, { emitEvent: true });

      // Editable precargado en update: también EMITIR para que lineDesc()/brandDesc() aparezcan
      if (mode === 'update' && this.lastPatchedCode() !== key.code) {
        this.form.setValue({ line, brand }, { emitEvent: true });
        this.lastPatchedCode.set(key.code);
      }
    } else {
      this.formOriginal.setValue({ line: '', brand: '' }, { emitEvent: true });
      this.lastPatchedCode.set(null);
      if (mode === 'create') {
        this.form.reset({ line: '', brand: '' }, { emitEvent: true });
      }
    }
  });

  public readonly formValid = toSignal(
    this.form.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.form.valid)),
    { initialValue: this.form.valid },
  );

  public readonly resetStatusValue = toSignal(
    this.resetStatus.valueChanges.pipe(startWith(this.resetStatus.value)),
    { initialValue: this.resetStatus.value },
  );

  public readonly canCreate = computed(() => this.subId() === 'create' && this.formValid());
  public readonly canUpdate = computed(() => this.subId() === 'update' && this.hasKey() && this.formValid());
  public readonly canDeleteBtn = computed(() => this.subId() === 'delete' && this.hasKey());
  public readonly canResetBtn = computed(() => this.subId() === 'reset' && this.hasKey() && this.resetStatusValue() !== null);

  /** Habilitar/inhabilitar controles según modo. */
  private readonly _syncDisabledStates = effect(() => {
    const mode = this.subId();
    const has = this.hasKey();
    const { line, brand } = this.form.controls;

    const canEdit = mode === 'create' || (mode === 'update' && has);
    if (canEdit) {
      if (line.disabled) line.enable({ emitEvent: false });
      if (brand.disabled) brand.enable({ emitEvent: false });
    } else {
      if (line.enabled) line.disable({ emitEvent: false });
      if (brand.enabled) brand.disable({ emitEvent: false });
    }

    if (mode === 'reset' && has) {
      if (this.resetStatus.disabled) this.resetStatus.enable({ emitEvent: false });
    } else {
      if (this.resetStatus.enabled) this.resetStatus.disable({ emitEvent: false });
    }

    if (mode === 'delete' && has) {
      if (this.forceDelete.disabled) this.forceDelete.enable({ emitEvent: false });
    } else {
      if (this.forceDelete.enabled) this.forceDelete.disable({ emitEvent: false });
    }
  });

  /** Typeahead */
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

  public readonly searchKeys = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(t => this.keyService.codesByPrefix((t || '').toUpperCase(), 10)),
    );

  public readonly searchLines = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map(v => (v ?? '').toString().trim().toUpperCase()),
      debounceTime(150),
      distinctUntilChanged(),
      map(term => this.filterCodes(this.lineOptions(), term)),
    );

  public readonly searchBrands = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map(v => (v ?? '').toString().trim().toUpperCase()),
      debounceTime(150),
      distinctUntilChanged(),
      map(term => this.filterCodes(this.brandOptions(), term)),
    );

  public descOfLine(code: string | null | undefined): string {
    const c = (code || '').toUpperCase();
    return this.lineMap().get(c)?.desc ?? '';
  }
  public descOfBrand(code: string | null | undefined): string {
    const c = (code || '').toUpperCase();
    return this.brandMap().get(c)?.desc ?? '';
  }

  /** Acciones */
  public onCreate(): void {
    if (this.form.invalid) return;
    const payload: IKey = {
      line: this.form.controls.line.value,
      brand: this.form.controls.brand.value,
    };
    this.keyService.save(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.reset({ line: '', brand: '' }));
  }

  public onUpdate(): void {
    const cur = this.selectedKey();
    if (!cur || this.form.invalid) return;
    const patch: Partial<IKey> = {
      line: this.form.controls.line.value,
      brand: this.form.controls.brand.value,
    };
    this.keyService.update(cur._id, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.reset({ line: '', brand: '' });
        this.parameter.setValue('');
        this.selectedKey.set(null);
      });
  }

  public onDelete(): void {
    const cur = this.selectedKey();
    if (!cur) return;
    const force = this.forceDelete.value === true;
    this.keyService.delete(cur._id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.parameter.setValue('');
        this.selectedKey.set(null);
      });
  }

  public onReset(): void {
    const cur = this.selectedKey();
    if (!cur) return;
    const status = this.resetStatus.value ?? undefined;
    this.keyService.reset(cur._id, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resetStatus.setValue(null));
  }
}
