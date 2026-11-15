import "server-only";
import type { requireAdmin } from "@/lib/admin";
import { applyProductFilters } from "@/lib/admin-product-query";
import type { ProductFilter } from "@/lib/admin-products";
import type { BulkRow } from "@/lib/bulk-prices";

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/** Productos del alcance elegido (el mismo cálculo para la vista previa y para aplicar). */
export async function loadBulkRows(db: Db, p: { filter: ProductFilter; category: string | null; q: string }): Promise<BulkRow[]> {
  const q = db
    .from("products")
    .select("id, name, sku, price_cop, reference_price_cop, category:categories!inner(slug, name), cost:product_costs(cost_cop)");
  const { data } = await applyProductFilters(q, p).order("name").range(0, 1999);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, name: r.name, sku: r.sku, price_cop: r.price_cop, reference_price_cop: r.reference_price_cop,
    cost: Array.isArray(r.cost) ? r.cost[0]?.cost_cop ?? null : r.cost?.cost_cop ?? null,
  }));
}
