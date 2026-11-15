import { lineKey, MAX_LINES, type PriceUpdate } from "@/lib/cart/cart";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CheckItem = { productId: string; variantId: string | null };

/** Valida el cuerpo enviado por el navegador. Devuelve null si no es válido. */
export function parseCheckBody(body: unknown): CheckItem[] | null {
  if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) return null;
  const items = (body as { items: unknown[] }).items;
  if (items.length === 0 || items.length > MAX_LINES) return null;
  const out: CheckItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") return null;
    const { productId, variantId } = it as Record<string, unknown>;
    if (typeof productId !== "string" || !UUID.test(productId)) return null;
    if (variantId !== null && (typeof variantId !== "string" || !UUID.test(variantId))) return null;
    out.push({ productId, variantId: (variantId as string | null) ?? null });
  }
  return out;
}

type DbProduct = {
  id: string;
  price_cop: number;
  availability: string;
  has_variants: boolean;
  variants: { id: string; price_cop: number | null; availability: string }[];
};

/** Precio y disponibilidad actuales para cada línea, según lo que la tienda publica hoy. */
export function priceUpdates(items: CheckItem[], products: DbProduct[]): PriceUpdate[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((it) => {
    const key = lineKey(it.productId, it.variantId);
    const p = byId.get(it.productId);
    if (!p || p.availability === "agotado") return { key, unitPrice: null, available: false };
    if (p.has_variants) {
      const v = it.variantId ? p.variants.find((x) => x.id === it.variantId) : undefined;
      if (!v || v.availability === "agotado") return { key, unitPrice: null, available: false };
      return { key, unitPrice: v.price_cop ?? p.price_cop, available: true };
    }
    if (it.variantId) return { key, unitPrice: null, available: false };
    return { key, unitPrice: p.price_cop, available: true };
  });
}
