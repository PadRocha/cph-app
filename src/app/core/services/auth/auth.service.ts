import { isPlatformBrowser } from "@angular/common";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import {
  Inject,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  signal,
  WritableSignal,
} from "@angular/core";
import { Router } from "@angular/router";
import { User } from "@core/models";
import { environment } from "@environment";

type Token = { token: string };

@Injectable({
  providedIn: "root",
})
export class AuthService {
  protected url: String;
  private tokenSignal: WritableSignal<string | null>;

  constructor(
    protected http: HttpClient,
    protected router: Router,
    @Inject(PLATFORM_ID) protected platformId: InjectionToken<Object>
  ) {
    this.url = environment.httpUrl;
    this.tokenSignal = signal<string | null>(null);

    if (isPlatformBrowser(this.platformId)) {
      const tokenStr = sessionStorage.getItem("token");
      if (tokenStr) {
        const { expiry, value } = JSON.parse(tokenStr);
        const now = new Date().getTime();
        if (!expiry || now <= expiry) {
          this.tokenSignal.set(value);
        }
      }
    }
  }

  public setToken(value: string, expiry = true): void {
    const now = new Date();
    const item = { value, expiry: expiry ? now.getTime() + 86_400_000 : false };
    if (isPlatformBrowser(this.platformId))
      sessionStorage.setItem("token", JSON.stringify(item));
    this.tokenSignal.set(value);
  }

  public login(user: User) {
    const params = JSON.stringify(user);
    // const logged = this.http.post<{ token: string|null }>(`${this.url}/user/login`, params, {
    //   headers: new HttpHeaders().set("Content-Type", "application/json"),
    // });
    // return toSignal(logged , { initialValue: { token: null } });
    return this.http.post<Token>(`${this.url}/user/login`, params, {
      headers: new HttpHeaders().set("Content-Type", "application/json"),
    });
  }

  public logout(): void {
    if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem("token");
    this.tokenSignal.set(null);
    this.router.navigate(["/login"]);
  }

  public get token(): string | null {
    return this.tokenSignal();
  }

  public get loggedIn(): boolean {
    return !!this.tokenSignal();
  }
}
