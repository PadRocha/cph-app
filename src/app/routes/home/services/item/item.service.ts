import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { environment } from '@environment';
import { DocPaginate } from '@shared/models';
import { forkJoin, lastValueFrom, map, Observable, take, tap } from 'rxjs';
import { Archive, Delete, Info, Item, ItemModel, LeanItem, Search, status } from './item.model';

/**
 * Estado inicial para la información de los items.
 */
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
};

/**
 * Parámetros de búsqueda iniciales.
 */
const initialSearch: Search = {
  page: 1,
  search: '',
  status: -1
};

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private url: string;
  private headers: HttpHeaders;
  private docs: WritableSignal<ItemModel[]>;
  private totalDocs: WritableSignal<number>;
  private limitPage: WritableSignal<number>;
  private hasNextPage: WritableSignal<boolean>;
  private page: WritableSignal<number>;
  private info: WritableSignal<Info>;
  private params: WritableSignal<Search>;
  private sortedDocs: Signal<ItemModel[]>;

  /**
   * Crea una instancia de ItemService.
   *
   * @param http - Cliente HTTP inyectado para realizar peticiones.
   */
  constructor(private http: HttpClient) {
    this.url = environment.httpUrl;
    this.headers = new HttpHeaders().set("Content-Type", "application/json");
    this.docs = signal([]);
    this.totalDocs = signal(0);
    this.limitPage = signal(25);
    this.hasNextPage = signal(false);
    this.page = signal(1);
    this.info = signal(initialInfo);
    this.params = signal(initialSearch);
    this.sortedDocs = computed(() => {
      return this.docs().slice().sort(({ code: a }, { code: b }) => (a > b ? 1 : b > a ? -1 : 0));
    });
  }

  /**
   * Obtiene la información detallada de los items.
   *
   * @returns Un observable que emite un objeto con la información de los items.
   */
  private get details(): Observable<{ data: Info }> {
    const httpParams = { params: { ...this.params(), page: this.page() } };
    return this.http.get<{ data: Info }>(`${this.url}/item/info`, httpParams);
  }

  /**
   * Obtiene una lista paginada de items.
   *
   * @returns Un observable que emite un objeto con un arreglo de ItemModel.
   */
  private get list(): Observable<{ data: ItemModel[] }> {
    const httpParams = { params: { ...this.params(), page: this.page() } };
    return this.http.get<DocPaginate<Item>>(`${this.url}/item`, httpParams)
      .pipe(
        map(({ data, metadata: { totalDocs, limit, hasNextPage, page } }): { data: ItemModel[] } => {
          this.totalDocs.set(totalDocs);
          this.limitPage.set(limit);
          this.hasNextPage.set(hasNextPage);
          this.page.set(page);
          return { data: data.map((item) => new ItemModel(item)) };
        }),
      );
  }

  /**
   * Navega a un item específico basándose en su código y dirección.
   *
   * @param code - El código del item actual.
   * @param direction - Dirección de navegación ("next" o "previous").
   * @param status - Estado para filtrar (por defecto es -1).
   * @returns Un observable que emite el ItemModel encontrado.
   */
  public navigate(code: string, direction: "next" | "previous", status: status = -1): Observable<ItemModel> {
    const httpParams = { params: { ...this.params(), code, direction, status } };
    return this.http.get<{ data: Item }>(`${this.url}/item`, httpParams)
      .pipe(map(({ data }) => new ItemModel(data)));
  }

  /**
   * Actualiza un item.
   *
   * @param id - El identificador del item a actualizar.
   * @param item - Los datos lean del item para la actualización.
   * @returns Un observable que emite el ItemModel actualizado.
   */
  public update(id: string, item: LeanItem): Observable<ItemModel> {
    const httpParams = { params: { id }, headers: this.headers };
    return this.http.put<{ data: Item }>(`${this.url}/item`, item, httpParams)
      .pipe(
        map(({ data }) => new ItemModel(data)),
        tap((doc): void => {
          const currentDocs = this.docs();
          const index = currentDocs.findIndex(({ _id }) => _id === id);
          if (index === -1) return;
          // TODO: Evaluar si esto funciona
          this.docs.update(docs => {
            const newDocs = docs.slice();
            newDocs[index] = doc;
            return newDocs;
          });
        }),
      );
  }

  /**
   * Elimina un item.
   *
   * @param id - El identificador del item a eliminar.
   * @returns Un observable que emite el ItemModel eliminado.
   */
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

  /**
   * Reinicia un item a un estado dado.
   *
   * @param id - El identificador del item a reiniciar.
   * @param status - El estado a asignar (por defecto -1).
   * @returns Un observable que emite el ItemModel reiniciado.
   */
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

  /**
   * Sube una imagen para el item especificado.
   *
   * @param id - El identificador del item.
   * @param idN - El identificador de la imagen.
   * @param form - FormData que contiene la imagen a subir.
   * @returns Un observable que emite la respuesta con el archivo de archivo.
   */
  public uploadImage(id: string, idN: number, form: FormData) {
    return this.http.put<{ data: Archive }>(`${this.url}/image`, form, { params: { id, idN } })
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const currentStatus = currentDocs[index].getStatus(idN);
        if (currentStatus === -1 || currentStatus === 5) return;
        this.replaceStatus(currentStatus, 5);
        this.addSuccess();
        this.docs.update(docs => {
          const newDocs = docs.slice();
          newDocs[index].updateStatus(idN, 5);
          return newDocs;
        });
      }));
  }

  /**
   * Elimina una imagen asociada a un item.
   *
   * @param id - El identificador del item.
   * @param idN - El identificador de la imagen a eliminar.
   * @returns Un observable que emite la respuesta de la eliminación.
   */
  public deleteImage(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.delete<{ data: Archive }>(`${this.url}/image`, httpParams)
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const currentStatus = currentDocs[index].removeStatus(idN);
        if (currentStatus === -1) return;
        this.substractStatus(currentStatus);
        this.substractSuccess();
      }));
  }

  /**
   * Elimina el estado de una imagen de un item.
   *
   * @param id - El identificador del item.
   * @param idN - El identificador de la imagen cuyo estado se desea eliminar.
   * @returns Un observable que emite la respuesta.
   */
  public deleteStatus(id: string, idN: number) {
    const httpParams = { params: { id, idN } };
    return this.http.put<{ data: Omit<Archive, 'file' | 'key'> }>(`${this.url}/item/status`, null, httpParams)
      .pipe(tap((): void => {
        const currentDocs = this.docs();
        const index = currentDocs.findIndex(({ _id }) => _id === id);
        if (index === -1) return;
        const currentStatus = currentDocs[index].removeStatus(idN);
        if (currentStatus === -1) return;
        this.substractStatus(currentStatus);
      }));
  }

  /**
   * Actualiza el estado de una imagen de un item.
   *
   * @param id - El identificador del item.
   * @param idN - El identificador de la imagen.
   * @param status - El nuevo estado a asignar.
   * @returns Un observable que emite la respuesta.
   */
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

  /**
   * Recupera datos de items y su información asociada.
   *
   * @param params - Parámetros de búsqueda opcionales.
   * @returns Un observable que emite un objeto con items e info.
   */
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

  /**
   * Carga más items incrementando la página actual.
   *
   * @returns Un observable que emite un objeto con un arreglo de ItemModel.
   */
  public get more(): Observable<{ data: ItemModel[] }> {
    this.page.update(n => n + 1);
    return this.list.pipe(
      tap(({ data }) => this.docs.update(docs => docs.concat(data)))
    );
  }

  /**
   * Obtiene todos los items ordenados.
   *
   * @returns Un arreglo de ItemModel.
   */
  public get all(): ItemModel[] {
    return this.sortedDocs();
  }

  /**
   * Verifica si no existen items.
   *
   * @returns True si no hay items, false en caso contrario.
   */
  public get noItems(): boolean {
    return this.docs().length === 0;
  }

  /**
   * Obtiene el total de items.
   *
   * @returns El número total de items.
   */
  public get total(): number {
    return this.totalDocs();
  }

  /**
   * Verifica si existe una siguiente página de items.
   *
   * @returns True si hay siguiente página, false de lo contrario.
   */
  public get hasNext(): boolean {
    return this.hasNextPage();
  }

  /**
   * Calcula el porcentaje de éxito basado en la información de items.
   *
   * @returns El porcentaje de éxito.
   */
  public get percentage(): number {
    const currentInfo = this.info();
    if (currentInfo.success === 0) return 0;
    return (100 * currentInfo.success) / this.totalDocs();
  }

  /**
   * Obtiene el límite de items por página.
   *
   * @returns El límite de items.
   */
  public get limit(): number {
    return this.limitPage();
  }

  /**
   * Obtiene la cantidad actual de items cargados.
   *
   * @returns El número de items.
   */
  public get size(): number {
    return this.docs().length;
  }

  /**
   * Reinicia los datos internos del servicio, limpiando items, total, página e info.
   */
  private clear(): void {
    this.docs.set([]);
    this.totalDocs.set(0);
    this.hasNextPage.set(false);
    this.info.set(initialInfo);
  }

  /**
   * Busca un item basándose en su código y la dirección de navegación.
   *
   * @param code - El código del item a buscar.
   * @param dir - Dirección de navegación ("previous" o "next").
   * @returns El ItemModel encontrado o null si no se encuentra.
   */
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

  /**
   * Incrementa el contador de éxitos en la información.
   */
  private addSuccess(): void {
    this.info.update(info => ({ ...info, success: info.success + 1 }));
  }

  /**
   * Decrementa el contador de éxitos en la información.
   */
  private substractSuccess(): void {
    this.info.update(info => ({ ...info, success: info.success - 1 }));
  }

  /**
   * Mapea un código de estado a su nombre correspondiente.
   *
   * @param status - El código de estado.
   * @returns La propiedad del objeto de información que corresponde al estado.
   * @throws Error si el estado es inválido.
   */
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

  /**
   * Obtiene el valor actual de una propiedad de estado en la información.
   *
   * @param status - La propiedad del estado.
   * @returns El valor asociado a la propiedad.
   */
  public statusValue(status: keyof Info["status"]): number {
    return this.info().status[status];
  }

  /**
   * Retorna el valor de la información para un código de estado específico.
   *
   * @param status - El código de estado.
   * @returns El conteo correspondiente en la información.
   */
  public getInfoStatus(status: status): number {
    const name = this.statusName(status);
    return this.info().status[name];
  }

  /**
   * Incrementa el contador para un estado específico en la información.
   *
   * @param status - El código de estado a incrementar.
   */
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

  /**
   * Decrementa el contador para un estado específico en la información.
   *
   * @param status - El código de estado a decrementar.
   */
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

  /**
   * Reemplaza un estado previo por uno nuevo actualizando los contadores en la información.
   *
   * @param pre - El estado previo.
   * @param next - El nuevo estado a asignar.
   */
  private replaceStatus(pre: status, next: status): void {
    this.substractStatus(pre);
    this.addStatus(next);
  }
}
