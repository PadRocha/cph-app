import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import type { ILine, Line, StatusInfo } from '@settings/models';
import { map, Observable } from 'rxjs';

type One = { data: Line };
type List = { data: Line[] };
type Delete = { data: Line; deletedStatus?: StatusInfo };

@Injectable({ providedIn: 'root' })
export class LineService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.httpUrl}/line`;

  public getOneById(id: string): Observable<One> {
    const params = new HttpParams().set('id', id);
    return this.http.get<One>(this.url, { params });
  }

  public getAll(): Observable<List> {
    return this.http.get<List>(this.url);
  }

  public save(body: ILine): Observable<One> {
    return this.http.post<One>(this.url, body);
  }

  public update(id: string, patch: Partial<ILine>): Observable<One> {
    const params = new HttpParams().set('id', id);
    // Nota: aunque el doc de ejemplo dice /api/brand, el handler usa LineModel; aquí usamos /api/line.
    return this.http.put<One>(this.url, patch, { params });
  }

  public delete(id: string, forceDelete = false): Observable<Delete> {
    let params = new HttpParams().set('id', id);
    if (forceDelete) params = params.set('force', 'delete');
    return this.http.delete<Delete>(this.url, { params });
  }

  /** Auxiliar para typeahead: filtra top N códigos desde getAll (no hay filtro por code en el backend). */
  public codesByPrefix(prefix: string, take = 10): Observable<string[]> {
    return this.getAll().pipe(
      map(({ data }) => data.map(l => l.code)),
      map(codes => {
        const p = (prefix || '').toUpperCase();
        const starts = codes.filter(c => c.toUpperCase().startsWith(p));
        const contains = codes.filter(c => !c.toUpperCase().startsWith(p) && c.toUpperCase().includes(p));
        return Array.from(new Set([...starts, ...contains])).slice(0, Math.max(0, take));
      })
    );
  }
}
