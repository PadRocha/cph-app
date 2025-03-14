/**
 * Representa el estado de una entidad.
 *
 * Valores posibles:
 * - -1: estado inválido o no definido
 * - 0: estado que indica problemas con el item
 * - 1, 2, 3, 4, 5: estados válidos definidos en la aplicación
 */
type status = -1 | 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Parámetros de búsqueda para filtrar items.
 */
interface Search {
  // /** Página actual de la búsqueda. */
  // page: number;
  /** Texto a buscar. */
  search: string;
  /** Estado a filtrar. */
  status: status;
}

/**
 * Representa una imagen asociada a un item.
 */
interface Image {
  /** Identificador numérico de la imagen. */
  idN: number;
  /** Estado de la imagen. */
  status: status;
}

/**
 * Representa un archivo de archivo con información adicional de imagen.
 */
interface Archive {
  /** Nombre o ruta del archivo. */
  file: string;
  /** Clave asociada al archivo. */
  key: string;
  /** Código asignado. */
  code: string;
  /** Imagen asociada al archivo. */
  image: Image;
}

/**
 * Representa un item con su información principal.
 */
interface Item {
  /** Identificador único del item. */
  _id: string;
  /** Código del item. */
  code: string;
  /** Descripción del item. */
  desc: string;
  /** Lista de imágenes asociadas. */
  images: Image[];
  /** (Opcional) Cantidad de items. */
  countItems?: number;
}

/**
 * Representa una versión "lean" de un item, omitiendo _id e imágenes,
 * pero incluyendo una clave derivada.
 */
type LeanItem = Omit<Item, '_id' | "images"> & { key: string };

/**
 * Información estadística relacionada con los estados de un item.
 */
interface Info {
  /** Conteo de estados por categoría. */
  status: {
    defective: number;
    found: number;
    photographed: number;
    prepared: number;
    edited: number;
    saved: number;
  };
  /** Conteo global de éxitos. */
  success: number;
}

/**
 * Representa el resultado de una operación de borrado.
 */
interface Delete {
  /** Item eliminado. */
  data: Item;
  /** Estado de los contadores tras la eliminación. */
  deletedStatus: Info["status"];
}

/**
 * Modelo para gestionar un item y sus imágenes asociadas.
 */
class ItemModel {
  /**
   * Crea una instancia de ItemModel.
   *
   * @param item - El item a gestionar.
   */
  constructor(private item: Item) { }

  /**
   * Obtiene el identificador único del item.
   *
   * @returns El identificador del item.
   */
  public get _id() {
    return this.item._id;
  }

  /**
   * Obtiene una clave derivada a partir del código del item.
   * Se generan tomando los primeros 6 caracteres del código.
   *
   * @returns La clave derivada.
   */
  public get key() {
    return this.code.slice(0, 6);
  }

  /**
   * Obtiene el código del item.
   *
   * @returns El código del item.
   */
  public get code() {
    return this.item.code;
  }

  /**
   * Obtiene la descripción del item.
   *
   * @returns La descripción del item.
   */
  public get desc() {
    return this.item.desc;
  }

  /**
   * Retorna los identificadores de imagen (idN) cuya estado es 5,
   * ordenados de forma ascendente.
   *
   * @returns Un arreglo de números que representan los idN.
   */
  public get allIDN(): number[] {
    return this.item.images
      .filter(({ status }) => status === 5)
      .map(({ idN }) => idN)
      .sort((a, b) => a - b);
  }

  public get images(): Image[] {
    return this.item.images;
  }

  /**
   * Obtiene una representación "lean" del item.
   *
   * @returns Un objeto LeanItem con clave derivada, un segmento del código y la descripción.
   */
  public get raw(): LeanItem {
    return {
      key: this.key,
      code: this.code.slice(6, 10),
      desc: this.desc,
    };
  }

  /**
   * Actualiza el item con un nuevo valor.
   *
   * @param item - El nuevo item a asignar.
   */
  public set raw(item: Item) {
    this.item = item;
    
  }

