import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal, toObservable } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, distinctUntilChanged, map, Observable, startWith, switchMap, merge } from 'rxjs';
import type { User, AuthRole } from '@settings/models';
import { UserService } from '@settings/services';
import { UserService as AuthUserService } from '@core/services/user/user.service';

type Mode = 'register' | 'update' | 'roles' | 'delete' | 'password';

@Component({
  selector: 'config-users',
  imports: [NgbNavModule, NgbTypeaheadModule, ReactiveFormsModule],
  templateUrl: './config-users.component.html',
  styleUrl: './config-users.component.scss'
})
export class ConfigUsersComponent {

  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(UserService);
  private readonly authUser = inject(AuthUserService);

  public readonly subId = signal<Mode>('register');

  /** Catálogo y selección (nickname → User) */
  private readonly usersMap = signal<Map<string, User>>(new Map());
  private readonly userOptions = signal<string[]>([]);
  private readonly selected = signal<User | null>(null);

  /** Observable del catálogo para typeahead (reacciona a cambios del signal) */
  private readonly userOptions$ = toObservable(this.userOptions);

  public readonly hasUser = computed(() => this.selected() !== null);
  public readonly selectedNick = computed(() => this.selected()?.nickname ?? '—');
  public readonly selectedRolesLine = computed(() => (this.selected()?.roles ?? []).join(', '));

  /** Roles base solo para REGISTRO (inmutables en esa vista) */
  private readonly baseRoles = new Set<AuthRole>(['READ', 'WRITE']);

