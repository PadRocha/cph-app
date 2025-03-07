interface Paginate {
    totalDocs: number;
    limit: number;
    page: number;
    nextPage: number | null;
    prevPage: number | null;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    totalPages: number;
}

interface DocPaginate<T> {
    data: T[];
    metadata: Paginate;
}

export type { Paginate, DocPaginate };