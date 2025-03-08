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
import { Observable } from "rxjs";

type Token = { token: string };

/**
 * Servicio de autenticación.
 *
 * Gestiona el login, logout y almacenamiento del token en sesión.
 *
 * @remarks
 * Este servicio utiliza un mecanismo basado en señales para mantener el estado
 * del token y usa sessionStorage cuando se ejecuta en el navegador.
 *
 * @example
 * Para iniciar sesión:
 * ```ts
 * authService.login(user).subscribe(token => {
 *   authService.setToken(token.token);
 * });
 * ```
 */
@Injectable({
  providedIn: "root",
})
export class AuthService {
  /** URL base para las peticiones HTTP. */
  protected url: String;
  /** Instancia del almacenamiento (sessionStorage en navegador). */
  private storage!: Storage;
  /** Señal que almacena el token actual o null si no existe. */
  private tokenSignal: WritableSignal<string | null>;

  /**
   * Crea una instancia de AuthService.
   *
   * @param http - Cliente HTTP para realizar peticiones.
   * @param router - Router para gestionar redirecciones.
   * @param platformId - Token de inyección para detectar la plataforma.
   */
  constructor(
    protected http: HttpClient,
    protected router: Router,
    @Inject(PLATFORM_ID) protected platformId: InjectionToken<Object>
  ) {
    this.url = environment.httpUrl;
    this.tokenSignal = signal(null);

    if (isPlatformBrowser(this.platformId)) {
      this.storage = sessionStorage;
      const tokenStr = this.storage.getItem("token");
      if (tokenStr) {
        const { expiry, value } = JSON.parse(tokenStr);
        const now = new Date().getTime();
        // Si no hay expiración o la expiración es futura, se mantiene el token
        if (!expiry || now <= expiry) this.tokenSignal.set(value);
      }
    }
  }

  /**
   * Establece el token y lo guarda en el almacenamiento.
   *
   * @param value - El valor del token.
   * @param expiry - Si se debe asignar una expiración (por defecto true, 24h).
   */
  public setToken(value: string, expiry = true): void {
    if (isPlatformBrowser(this.platformId)) {
      const now = new Date();
      const item = { value, expiry: expiry ? now.getTime() + 86_400_000 : false };
      this.storage.setItem("token", JSON.stringify(item));
    }
    this.tokenSignal.set(value);
  }

  /**
   * Realiza la petición de login.
   *
   * @param user - Objeto User con las credenciales.
   * @returns Observable que emite un objeto con el token.
   */
  public login(user: User): Observable<Token> {
    return this.http.post<Token>(`${this.url}/user/login`, user, {
      headers: new HttpHeaders().set("Content-Type", "application/json"),
    });
  }

  /**
   * Realiza el logout, removiendo el token y redirigiendo a la ruta indicada.
   *
   * @param goto - Ruta a la que redirigir tras el logout (por defecto "/login").
   */
  public logout(goto: string = "/login"): void {
    if (isPlatformBrowser(this.platformId)) sessionStorage.removeItem("token");
    this.tokenSignal.set(null);
    this.router.navigate([goto]);
  }

  /**
   * Retorna el token actual.
   *
   * @returns El token o null si no existe.
   */
  public get token(): string | null {
    return this.tokenSignal();
  }

  /**
   * Indica si el usuario está logueado.
   *
   * @returns true si existe un token, false de lo contrario.
   */
  public get loggedIn(): boolean {
    return !!this.tokenSignal();
  }
}
