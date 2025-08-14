import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Line, ILine } from '@settings/models';
import { LineService } from '@settings/services';
import { debounceTime, distinctUntilChanged, map, Observable, startWith } from 'rxjs';

type LineForm = {
  code: FormControl<string>;
  desc: FormControl<string>;
};

type Mode = 'create' | 'update' | 'delete';

@Component({
  selector: 'config-lines',
  imports: [NgbNavModule, NgbTypeaheadModule, ReactiveFormsModule],
  templateUrl: './config-lines.component.html',
  styleUrl: './config-lines.component.scss'
})
export class ConfigLinesComponent {

  private readonly destroyRef = inject(DestroyRef);
  private readonly lineService = inject(LineService);

  public readonly subId = signal<Mode>('create');

  /** Selector derecho para elegir la línea (por código). */
  public readonly parameter = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(3), Validators.maxLength(3)],
  });
  public readonly parameterChange = toSignal(
    this.parameter.valueChanges.pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  private readonly selectedLine = signal<Line | null>(null);
  public readonly hasLine = computed(() => this.selectedLine() !== null);
  public readonly selectedCode = computed(() => this.selectedLine()?.code.toUpperCase() ?? '—');
  public readonly selectedDesc = computed(() => this.selectedLine()?.desc ?? '—');

  /** Formulario editable (crear/actualizar). */
  public readonly form = new FormGroup<LineForm>({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(3)],
    }),
    desc: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(1), Validators.maxLength(128)],
    }),
  });

  /** Formulario de solo lectura (valores originales en update). */
  public readonly formOriginal = new FormGroup<LineForm>({
    code: new FormControl('', { nonNullable: true }),
    desc: new FormControl('', { nonNullable: true }),
  });

  public readonly forceDelete = new FormControl<boolean>(false, { nonNullable: true });

  private readonly lineOptions = signal<string[]>([]);
  private readonly lineMap = signal<Map<string, Line>>(new Map());

  /** Carga catálogo para el selector derecho. */
  private readonly _loadLines = effect(() => {
    this.lineService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        this.lineOptions.set(data.map(d => d.code));
        const m = new Map<string, Line>();
        for (const d of data) m.set(d.code.toUpperCase(), d as Line);
        this.lineMap.set(m);
      });
  });

  /** Resuelve la línea seleccionada desde el parámetro. */
  private readonly _resolveLine = effect(() => {
    const raw = this.parameterChange()?.trim();
    const code = (raw || '').toUpperCase();
    if (!code || code.length !== 3) {
      this.selectedLine.set(null);
      return;
    }
    const found = this.lineMap().get(code) ?? null;
    this.selectedLine.set(found);
  });

  /** Habilita/inhabilita controles según modo/selección. */
  private readonly _syncDisabledStates = effect(() => {
    const mode = this.subId();
    const has = this.hasLine();
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

  /** Copia originales y precarga el form editable al cambiar selección en update. */
  private readonly lastPatchedId = signal<string | null>(null);
  private readonly _mirrorSelectedIntoForms = effect(() => {
    const mode = this.subId();
    const cur = this.selectedLine();

    this.formOriginal.setValue({
      code: cur?.code ?? '',
      desc: cur?.desc ?? '',
    }, { emitEvent: false });

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
  public readonly searchLines = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map(v => (v ?? '').toString().trim().toUpperCase()),
      debounceTime(150),
      distinctUntilChanged(),
      map(term => this.filterCodes(this.lineOptions(), term)),
    );

  public descOfLine(code: string | null | undefined): string {
    const c = (code || '').toUpperCase();
    return this.lineMap().get(c)?.desc ?? '';
  }

  public readonly canCreate = computed(() => this.subId() === 'create' && this.formValid());
  public readonly canUpdate = computed(() => this.subId() === 'update' && this.hasLine() && this.formValid());
  public readonly canDeleteBtn = computed(() => this.subId() === 'delete' && this.hasLine());

  public onCreate(): void {
    if (this.form.invalid) return;
    const payload: ILine = {
      code: this.form.controls.code.value,
      desc: this.form.controls.desc.value,
    };
    this.lineService.save(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.reset({ code: '', desc: '' });
      });
  }

  public onUpdate(): void {
    const cur = this.selectedLine();
    if (!cur || this.form.invalid) return;
    const patch: Partial<ILine> = {
      code: this.form.controls.code.value,
      desc: this.form.controls.desc.value,
    };
    this.lineService.update(cur._id, patch)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.reset({ code: '', desc: '' });
        this.parameter.setValue('');
        this.selectedLine.set(null);
      });
  }

  public onDelete(): void {
    const cur = this.selectedLine();
    if (!cur) return;
    const force = this.forceDelete.value === true;
    this.lineService.delete(cur._id, force)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.parameter.setValue('');
        this.selectedLine.set(null);
      });
  }
}
