import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environment';
import { DocPaginate } from '@shared/models';
import { Observable } from 'rxjs';

interface Key {
  code: string;
  desc: string;
}

interface KeySearch {
  page?: number;
  code?: string;
  desc?: string;
}

@Injectable({
  providedIn: 'root'
})
export class KeyService {
  private readonly http = inject(HttpClient);
  private readonly url = environment.httpUrl;

  public getKeys({ code, page = 1 }: KeySearch = {}): Observable<DocPaginate<Key>> {
    let params = new HttpParams()
      .set('page', String(page));

    if (code?.trim()) params = params.set('code', code.trim());

    return this.http.get<DocPaginate<Key>>(`${this.url}/key`, { params });
  }
}
