/** Parámetros de la URL del catálogo: validación y construcción de enlaces. */
export const SORTS = ["destacados", "precio-asc", "precio-desc", "nombre"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  destacados: "Destacados",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  nombre: "Nombre (A-Z)",
};
export const PAGE_SIZE = 24;

export type CatalogParams = { q: string; category: string | null; sort: Sort; page: number };
type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseCatalogParams(sp: RawParams): CatalogParams {
  const q = first(sp.q).replace(/\s+/g, " ").trim().slice(0, 60);
  const cat = first(sp.categoria).trim();
  const category = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(cat) && cat.length <= 60 ? cat : null;
  const s = first(sp.orden) as Sort;
  const sort = SORTS.includes(s) ? s : "destacados";
  const p = Number.parseInt(first(sp.pagina), 10);
  const page = Number.isFinite(p) && p >= 1 && p <= 1000 ? p : 1;
  return { q, category, sort, page };
}

/** Enlace al catálogo cambiando solo lo indicado. Un cambio de filtro vuelve a la página 1. */
export function catalogHref(current: CatalogParams, change: Partial<CatalogParams>): string {
  const next = { ...current, ...change };
  if (!("page" in change)) next.page = 1;
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.category) sp.set("categoria", next.category);
  if (next.sort !== "destacados") sp.set("orden", next.sort);
  if (next.page > 1) sp.set("pagina", String(next.page));
  const qs = sp.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

/**
 * Términos de búsqueda normalizados (sin tildes, minúsculas, solo letras y números).
 * Al eliminar símbolos, ningún término puede alterar el filtro (% _ , ( ) etc.).
 */
export function searchTerms(q: string): string[] {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 5);
}

/** Números de página a mostrar: 1 … 4 5 [6] 7 8 … 20 */
export function pageList(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const set = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - (sorted[i - 1] as number) > 1) out.push("…");
    out.push(n);
  });
  return out;
}
