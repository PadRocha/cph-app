import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { environment } from '@environment';
import { DocPaginate } from '@shared/models';
import { forkJoin, lastValueFrom, map, Observable, take, tap } from 'rxjs';
import { Archive, Delete, Info, Item, ItemModel, LeanItem, Search, status } from './item.model';

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
  private docs: WritableSignal<ItemModel[]>;
  private total_docs: WritableSignal<number>;
  private limit_page: WritableSignal<number>;
  private has_next_page: WritableSignal<boolean>;
  private page: WritableSignal<number>;
  private info: WritableSignal<Info>;
  private params: WritableSignal<Search>;
  private sortedDocs: Signal<ItemModel[]>;

  constructor(private http: HttpClient) {
    this.url = environment.httpUrl;
    this.headers = new HttpHeaders().set("Content-Type", "application/json");
    this.docs = signal([]);
    this.total_docs = signal(0);
    this.limit_page = signal(25);
    this.has_next_page = signal(false);
    this.page = signal(1);
    this.info = signal(initialInfo);
    this.params = signal(initialSearch);
    this.sortedDocs = computed(() => {
      return this.docs().slice().sort(({ code: a }, { code: b }) => (a > b ? 1 : b > a ? -1 : 0));
    });
  }

  private get details(): Observable<{ data: Info }> {
    const httpParams = { params: { ...this.params(), page: this.page() } };
    return this.http.get<{ data: Info }>(`${this.url}/item/info`, httpParams);
  }

  private get list(): Observable<{ data: ItemModel[] }> {
    const httpParams = { params: { ...this.params(), page: this.page() } };
    return this.http.get<DocPaginate<Item>>(`${this.url}/item`, httpParams)
      .pipe(
        map(({ data, metadata: { totalDocs, limit, hasNextPage, page } }): { data: ItemModel[] } => {
          this.total_docs.set(totalDocs);
          this.limit_page.set(limit);
          this.has_next_page.set(hasNextPage);
          this.page.set(page);
          return { data: data.map((item) => new ItemModel(item)) };
        }),
      );
  }

  public navigate(code: string, direction: "next" | "previous", status: status = -1): Observable<ItemModel> {
    const httpParams = { params: { ...this.params(), code, direction, status } };
    return this.http.get<{ data: Item }>(`${this.url}/item`, httpParams)
      .pipe(map(({ data }) => new ItemModel(data)));
  }

  public update(id: string, item: LeanItem): Observable<ItemModel> {
    const httpParams = { params: { id }, headers: this.headers };
    return this.http.put<{ data: Item }>(`${this.url}/item`, item, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap((doc): void => {
          const currentDocs = this.docs();
          const index = currentDocs.findIndex(({ _id }) => _id === id);
          if (index === -1) return;
          //TODO: Evaluar si esto funciona
          this.docs.update(docs => {
            const newDocs = docs.slice();
            newDocs[index] = doc;
            return newDocs;
          });
        }),
      );
  }

  public delete(id: string): Observable<ItemModel> {
    const httpParams = { params: { id } };
    return this.http.delete<Delete>(`${this.url}/item`, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap(async (): Promise<void> => {
          const currentDocs = this.docs();
          const index = currentDocs.findIndex(({ _id }) => _id === id);
          if (index === -1) return;
          if (currentDocs[index].hasStatus(5)) this.substractSuccess();
          for (const stat of currentDocs[index].allStatus) {
            this.substractStatus(stat);
          }
          this.docs.update(docs => {
            const newDocs = docs.slice();
            newDocs.splice(index, 1);
            return newDocs;
          });
          try {
            const last = this.docs().at(-1);
            if (!last) return;
            const next = await lastValueFrom(this.navigate(last.code, "next"));
            for (const stat of next.allStatus) this.addStatus(stat);
            this.docs.update(docs => {
              const newDocs = docs.slice();
              newDocs.push(next);
              return newDocs;
            });
          } catch {
            return;
          }
        }),
      );
  }

  public reset(id: string, status: status = -1): Observable<ItemModel> {
    const httpParams = { params: { id }, headers: this.headers };
    return this.http.put<Delete>(`${this.url}/item/reset`, { status }, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap((): void => {
          const currentDocs = this.docs();
          const index = currentDocs.findIndex(({ _id }) => _id === id);
          if (index === -1) return;
          if (currentDocs[index].hasStatus(5)) this.substractSuccess();
          for (const stat of currentDocs[index].allStatus) this.substractStatus(stat);
          if (status !== -1) {
            this.docs.update(docs => {
              const newDocs = docs.slice();
              newDocs[index].setImages(status);
              return newDocs;
            });
            for (const stat of this.docs()[index].allStatus) {
              this.addStatus(stat);
            }
          }
        })
      );
  }

  public uploadImage(id: string, idN: number, form: FormData) {
    return this.http.put<{ data: Archive }>(`${this.url}/image`, form, { params: { id, idN } })
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const current_status = currentDocs[index].getStatus(idN);
        if (current_status === -1 || current_status === 5) return;
        this.replaceStatus(current_status, 5);
        this.addSuccess();
        this.docs.update(docs => {
          const newDocs = docs.slice();
          newDocs[index].updateStatus(idN, 5);
          return newDocs;
        });
      }));
  }

  public deleteImage(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.delete<{ data: Archive }>(`${this.url}/image`, httpParams)
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const current_status = currentDocs[index].removeStatus(idN);
        if (current_status === -1) return;
        this.substractStatus(current_status);
        this.substractSuccess();
      }));
  }

  public deleteStatus(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.put<{ data: Omit<Archive, 'file' | 'key'> }>(`${this.url}/item/status`, null, httpParams)
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const current_status = currentDocs[index].removeStatus(idN);
        if (current_status === -1) return;
        this.substractStatus(current_status);
      }));
  }

  public updateStatus(id: string, idN: number, status: status) {
    const httpParams = { params: { id, idN }, headers: this.headers };
    return this.http.put<{ data: Omit<Archive, 'file' | 'key'> }>(`${this.url}/item/status`, { status }, httpParams)
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const prev_status = currentDocs[index].getStatus(idN);
        if (prev_status !== -1) {
          this.replaceStatus(prev_status, status);
          this.docs.update(docs => {
            const newDocs = docs.slice();
            newDocs[index].updateStatus(idN, status);
            return newDocs;
          });
        } else {
          this.docs.update(docs => {
            const newDocs = docs.slice();
            newDocs[index].setStatus(idN, status);
            return newDocs;
          });
          this.addStatus(status);
        }
      }));
  }

  public getData(params?: Search) {
    if (params) this.params.set(params);
    this.page.set(1);
    this.clear();
    return forkJoin({
      items: this.list.pipe(take(1)),
      info: this.details.pipe(take(1)),
    }).pipe(
      tap(({ items: { data }, info: { data: info } }): void => {
        this.docs.set(data);
        this.info.set(info);
      })
    );
  }

  public get more(): Observable<{ data: ItemModel[] }> {
    this.page.update(n => n + 1);
    return this.list.pipe(
      tap(({ data }) => this.docs.update(docs => docs.concat(data)))
    );
  }

  public get all(): ItemModel[] {
    return this.sortedDocs();
  }

  public get noItems(): boolean {
    return this.docs().length === 0;
  }

  public get total(): number {
    return this.total_docs();
  }

  public get hasNext(): boolean {
    return this.has_next_page();
  }

  public get percentage(): number {
    const currentInfo = this.info();
    if (currentInfo.success === 0) return 0;
    return (100 * currentInfo.success) / this.total_docs();
  }

  public get limit(): number {
    return this.limit_page();
  }

  public get size(): number {
    return this.docs().length;
  }

  private clear(): void {
    this.docs.set([]);
    this.total_docs.set(0);
    this.has_next_page.set(false);
    this.info.set(initialInfo);
  }

  public find(code: string, dir: "previous" | "next"): ItemModel | null {
    const currentDocs = this.docs();
    if (currentDocs.length <= 1) return null;
    let index = currentDocs.findIndex(({ code: curr }) => curr === code);
    if (index === -1) return null;
    do {
      if (dir === "previous") {
        index--;
        if (index < 0) break;
      } else {
        index++;
        if (index >= currentDocs.length) break;
      }
    } while (!currentDocs[index].hasImages);
    if (index >= 0 && index < currentDocs.length) return currentDocs[index];
    return null;
  }

  private addSuccess(): void {
    this.info.update(info => ({ ...info, success: info.success + 1 }));
  }

  private substractSuccess(): void {
    this.info.update(info => ({ ...info, success: info.success - 1 }));
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
    return this.info().status[status];
  }

  public getInfoStatus(status: status): number {
    const name = this.statusName(status);
    return this.info().status[name];
  }

  private addStatus(status: status): void {
    const name = this.statusName(status);
    this.info.update(info => ({
      ...info,
      status: {
        ...info.status,
        [name]: info.status[name] + 1,
      },
    }));
  }

  private substractStatus(status: status): void {
    const name = this.statusName(status);
    this.info.update(info => ({
      ...info,
      status: {
        ...info.status,
        [name]: info.status[name] - 1,
      },
    }));
  }

  private replaceStatus(pre: status, next: status): void {
    this.substractStatus(pre);
    this.addStatus(next);
  }
}
