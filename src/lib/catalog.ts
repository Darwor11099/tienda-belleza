import { PAGE_SIZE, searchTerms, type CatalogParams } from "@/lib/catalog-params";
import { createPublicClient } from "@/lib/supabase/public";
import type { ProductCard, ProductDetail } from "@/lib/catalog-view";

/**
 * Lecturas públicas del catálogo. Siempre con columnas explícitas:
 * la API pública no tiene permiso sobre el precio DETAL ni el costo,
 * y las reglas RLS solo devuelven productos activos (aprobados y con precio).
 */
const CARD_SELECT =
  "id, slug, name, sku, price_cop, availability, has_variants, is_new, " +
  "category:categories!inner(slug, name), " +
  "images:product_images(storage_path, alt, sort_order), " +
  "variants:product_variants(id, price_cop, availability)";

const DETAIL_SELECT =
  "id, slug, name, sku, description, price_cop, availability, has_variants, is_new, category_id, " +
  "category:categories!inner(slug, name), " +
  "images:product_images(storage_path, alt, sort_order), " +
  "variants:product_variants(id, name, price_cop, availability, image_path, sort_order)";

export type CatalogResult =
  | { ok: true; items: ProductCard[]; total: number; page: number; pageCount: number }
  | { ok: false; reason: "sin-configurar" | "error"; message?: string };

export async function getCatalog(params: CatalogParams): Promise<CatalogResult> {
  const db = createPublicClient();
  if (!db) return { ok: false, reason: "sin-configurar" };

  let query = db.from("products").select(CARD_SELECT, { count: "exact" }).eq("is_active", true);
  if (params.category) query = query.eq("category.slug", params.category);
  for (const term of searchTerms(params.q)) query = query.ilike("search_text", `%${term}%`);

  switch (params.sort) {
    case "precio-asc":
      query = query.order("price_cop", { ascending: true }).order("name");
      break;
    case "precio-desc":
      query = query.order("price_cop", { ascending: false }).order("name");
      break;
    case "nombre":
      query = query.order("name");
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("is_new", { ascending: false }).order("name");
  }

  const from = (params.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) {
    // Pedir una página que no existe devuelve error de rango: se trata como vacía
    if (error.code === "PGRST103") return { ok: true, items: [], total: count ?? 0, page: params.page, pageCount: 0 };
    return { ok: false, reason: "error", message: error.message };
  }
  const total = count ?? 0;
  return { ok: true, items: (data ?? []) as unknown as ProductCard[], total, page: params.page, pageCount: Math.ceil(total / PAGE_SIZE) };
}

export async function getProductsWhere(
  kind: "featured" | "new" | "latest" | "related",
  opts: { limit: number; categoryId?: string; excludeId?: string },
): Promise<ProductCard[]> {
  const db = createPublicClient();
  if (!db) return [];
  let query = db.from("products").select(CARD_SELECT).eq("is_active", true);
  if (kind === "featured") query = query.eq("is_featured", true);
  if (kind === "new") query = query.eq("is_new", true);
  if (kind === "related" && opts.categoryId) query = query.eq("category_id", opts.categoryId);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);
  query = kind === "latest" ? query.order("created_at", { ascending: false }) : query.order("name");
  const { data, error } = await query.limit(opts.limit);
  if (error) return [];
  return (data ?? []) as unknown as ProductCard[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const db = createPublicClient();
  if (!db) return null;
  const { data, error } = await db.from("products").select(DETAIL_SELECT).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  const p = data as unknown as ProductDetail;
  p.images = [...p.images].sort((a, b) => a.sort_order - b.sort_order);
  p.variants = [...p.variants].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return p;
}
