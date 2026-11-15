import "server-only";
import { searchTerms, type ProductFilter } from "@/lib/admin-products";

/** Filtros del panel de productos aplicados a una consulta de Supabase (listado y precios masivos). */
// La consulta de supabase-js cambia de tipo con cada filtro; aquí se trata de forma genérica.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Q = any;

export function applyStatusFilter(q: Q, f: ProductFilter): Q {
  switch (f) {
    case "publicados": return q.eq("is_active", true);
    case "ocultos": return q.eq("is_active", false);
    case "revision": return q.eq("needs_review", true);
    case "sin-precio": return q.is("price_cop", null);
    case "variantes": return q.ilike("review_notes", "%variantes%");
    case "agotados": return q.eq("availability", "agotado");
    default: return q;
  }
}

export function applyProductFilters(q: Q, p: { filter: ProductFilter; category: string | null; q: string }): Q {
  let r = applyStatusFilter(q, p.filter);
  if (p.category) r = r.eq("category.slug", p.category);
  for (const t of searchTerms(p.q)) r = r.ilike("search_text", `%${t}%`);
  return r;
}
