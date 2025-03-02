import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, InjectionToken, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

type authRole = "READ" | "WRITE" | "EDIT" | "GRANT" | "ADMIN";

interface UserIdentity {
  /** Código de identificador de usuario */
  identifier: string | null;
  /** Nombre de usuario */
  nickname: string | null;
  /** Roles que posee el usuario */
  roles: authRole[];
}

const initialIdentity: UserIdentity = {
  identifier: null,
  nickname: null,
  roles: [],
};

@Injectable({
  providedIn: "root",
})
export class UserService extends AuthService {
  /** Identidad del usuario */
  private userSignal: WritableSignal<UserIdentity>;

  constructor(
    protected override http: HttpClient,
    protected override router: Router,
    @Inject(PLATFORM_ID) protected override platformId: InjectionToken<Object>
  ) {
    super(http, router, platformId);
    this.userSignal = signal<UserIdentity>(initialIdentity);
    if (this.loggedIn) {
      this.update();
    }
  }

  private update(): void {
    this.http.get<UserIdentity>(`${this.url}/user`).subscribe({
      next: (user) => this.userSignal.set(user),
      error: () => this.destroy(),
    });
  }

  public destroy(): void {
    this.userSignal.set(initialIdentity);
  }

  public get user(): UserIdentity {
    return this.userSignal();
  }

  public get getId(): string | null {
    return this.userSignal().identifier;
  }

  public get logged(): boolean {
    return !!this.getId;
  }

  public isEqualTo(_id: string): boolean {
    return this.getId === _id;
  }

  public get nickname(): string | null {
    return this.userSignal().nickname;
  }

  public get roles(): authRole[] {
    return this.userSignal().roles;
  }

  public hasRole(...roles: authRole[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }
}

export type { UserIdentity };