  /** Buscador (typeahead) */
  public readonly parameter = new FormControl('', {
    nonNullable: true,
    validators: [Validators.minLength(3), Validators.maxLength(40)],
  });
  public readonly parameterChange = toSignal(
    this.parameter.valueChanges.pipe(debounceTime(400), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** Guard/normalizador de roles */
  private isAuthRole(v: unknown): v is AuthRole {
    return v === 'READ' || v === 'WRITE' || v === 'EDIT' || v === 'GRANT' || v === 'ADMIN';
  }
  private toAuthRoles(xs: readonly string[] | null | undefined): AuthRole[] {
    return (xs ?? []).filter(this.isAuthRole);
  }
  /** Solo para registrar: garantiza roles base */
  private ensureBaseRoles(xs: readonly AuthRole[] | null | undefined): AuthRole[] {
    const s = new Set<AuthRole>(xs ?? []);
    for (const b of this.baseRoles) s.add(b);
    return [...s];
  }

  /** Validador: nickname duplicado contra catálogo en memoria */
  private readonly nickTaken: ValidatorFn = (ctrl: AbstractControl<string>) => {
    const v = (ctrl.value || '').toString().trim();
    if (!v) return null;
    const m = this.usersMap();
    if (m.size === 0) return { catalogLoading: true };
    return m.has(v.toUpperCase()) ? { duplicated: true } : null;
  };

  /** Forms */
  public readonly formRegister = new FormGroup({
    nickname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(40)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(128)],
    }),
    roles: new FormControl<AuthRole[]>(['READ', 'WRITE'], { nonNullable: true }),
  });

  public readonly formOriginal = new FormGroup({
    nickname: new FormControl('', { nonNullable: true }),
  });

  public readonly formUpdate = new FormGroup({
    newNickname: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(40), this.nickTaken],
    }),
  });

  public readonly allRoles: AuthRole[] = ['READ', 'WRITE', 'EDIT', 'GRANT', 'ADMIN'];
  public readonly formRoles = new FormGroup({
    op: new FormControl<'add' | 'remove' | 'set'>('set', { nonNullable: true }),
    roles: new FormControl<AuthRole[]>([], { nonNullable: true }),
  });

  public readonly formForce = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(128)],
    }),
  });

  public readonly formOwn = new FormGroup({
    currentPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(128)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(128)],
    }),
  });

  /** Valid flags (reactividad real) */
  public readonly formUpdateValid = toSignal(
    this.formUpdate.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.formUpdate.valid)),
    { initialValue: this.formUpdate.valid },
  );
  public readonly formRolesValid = toSignal(
    this.formRoles.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.formRoles.valid)),
    { initialValue: this.formRoles.valid },
  );
  public readonly formForceValid = toSignal(
    this.formForce.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.formForce.valid)),
    { initialValue: this.formForce.valid },
  );
  public readonly formOwnValid = toSignal(
    this.formOwn.statusChanges.pipe(map(s => s === 'VALID'), startWith(this.formOwn.valid)),
    { initialValue: this.formOwn.valid },
  );
  public readonly formRegisterValid = toSignal(
    merge(this.formRegister.statusChanges, this.formRegister.valueChanges).pipe(
      map(() => this.formRegister.valid),
      startWith(this.formRegister.valid),
    ),
    { initialValue: this.formRegister.valid },
  );
  public isInvalid(ctrl: AbstractControl | null | undefined): boolean {
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  /** Botones habilitados */
  public readonly canRegister = computed(() => this.subId() === 'register' && this.formRegisterValid());
  public readonly canUpdate = computed(() => this.subId() === 'update' && this.hasUser() && this.formUpdateValid());

  /** Roles actuales del usuario seleccionado (Set) — SIN forzar roles base */
  private readonly selectedRolesSet = computed<Set<AuthRole>>(() => {
    const roles = this.toAuthRoles(this.selected()?.roles);
    return new Set<AuthRole>(roles);
  });

  /** Signals derivados del form de roles (para reactividad real) */
  private readonly opSel = toSignal(
    this.formRoles.controls.op.valueChanges.pipe(startWith(this.formRoles.controls.op.value)),
    { initialValue: this.formRoles.controls.op.value }
  );
  private readonly rolesSel = toSignal(
    this.formRoles.controls.roles.valueChanges.pipe(startWith(this.formRoles.controls.roles.value ?? [])),
    { initialValue: (this.formRoles.controls.roles.value ?? []) as AuthRole[] }
  );

  /** Comparación de conjuntos */
  private eqSet(a: Set<AuthRole>, b: Set<AuthRole>): boolean {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  /** Registrar: roles base inmutables y siempre marcados */
  private readonly regRolesSel = toSignal(
    this.formRegister.controls.roles.valueChanges.pipe(startWith(this.formRegister.controls.roles.value ?? [])),
    { initialValue: (this.formRegister.controls.roles.value ?? []) as AuthRole[] }
  );
  private readonly _enforceBaseRolesRegister = effect(() => {
    const cur = new Set<AuthRole>(this.regRolesSel());
    let changed = false;
    for (const b of this.baseRoles) {
      if (!cur.has(b)) { cur.add(b); changed = true; }
    }
    if (changed) {
      this.formRegister.controls.roles.setValue([...cur], { emitEvent: true });
    }
  });

  /** Roles tab: habilita/deshabilita por operación (ya NO bloquea READ/WRITE en remove/set) */
  public isDisabledRole(r: AuthRole): boolean {
    if (!this.hasUser()) return true;
    const op = this.opSel();
    const has = this.selectedRolesSet().has(r);
    if (op === 'set') return false;
    if (op === 'add') return has;
    if (op === 'remove') return !has;
    return false;
  }

  /** Restablece selección al cambiar operación o usuario */
  private readonly _resetOnOpOrUserChange = effect(() => {
    const op = this.opSel();
    const u = this.selected();

    if (!u) {
      this.formRoles.controls.roles.setValue([], { emitEvent: true });
      return;
    }

    if (op === 'set') {
      // ahora reflejamos EXACTAMENTE los roles actuales (sin forzar base)
      this.formRoles.controls.roles.setValue(this.toAuthRoles(u.roles), { emitEvent: true });
    } else {
      this.formRoles.controls.roles.setValue([], { emitEvent: true });
    }
  });

  /** Sanea selección cuando cambia operación o usuario (usa signals) */
  private readonly _sanitizeRolesSelection = effect(() => {
    const op = this.opSel();
    const owned = this.selectedRolesSet();
    const actual = new Set<AuthRole>(this.rolesSel());

    let allowed: Set<AuthRole>;
    if (op === 'add') {
      allowed = new Set<AuthRole>(this.allRoles.filter(r => !owned.has(r)));
    } else if (op === 'remove') {
      allowed = new Set<AuthRole>([...owned]);
    } else {
      allowed = new Set<AuthRole>(this.allRoles);
    }

    if ([...actual].some(r => !allowed.has(r))) {
      const next = [...actual].filter(r => allowed.has(r)) as AuthRole[];
      this.formRoles.controls.roles.setValue(next, { emitEvent: true });
    }
  });

  /** ¿Cambiaría el resultado final si aplico op + selección? (sin forzar base) */
  private readonly rolesWouldChange = computed<boolean>(() => {
    if (!this.hasUser()) return false;

    const op = this.opSel();
    const owned = this.selectedRolesSet();
    const sel = new Set<AuthRole>(this.rolesSel());

    let next: Set<AuthRole>;
    if (op === 'add') {
      next = new Set<AuthRole>([...owned, ...sel]);
    } else if (op === 'remove') {
      next = new Set<AuthRole>([...owned].filter(r => !sel.has(r)));
    } else {
      next = new Set<AuthRole>(sel);
    }

    return !this.eqSet(owned, next);
  });

  /** Botón Aplicar: solo si hay cambio real */
  public readonly canRoles = computed(() => {
    if (this.subId() !== 'roles' || !this.hasUser() || !this.formRolesValid()) return false;
    return this.rolesWouldChange();
  });

  public readonly canDeleteBtn = computed(() => this.subId() === 'delete' && this.hasUser());
  public readonly canForcePw = computed(() => this.subId() === 'password' && this.hasUser() && this.formForceValid());
  public readonly canOwnPw = computed(() => this.subId() === 'password' && this.formOwnValid());

  /** Carga inicial del catálogo + refrescos explícitos */
  private readonly reloadUsers = signal(0);
  private readonly _loadUsers = effect(() => {
    this.reloadUsers(); // dependencia
    this.api.listAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ data }) => {
        const m = new Map<string, User>();
        const opts: string[] = [];
        for (const u of data) {
          m.set(u.nickname.toUpperCase(), u);
          opts.push(u.nickname);
        }
        this.usersMap.set(m);
        this.userOptions.set(opts);
        // rehidratar selección si existía
        const cur = this.selected();
        if (cur) {
          this.selected.set(m.get(cur.nickname.toUpperCase()) ?? null);
        }
      });
  });
  private refreshUsers(): void {
    this.reloadUsers.update(n => n + 1);
  }

  /** Resolver selección: depende del término Y del catálogo */
  private readonly _resolveSelected = effect(() => {
    this.usersMap();
    const raw = (this.parameterChange() || '').trim();
    if (!raw || raw.length < 3) {
      this.selected.set(null);
      return;
    }
    const found = this.usersMap().get(raw.toUpperCase()) ?? null;
    this.selected.set(found);
  });

  /** Espejo de selección → forms */
  private readonly lastPatchedNick = signal<string | null>(null);
  private readonly _mirrorSelectedIntoForms = effect(() => {
    const mode = this.subId();
    const cur = this.selected();

    if (cur) {
      this.formOriginal.setValue({ nickname: cur.nickname }, { emitEvent: true });

      if (mode === 'update' && this.lastPatchedNick() !== cur.nickname) {
        this.formUpdate.setValue({ newNickname: cur.nickname }, { emitEvent: true });
        this.lastPatchedNick.set(cur.nickname);
      }

      if (mode === 'roles') {
        // set por defecto a los roles actuales tal cual
        const roles = this.toAuthRoles(cur.roles);
        this.formRoles.setValue({ op: 'set', roles }, { emitEvent: true });
      }
    } else {
      this.formOriginal.setValue({ nickname: '' }, { emitEvent: true });
      this.lastPatchedNick.set(null);
      if (mode === 'register') {
        this.formRegister.reset({ nickname: '', password: '', roles: ['READ', 'WRITE'] as AuthRole[] }, { emitEvent: true });
      }
      if (mode === 'roles') {
        this.formRoles.reset({ op: 'set', roles: [] as AuthRole[] }, { emitEvent: true });
      }
    }
  });

  /** Habilitar/inhabilitar controles según modo */
  private readonly _syncDisabledStates = effect(() => {
    const mode = this.subId();
    const has = this.hasUser();
    if (mode === 'update' && has) {
      if (this.formUpdate.controls.newNickname.disabled) {
        this.formUpdate.controls.newNickname.enable({ emitEvent: false });
      }
    } else {
      if (this.formUpdate.controls.newNickname.enabled) {
        this.formUpdate.controls.newNickname.disable({ emitEvent: false });
      }
    }
  });

  /** Typeahead */
  private filterOptions(source: string[], term: string): string[] {
    const t = (term || '').trim().toUpperCase();
    if (!t) return source.slice(0, 10);
    const starts: string[] = [];
    const contains: string[] = [];
    for (const nick of source) {
      const u = nick.toUpperCase();
      if (u.startsWith(t)) starts.push(nick);
      else if (u.includes(t)) contains.push(nick);
    }
    return [...starts, ...contains].slice(0, 10);
  }

  public readonly searchUsers = (text$: Observable<string>): Observable<string[]> =>
    text$.pipe(
      map(v => (v ?? '').toString().trim()),
      debounceTime(150),
      distinctUntilChanged(),
      switchMap(term => this.userOptions$.pipe(
        map(opts => this.filterOptions(opts, term))
      )),
    );

  /** Helpers (Registrar) */
  public isDisabledRegisterRole(r: AuthRole): boolean {
    return this.baseRoles.has(r);
  }
  public isCheckedRegister(r: AuthRole): boolean {
    return this.baseRoles.has(r) || (this.formRegister.controls.roles.value ?? []).includes(r);
  }
  public toggleRegisterRole(r: AuthRole): void {
    if (this.baseRoles.has(r)) return;
    const cur = this.formRegister.controls.roles.value ?? [];
    this.formRegister.controls.roles.setValue(cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]);
  }

  /** Helpers (Roles) */
  public isCheckedRoles(r: AuthRole): boolean {
    return (this.formRoles.controls.roles.value ?? []).includes(r);
  }
  public toggleRolesRole(r: AuthRole): void {
    const cur = this.formRoles.controls.roles.value ?? [];
    this.formRoles.controls.roles.setValue(cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r]);
  }

  /** Acciones */
  public onRegister(): void {
    if (!this.canRegister()) return;
    const { nickname, password, roles } = this.formRegister.getRawValue();
    const out = this.ensureBaseRoles(roles ?? []);
    this.api.register({
      nickname: nickname!, password: password!,
      roles: out.map(r => r as string),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formRegister.reset({ nickname: '', password: '', roles: ['READ', 'WRITE'] as AuthRole[] });
        this.formRegister.markAsPristine();
        this.formRegister.markAsUntouched();
        this.formRegister.updateValueAndValidity({ emitEvent: true });
        this.refreshUsers();
      });
  }

  public onUpdate(): void {
    const cur = this.selected();
    if (!cur || !this.canUpdate()) return;
    const { newNickname } = this.formUpdate.getRawValue();
    this.api.updateNickname({ identifier: cur.identifier, newNickname: newNickname! })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ nickname }) => {
        this.parameter.setValue(nickname);
        this.refreshUsers();
      });
  }

  public onRoles(): void {
    const cur = this.selected();
    if (!cur || !this.canRoles()) return;
    const { op, roles } = this.formRoles.getRawValue();

    let payloadRoles: AuthRole[] = [];
    if (op === 'set') {
      payloadRoles = (roles ?? []);
    } else if (op === 'add') {
      payloadRoles = (roles ?? []);
    } else { // remove
      payloadRoles = (roles ?? []);
    }

    this.api.updateRoles({
      identifier: cur.identifier,
      roles: payloadRoles.map(r => r as string),
      op: op!,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ roles }) => {
        const updated: User = { ...cur, roles };
        this.selected.set(updated);
        const m = new Map(this.usersMap());
        m.set(updated.nickname.toUpperCase(), updated);
        this.usersMap.set(m);
      });
  }

  public onDelete(): void {
    const cur = this.selected();
    if (!cur || !this.canDeleteBtn()) return;
    this.api.deleteUser({ identifier: cur.identifier })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.parameter.setValue('');
        this.selected.set(null);
        this.refreshUsers();
      });
  }

  public onForcePassword(): void {
    const cur = this.selected();
    if (!cur || !this.canForcePw()) return;
    const { newPassword } = this.formForce.getRawValue();
    this.api.forcePassword({ identifier: cur.identifier, newPassword: newPassword! })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formForce.reset({ newPassword: '' }));
  }

  public onChangeOwnPassword(): void {
    if (!this.canOwnPw()) return;
    const { currentPassword, newPassword } = this.formOwn.getRawValue();
    this.api.changeOwnPassword({ currentPassword: currentPassword!, newPassword: newPassword! })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formOwn.reset({ currentPassword: '', newPassword: '' }));
  }
}
