import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import type { AuthRole, User } from '@settings/models';
import { Observable } from 'rxjs';

type List = { data: User[] };
type RegisterBody = { nickname: string; password: string; roles: string[] };
type RegisterResp = { token: string };

type UpdateNickBody = { identifier?: string; nickname?: string; newNickname: string };
type UpdateNickResp = { identifier: string; nickname: string };

type UpdateRolesBody = { identifier?: string; nickname?: string; roles: string[]; op?: 'add' | 'remove' | 'set' };
type UpdateRolesResp = { identifier: string; nickname: string; roles: AuthRole[] };

type DeleteBody = { identifier?: string; nickname?: string };
type ForcePwBody = { identifier?: string; nickname?: string; newPassword: string };
type OwnPwBody = { currentPassword: string; newPassword: string };

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.httpUrl}/user`;

  /** GET /user/all (requiere ADMIN) */
  public listAll(): Observable<List> {
    return this.http.get<List>(`${this.url}/list`);
  }

  /** GET /user?nickname=xxx (permite resolver 1 usuario sin listar todo) */
  public getOneByNickname(nickname: string): Observable<User> {
    const params = new HttpParams().set('nickname', nickname.toLowerCase());
    // El handler devuelve { identifier, nickname, roles } (sin 'data')
    return this.http.get<User>(`${this.url}`, { params });
  }

  /** POST /user/register */
  public register(body: RegisterBody): Observable<RegisterResp> {
    return this.http.post<RegisterResp>(`${this.url}/register`, body);
  }

  /** PUT /user/nickname */
  public updateNickname(body: UpdateNickBody): Observable<UpdateNickResp> {
    return this.http.put<UpdateNickResp>(`${this.url}/nickname`, body);
  }

  /** PUT /user/roles */
  public updateRoles(body: UpdateRolesBody): Observable<UpdateRolesResp> {
    return this.http.put<UpdateRolesResp>(`${this.url}/roles`, body);
  }

  /** DELETE /user (con body) */
  public deleteUser(body: DeleteBody) {
    return this.http.request<void>('DELETE', `${this.url}`, { body });
  }

  /** PUT /user/password/force */
  public forcePassword(body: ForcePwBody) {
    return this.http.put<void>(`${this.url}/password/force`, body);
  }

  /** PUT /user/password (propia) */
  public changeOwnPassword(body: OwnPwBody) {
    return this.http.put<void>(`${this.url}/password`, body);
  }
}
