/**
 * Interfaz que define la paginación de resultados.
 */
interface Paginate {
    /** Total de documentos encontrados. */
    totalDocs: number;
    /** Número máximo de documentos por página. */
    limit: number;
    /** Página actual. */
    page: number;
    /** Página siguiente, o null si no existe. */
    nextPage: number | null;
    /** Página anterior, o null si no existe. */
    prevPage: number | null;
    /** Indica si existe una página siguiente. */
    hasNextPage: boolean;
    /** Indica si existe una página anterior. */
    hasPrevPage: boolean;
    /** Total de páginas. */
    totalPages: number;
}

/**
 * Interfaz que representa un documento paginado.
 *
 * @template T - Tipo de dato contenido en el arreglo.
 */
interface DocPaginate<T> {
    /** Datos (documentos) correspondientes a la página actual. */
    data: T[];
    /** Metadatos de la paginación. */
    metadata: Paginate;
}

export type { Paginate, DocPaginate };
