import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import type { IKey, Key, StatusInfo } from '@settings/models';
import { map, Observable } from 'rxjs';

type List = { data: Key[] };
type One = { data: Key };
type Reset = { data: StatusInfo };
type Delete = { data: Key; deletedStatus?: StatusInfo };

@Injectable({ providedIn: 'root' })
export class KeyService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.httpUrl}/key`;

  public searchByCode(code: string, page = 1): Observable<List> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('code', code);
    return this.http.get<List>(this.url, { params });
  }

  public getOneById(id: string): Observable<One> {
    const params = new HttpParams().set('id', id);
    return this.http.get<One>(this.url, { params });
  }

  public save(body: IKey): Observable<One> {
    return this.http.post<One>(this.url, body);
  }

  public update(id: string, patch: Partial<IKey>): Observable<One> {
    const params = new HttpParams().set('id', id);
    return this.http.put<One>(this.url, patch, { params });
  }

  public delete(id: string, forceDelete = false): Observable<Delete> {
    let params = new HttpParams().set('id', id);
    if (forceDelete) params = params.set('force', 'delete');
    return this.http.delete<Delete>(this.url, { params });
  }

  public reset(id: string, status?: number): Observable<Reset> {
    let params = new HttpParams().set('id', id);
    if (typeof status === 'number') params = params.set('status', status);
    return this.http.put<Reset>(`${this.url}/reset`, {}, { params });
  }

  /** Útil para el typeahead: devuelve solo códigos (top N). */
  public codesByPrefix(prefix: string, take = 10): Observable<string[]> {
    return this.searchByCode(prefix, 1).pipe(
      map(({data}): string[] => data.map((k) => k.code)),
      map((codes) => Array.from(new Set(codes)).slice(0, Math.max(0, take))),
    );
  }
}
