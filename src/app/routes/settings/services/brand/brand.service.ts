import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import type { IBrand, Brand } from '@settings/models';
import { map, Observable } from 'rxjs';

type One = { data: Brand };
type List = { data: Brand[] };
type Delete = { data: Brand; deletedStatus?: unknown };

@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.httpUrl}/brand`;

  public getOneById(id: string): Observable<One> {
    const params = new HttpParams().set('id', id);
    return this.http.get<One>(this.url, { params });
  }

  public getAll(): Observable<List> {
    return this.http.get<List>(this.url);
  }

  public save(body: IBrand): Observable<One> {
    return this.http.post<One>(this.url, body);
  }

  public update(id: string, patch: Partial<IBrand>): Observable<One> {
    const params = new HttpParams().set('id', id);
    return this.http.put<One>(this.url, patch, { params });
  }

  public delete(id: string, forceDelete = false): Observable<Delete> {
    let params = new HttpParams().set('id', id);
    if (forceDelete) params = params.set('force', 'delete');
    return this.http.delete<Delete>(this.url, { params });
  }

  /** Útil para typeahead desde catálogo completo. */
  public codesByPrefix(prefix: string, take = 10): Observable<string[]> {
    return this.getAll().pipe(
      map(({ data }) => data.map(b => b.code)),
      map(codes => {
        const p = (prefix || '').toUpperCase();
        const starts = codes.filter(c => c.toUpperCase().startsWith(p));
        const contains = codes.filter(c => !c.toUpperCase().startsWith(p) && c.toUpperCase().includes(p));
        return Array.from(new Set([...starts, ...contains])).slice(0, Math.max(0, take));
      })
    );
  }
}
