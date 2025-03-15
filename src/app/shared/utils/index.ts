export function removeEmpty<T extends Record<string, any>>(obj?: T): Partial<T> {
    if (!obj) return {};
    return Object.fromEntries(
        Object.entries(obj)
            .filter(([_, v]) => v !== null && v !== undefined && v !== '' && v !== -1)
            .map(([k, v]) => [k, typeof v === 'object' && !Array.isArray(v) ? removeEmpty(v) : v])
    ) as Partial<T>;
}