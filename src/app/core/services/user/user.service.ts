import { HttpClient } from '@angular/common/http';
import { effect, Inject, Injectable, InjectionToken, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

type authRole = "READ" | "WRITE" | "EDIT" | "GRANT" | "ADMIN";

interface UserIdentity {
  identifier: string | null;
  nickname: string | null;
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
  private userSignal: WritableSignal<UserIdentity>;
  private userChange$: BehaviorSubject<UserIdentity>;

  constructor(
    protected override http: HttpClient,
    protected override router: Router,
    @Inject(PLATFORM_ID) protected override platformId: InjectionToken<Object>
  ) {
    super(http, router, platformId);
    this.userSignal = signal(initialIdentity);
    this.userChange$ = new BehaviorSubject<UserIdentity>(initialIdentity);

    effect(() => {
      const currentUser = this.userSignal();
      console.log("current user has changed", currentUser);
      
      this.userChange$.next(currentUser);
    });

    if (this.loggedIn) {
      this.update().subscribe({
        next: (info) => {
          this.info = info;
        },
        error: () => {
          this.destroy();
        }
      });
    }
  }

  public update() {
    return this.http.get<UserIdentity>(`${this.url}/user/info`);
  }

  public destroy(): void {
    this.userSignal.set(initialIdentity);
  }

  public get info(): UserIdentity {
    return this.userSignal();
  }

  public set info(data: UserIdentity) {
    this.userSignal.set(data);
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

  public get userSync(): Observable<UserIdentity> {
    return this.userChange$.asObservable();
  }
}

export type { UserIdentity };