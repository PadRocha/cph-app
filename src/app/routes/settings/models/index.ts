interface IKey {
  readonly line: string;
  readonly brand: string;
}

interface Key {
  readonly _id: string;
  readonly code: string;
}

interface ILine {
  readonly code: string;
  readonly desc: string;

}

interface Line extends ILine {
  readonly _id: string;
}

interface IBrand {
  readonly code: string;
  readonly desc: string;
}

interface Brand extends IBrand {
  readonly _id: string;
}

interface StatusInfo {
  /** Cantidad de imágenes defectuosas. */
  readonly defective: number;
  /** Cantidad de imágenes encontradas. */
  readonly found: number;
  /** Cantidad de imágenes fotografiadas. */
  readonly photographed: number;
  /** Cantidad de imágenes preparadas. */
  readonly prepared: number;
  /** Cantidad de imágenes editadas. */
  readonly edited: number;
  /** Cantidad de imágenes guardadas. */
  readonly saved: number;
}

export type { Brand, IBrand, IKey, ILine, Key, Line, StatusInfo };