  /**
   * Indica si el item posee al menos una imagen asociada.
   *
   * @returns True si existe al menos una imagen, false en caso contrario.
   */
  get hasAnyStatus(): boolean {
    return this.item.images.length > 0;
  }

  /**
   * Verifica si el item tiene alguna imagen con estado 5.
   *
   * @returns True si alguna imagen tiene estado 5, false de lo contrario.
   */
  public get hasImages(): boolean {
    return this.item.images.some(({ status }) => status === 5);
  }

  /**
   * Obtiene el listado de estados de todas las imágenes del item.
   *
   * @returns Un arreglo de estados.
   */
  public get allStatus(): status[] {
    return this.item.images.map(({ status }) => status);
  }

  /**
   * Determina si existe alguna imagen con el estado especificado.
   *
   * @param status - El estado a buscar.
   * @returns True si se encuentra alguna imagen con ese estado, false en caso contrario.
   */
  public hasStatus(status: status): boolean {
    return this.item.images.some(({ status: s }) => s === status);
  }

  /**
   * Verifica si todas las imágenes tienen el estado especificado.
   *
   * @param status - El estado con el que comparar.
   * @returns True si todas las imágenes tienen ese estado, false en caso contrario.
   */
  public isReseted(status: status): boolean {
    return this.item.images.every(({ status: s }) => s === status);
  }

  /**
   * Encuentra el índice de una imagen basado en su identificador.
   *
   * @param _idN - El identificador base de la imagen (se incrementa en 1 para la comparación).
   * @returns El índice de la imagen, o -1 si no se encuentra.
   */
  private findImageIndex(_idN: number): number {
    return this.item.images.findIndex(({ idN: n }) => n === (_idN + 1));
  }

  /**
   * Obtiene el estado de una imagen según su identificador.
   *
   * @param _idN - El identificador de la imagen.
   * @returns El estado de la imagen o -1 si no se encuentra.
   */
  public getStatus(_idN: number): status {
    const i = this.findImageIndex(_idN);
    if (i === -1) return -1;
    return this.item.images[i].status;
  }

  /**
   * Agrega una nueva imagen al item con el estado especificado.
   *
   * @param idN - El identificador base de la imagen.
   * @param status - El estado a asignar.
   */
  public setStatus(idN: number, status: status): void {
    this.item.images.push({ idN: idN + 1, status });
  }

  /**
   * Actualiza el estado de una imagen identificada por _idN.
   *
   * @param _idN - El identificador de la imagen a actualizar.
   * @param status - El nuevo estado (puede ser un número o su representación en cadena).
   */
  public updateStatus(_idN: number, status: status | `${status}`): void {
    if (typeof status == 'string') {
      if (!/^[0-5]$/.test(status)) return;
      status = Number(status) as status;
    }
    const i = this.findImageIndex(_idN);
    if (i === -1) return;
    this.item.images[i].status = status;
  }

  /**
   * Elimina una imagen del item basada en su identificador y retorna su estado.
   *
   * @param _idN - El identificador de la imagen a eliminar.
   * @returns El estado de la imagen eliminada o -1 si no se encontró.
   */
  public removeStatus(_idN: number): status {
    const i = this.findImageIndex(_idN);
    if (i === -1) return -1;
    const currentStatus = this.getStatus(_idN);
    this.item.images.splice(i, 1);
    return currentStatus;
  }

  /**
   * Establece las imágenes del item creando un arreglo de 3 imágenes con el estado dado.
   * Si el estado es 0 o menor, se limpia el arreglo de imágenes.
   *
   * @param status - El estado a asignar a las nuevas imágenes.
   */
  public setImages(status: status): void {
    const images = status > 0
      ? new Array(3)
        .fill(null)
        .map((_, idx) => ({ idN: idx + 1, status }))
      : [];
    this.item.images = images;
  }
}

export { ItemModel };
export type { Archive, Delete, Info, Item, LeanItem, Search, status };
