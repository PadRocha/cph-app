import { HttpClient } from '@angular/common/http';
import { effect, Inject, Injectable, InjectionToken, PLATFORM_ID, signal, WritableSignal } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/** Roles de autentificación */
type authRole = "READ" | "WRITE" | "EDIT" | "GRANT" | "ADMIN";

/**
 * Representa la identidad del usuario.
 */
interface UserIdentity {
  /** Identificador único del usuario. */
  identifier: string | null;
  /** Nickname o alias del usuario. */
  nickname: string | null;
  /** Roles asignados al usuario. */
  roles: authRole[];
}

/**
 * Identidad inicial, sin datos.
 */
const initialIdentity: UserIdentity = {
  identifier: null,
  nickname: null,
  roles: [],
};

@Injectable({
  providedIn: "root",
})
export class UserService extends AuthService {
  /** Señal que almacena la identidad actual del usuario. */
  private userSignal = signal(initialIdentity);
  /** BehaviorSubject que emite cada vez que cambia la identidad del usuario. */
  private userChange$ = new BehaviorSubject<UserIdentity>(initialIdentity);
  userChange = effect(() => {
    const currentUser = this.userSignal();
    this.userChange$.next(currentUser);
  });

  constructor() {
    super();
    // Si está logueado, se suscribe a la actualización de la identidad
    if (this.loggedIn) {
      this.update.subscribe({
        next: (info) => {
          this.info = info;
        },
        error: () => {
          this.destroy();
        }
      });
    }
  }

  /**
   * Realiza una petición para obtener la identidad del usuario.
   *
   * @returns Observable que emite la identidad del usuario.
   */
  public get update(): Observable<UserIdentity> {
    return this.http.get<UserIdentity>(`${this.url}/user/info`);
  }

  /**
   * Resetea la identidad del usuario a su estado inicial.
   */
  public destroy(): void {
    this.userSignal.set(initialIdentity);
  }

  /**
   * Obtiene la identidad actual del usuario.
   *
   * @returns El objeto UserIdentity actual.
   */
  public get info(): UserIdentity {
    return this.userSignal();
  }

  /**
   * Establece la identidad del usuario.
   *
   * @param data - Objeto con la identidad del usuario.
   */
  public set info(data: UserIdentity) {
    this.userSignal.set(data);
  }

  /**
   * Obtiene el identificador del usuario.
   *
   * @returns El identificador o null.
   */
  public get getId(): string | null {
    return this.userSignal().identifier;
  }

  /**
   * Indica si el usuario tiene asignado un identificador.
   *
   * @returns True si el usuario está definido, false en caso contrario.
   */
  public get logged(): boolean {
    return !!this.getId;
  }

  /**
   * Compara el identificador del usuario con otro valor.
   *
   * @param _id - El identificador a comparar.
   * @returns True si son iguales, false en caso contrario.
   */
  public isEqualTo(_id: string): boolean {
    return this.getId === _id;
  }

  /**
   * Obtiene el nickname del usuario.
   *
   * @returns El nickname o null.
   */
  public get nickname(): string | null {
    return this.userSignal().nickname;
  }

  /**
   * Obtiene los roles asignados al usuario.
   *
   * @returns Arreglo de roles.
   */
  public get roles(): authRole[] {
    return this.userSignal().roles;
  }

  /**
   * Verifica si el usuario posee al menos uno de los roles especificados.
   *
   * @param roles - Lista de roles a comprobar.
   * @returns True si posee alguno, false de lo contrario.
   */
  public hasRole(...roles: authRole[]): boolean {
    return roles.some((r) => this.roles.includes(r));
  }

  /**
   * Expone un observable que emite cambios en la identidad del usuario.
   *
   * @returns Observable de UserIdentity.
   */
  public get userSync(): Observable<UserIdentity> {
    return this.userChange$.asObservable();
  }
}

export type { UserIdentity };
