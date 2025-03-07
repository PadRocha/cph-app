import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@environment';
import { DocPaginate } from '@shared/models';
import { forkJoin, lastValueFrom, map, Observable, take, tap } from 'rxjs';
import { Item, Info, ItemModel, LeanItem, Search, status, Delete, Archive } from './item.model';

const initialInfo: Info = {
  status: {
    defective: 0,
    found: 0,
    photographed: 0,
    prepared: 0,
    edited: 0,
    saved: 0,
  },
  success: 0
}
const initialSearch: Search = {
  page: 1,
  search: '',
  status: -1
}

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private url: string;
  private headers: HttpHeaders;
  private docs: ItemModel[];
  private total_docs: number;
  private limit_page: number;
  private has_next_page: boolean;
  private page: number;
  private info: Info;
  private params: Search;

  constructor(private http: HttpClient) {
    this.url = environment.httpUrl;
    this.headers = new HttpHeaders().set("Content-Type", "application/json");
    this.docs = [];
    this.total_docs = 0;
    this.limit_page = 25;
    this.has_next_page = false;
    this.page = 1;
    this.info = initialInfo;
    this.params = initialSearch;
  }

  private get details(): Observable<{ data: Info }> {
    return this.http.get<{ data: Info }>(`${this.url}/item/info`, {
      params: {
        ...this.params,
        page: this.page,
      },
    });
  }

  public get list(): Observable<{ data: ItemModel[] }> {
    const httpParams = { params: { ...this.params, page: this.page } };
    return this.http.get<DocPaginate<Item>>(`${this.url}/item`, httpParams)
      .pipe(
        map(({ data, metadata: { totalDocs, limit, hasNextPage, page } }): { data: ItemModel[] } => {
          this.total_docs = totalDocs;
          this.limit_page = limit;
          this.has_next_page = hasNextPage;
          this.page = page;
          return { data: data.map((item) => new ItemModel(item)) };
        }),
      );
  }

  public navigate(code: string, direction: "next" | "previous", status: status = -1): Observable<ItemModel> {
    const httpParams = { params: { ...this.params, code, direction, status } };
    return this.http.get<{ data: Item }>(`${this.url}/item`, httpParams)
      .pipe(map(({ data }) => new ItemModel(data)));
  }

  public update(id: string, item: LeanItem): Observable<ItemModel> {
    const httpParams = { params: { id }, headers: this.headers };
    return this.http.put<{ data: Item }>(`${this.url}/item`, item, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap((doc) => {
          const i = this.docs.findIndex(({ _id }) => _id === id);
          if (i === -1) return;
          this.docs[i] = doc;
        }),
      );
  }

  public delete(id: string) {
    const httpParams = { params: { id } };
    return this.http.delete<Delete>(`${this.url}/item`, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap(async () => {
          const i = this.docs.findIndex(({ _id }) => _id === id);
          if (i === -1) return;
          if (this.docs[i].hasStatus(5)) this.substractSuccess();
          const all_status = this.docs[i].allStatus;
          for (const _ of all_status) this.substractStatus(_);
          this.docs.splice(i, 1);
          try {
            const last = this.docs.at(-1);
            if (!last) return;
            const next = await lastValueFrom(this.navigate(last.code, "next"));
            for (const s of next.allStatus) this.addStatus(s);
            this.docs.push(next);
          } catch {
            return;
          }
        }),
      );
  }

  public reset(id: string, status: status = -1) {
    const httpParams = { params: { id }, headers: this.headers };
    return this.http.put<Delete>(`${this.url}/item/reset`, { status }, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap(() => {
          const i = this.docs.findIndex(({ _id }) => _id === id);
          if (i === -1) return;
          if (this.docs[i].hasStatus(5)) this.substractSuccess();
          const all_status = this.docs[i].allStatus;
          for (const _ of all_status) {
            this.substractStatus(_);
          }
          this.docs[i].setImages(status);
          if (status !== null)
            for (const s of this.docs[i].allStatus) this.addStatus(s);
        })
      );
  }

  public uploadImage(id: string, idN: number, form: FormData) {
    return this.http.put<{ data: Archive }>(`${this.url}/image`, form, { params: { id, idN } })
      .pipe(tap(() => {
        const i = this.docs.findIndex(({ _id }) => _id === id);
        if (i === -1) return;
        const status = this.docs[i].getStatus(idN);
        if (status === null || status === 5) return;
        this.replaceStatus(status, 5);
        this.addSuccess();
        this.docs[i].updateStatus(idN, 5);
      }));
  }

  public deleteImage(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.delete<{ data: Archive }>(`${this.url}/image`, httpParams)
      .pipe(tap(() => {
        const i = this.docs.findIndex(({ _id }) => _id === id);
        if (i === -1) return;
        const status = this.docs[i].removeStatus(idN - 1);
        if (status === null) return;
        this.substractStatus(status);
        this.substractSuccess();
      }));
  }

  public deleteStatus(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.put<{ data: Omit<Archive, 'file' | 'key'> }>(`${this.url}/item/status`, null, httpParams)
      .pipe(tap(() => {
        const i = this.docs.findIndex(({ _id }) => _id === id);
        if (i === -1) return;
        const status = this.docs[i].removeStatus(idN);
        if (status === null) return;
        this.substractStatus(status);
      }));
  }

  public updateStatus(id: string, idN: number, status: status) {
    const httpParams = { params: { id, idN }, headers: this.headers };
    return this.http.put<{ data: Omit<Archive, 'file' | 'key'> }>(`${this.url}/item/status`, { status }, httpParams)
      .pipe(tap(() => {
        const i = this.docs.findIndex(({ _id }) => _id === id);
        if (i === -1) return;
        const prev_status = this.docs[i].getStatus(idN);
        if (prev_status !== null) {
          this.replaceStatus(prev_status, status);
          this.docs[i].updateStatus(idN, status);
        } else {
          this.docs[i].setStatus(idN, status);
          this.addStatus(status);
        }
      }));
  }

  public getData(params?: Search) {
    if (!!params) this.params = params;
    this.page = 1;
    this.clear();
    return forkJoin({
      items: this.list.pipe(take(1)),
      info: this.details.pipe(take(1)),
    }).pipe(
      tap(({ items: { data }, info: { data: info } }) => {
        this.docs = data;
        this.info = info;
      })
    );
  }

  public more() {
    ++this.page;
    return this.list.pipe(
      tap(({ data }) => this.docs = this.docs.concat(data))
    );
  }

  public get getAll(): ItemModel[] {
    return this.docs.sort(({ code: a }, { code: b }) => a > b ? 1 : b > a ? -1 : 0);
  }

  public get noItems(): boolean {
    return this.docs.length === 0;
  }

  public get totalDocs(): number {
    return this.total_docs;
  }

  public get hasNextPage(): boolean {
    return this.has_next_page;
  }

  public get percentage(): number {
    if (!this.info?.success || this.info.success === 0) return 0;
    return (100 * this.info.success) / this.total_docs;
  }

  public get limitPage(): number {
    return this.limit_page;
  }

  public get size(): number {
    return this.docs.length;
  }

  private clear(): void {
    this.docs = [];
    this.total_docs = 0;
    this.has_next_page = false;
    this.info = initialInfo;
  }

  public find(code: string, dir: "prev" | "next"): ItemModel | null {
    if (this.docs.length <= 1) return null;
    let i = this.docs.findIndex(({ code: curr }) => curr === code);
    if (i === -1) return null;
    do {
      if (dir === "prev") {
        --i;
        if (i < 0) break;
      } else {
        ++i;
        if (i >= this.docs.length) break;
      }
    } while (!this.docs[i].hasImages);
    if (i >= 0 && i < this.docs.length) return this.docs[i];
    return null;
  }

  private addSuccess(): void {
    ++this.info.success;
  }

  private substractSuccess(): void {
    --this.info.success;
  }

  public statusName(status: status): keyof Info["status"] {
    switch (status) {
      case 0:
        return "defective";
      case 1:
        return "found";
      case 2:
        return "photographed";
      case 3:
        return "prepared";
      case 4:
        return "edited";
      case 5:
        return "saved";
      default:
        throw new Error("Invalid status");
    }
  }

  public statusValue(status: keyof Info["status"]): number {
    return this.info?.status[status] || 0;
  }

  public getInfoStatus(status: status): number {
    const name = this.statusName(status);
    return this.info.status[name];
  }

  private addStatus(status: status): void {
    const name = this.statusName(status);
    ++this.info.status[name];
  }

  private substractStatus(status: status): void {
    const name = this.statusName(status);
    --this.info.status[name];
  }

  private replaceStatus(pre: status, next: status): void {
    this.substractStatus(pre);
    this.addStatus(next);
  }
}
