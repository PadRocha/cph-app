import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { Fuzzy, Item, PDFData, Progress, Search } from '@pdf/models';
import { DocPaginate } from '@shared/models';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.httpUrl;

  public getItems({ search, page, status }: Search): Observable<DocPaginate<Item>> {
    return this.http.get<DocPaginate<Item>>(`${this.url}/item`, { params: { search, page, status } });
  }

  /**
   * Busca items basándose en los parámetros de búsqueda actuales.
   *
   * @returns Un observable que emite un arreglo de strings.
   */
  public getFuzzy({ search, page, status }: Search): Observable<{ data: Fuzzy }> {
    return this.http.get<{ data: Fuzzy }>(`${this.url}/item/fuzzy`, { params: { search, page, status } })
  }

  public getData({ search, status }: { search: string; status: -1 | 5 }): Observable<Progress<PDFData[]>> {
    return this.http.get<{ data: PDFData[] }>(`${this.url}/pdf/data`, {
      params: { search, status },
      reportProgress: true,
      observe: 'events',
      responseType: 'json'
    }).pipe(
      map((event): Progress<PDFData[]> => {
        if (event.type === HttpEventType.DownloadProgress) {
          if (event.total) {
            const progress = Math.round((event.loaded / event.total) * 100);
            return { progress, done: false, data: [] };
          }
          return { progress: -1, done: false, data: [] };
        }
        if (event.type === HttpEventType.Response) {
          const raw = event.body?.data ?? [] as any[];
          const data = raw.map(({ _id, ...rest }) => rest);
          return { progress: 100, done: true, data };
        }
        return { progress: -1, done: false, data: [] };
      }),
    );
  }

  public getPdf(params: { search: string; status: -1 | 5 }): Observable<Progress<Blob>> {
    return this.http.get(`${this.url}/pdf`, {
      params,
      reportProgress: true,
      observe: 'events',
      responseType: 'blob'
    }).pipe(
      map((event): Progress<Blob> => {
        if (event.type === HttpEventType.DownloadProgress) {
          if (typeof event.total === 'number' && event.total > 0) {
            const pct = Math.round((event.loaded / event.total) * 100);
            return { progress: pct, done: false };
          }
          return { progress: -1, done: false };
        }
        if (event.type === HttpEventType.Response) {
          const body = event.body;
          if (!(body instanceof Blob)) throw new TypeError('Blob inválido');
          return { progress: 100, done: true, data: body };
        }
        return { progress: -1, done: false };
      })
    );
  }
}              
