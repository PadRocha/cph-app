/** Parámetros de búsqueda para filtrar items. */
interface Search {
  // /** Página actual de la búsqueda. */
  // page: number;
  /** Texto a buscar. */
  search: string;
  /** Número de página. */
  page: number;
  /** Estado a filtrar. */
  status: -1 | 5;
}

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
 * Representa una imagen asociada a un item.
 */
interface Image {
  /** Identificador numérico de la imagen. */
  idN: number;
  /** Estado de la imagen. */
  status: status;
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

interface Fuzzy {
  items: string[];
  keys: string[];
}

interface PDFData {
  _id?:string;
  line: string;
  brand: string;
  key: string;
  code: string;
  desc: string;
}

interface PDF {
  _id: string;
  line: string;
  brand: string;
  items: (Item & { image: Image })[]
}

interface SectionMeta {
  key: string;
  title: string;
  lineText: string;
  items: number;
  pages: number;
  startPage: number;
  endPage: number;
};

interface Progress<T> {
  progress: number;
  done: boolean;
  data?: T;
}

export type { Fuzzy, Item, PDF, PDFData, Progress, Search, SectionMeta };
