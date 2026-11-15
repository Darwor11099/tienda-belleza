import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { applyProductFilters, applyStatusFilter } from "@/lib/admin-product-query";
import { ADMIN_PAGE_SIZE, formatPct, parseProductListParams, plural, PRODUCT_FILTERS, productListHref, type ProductFilter } from "@/lib/admin-products";
import { formatCOP } from "@/lib/format";
import { grossMargin } from "@/lib/pricing";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type Row = {
  id: string; name: string; sku: string | null; price_cop: number | null; reference_price_cop: number | null;
  availability: string; is_active: boolean; needs_review: boolean; has_variants: boolean; is_featured: boolean;
  category: { name: string; slug: string } | null; cost: { cost_cop: number } | { cost_cop: number }[] | null;
};

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

async function counts(db: Db) {
  const entries = await Promise.all(
    PRODUCT_FILTERS.map(async (f) => {
      const { count } = await applyStatusFilter(db.from("products").select("id", { count: "exact", head: true }), f.id);
      return [f.id, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<ProductFilter, number>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseProductListParams(sp);
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const { supabase } = await requireAdmin();

  const { data: cats } = await supabase.from("categories").select("name, slug").order("sort_order");
  const n = await counts(supabase);

  let q = supabase
    .from("products")
    .select(
      "id, name, sku, price_cop, reference_price_cop, availability, is_active, needs_review, has_variants, is_featured, " +
        "category:categories!inner(name, slug), cost:product_costs(cost_cop)",
      { count: "exact" },
    );
  q = applyProductFilters(q, params);
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;
  const { data, count, error } = await q.order("name").range(from, from + ADMIN_PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as Row[];
  const pages = Math.ceil((count ?? 0) / ADMIN_PAGE_SIZE);

  const chip = (on: boolean) => `inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl">Productos</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/productos/precios" className="inline-flex h-11 items-center rounded-full border px-5 text-sm hover:border-primary">Cambiar precios en bloque</Link>
          <Link href="/admin/productos/nuevo" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">+ Nuevo producto</Link>
        </div>
      </div>
      {aviso && <p role="status" className="mt-4 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{aviso}</p>}

      <form action="/admin/productos" className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={params.q} placeholder="Buscar por nombre o referencia" className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-5 text-base focus:border-primary focus:outline-none" />
        {params.filter !== "todos" && <input type="hidden" name="filtro" value={params.filter} />}
        <select name="categoria" defaultValue={params.category ?? ""} className="h-11 rounded-full border border-input bg-card px-4 text-sm">
          <option value="">Todas las categorías</option>
          {(cats ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <button className="h-11 rounded-full border px-5 text-sm hover:border-primary">Buscar</button>
      </form>

      <nav aria-label="Filtros" className="-mx-4 mt-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {PRODUCT_FILTERS.map((f) => (
            <li key={f.id} className="shrink-0">
              <Link href={productListHref(params, { filter: f.id })} aria-current={f.id === params.filter ? "page" : undefined} className={chip(f.id === params.filter)}>
                {f.label} <span className={`rounded-full px-1.5 text-xs ${f.id === params.filter ? "bg-white/20" : "bg-muted"}`}>{n[f.id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error && <p role="alert" className="mt-6 text-destructive">No se pudieron cargar los productos: {error.message}</p>}
      <p className="mt-6 text-sm text-muted-foreground">{plural(count ?? 0, "producto", "productos")}</p>

      <ul className="mt-3 space-y-2">
        {rows.map((p) => {
          const cost = Array.isArray(p.cost) ? p.cost[0]?.cost_cop ?? null : p.cost?.cost_cop ?? null;
          const m = grossMargin(p.price_cop, cost);
          return (
            <li key={p.id}>
              <Link href={`/admin/productos/${p.id}`} className="grid gap-2 rounded-2xl border bg-card p-4 hover:border-primary sm:grid-cols-[1fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {p.sku ? `Ref. ${p.sku} · ` : ""}{p.category?.name}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${p.is_active ? "bg-[#e3f1e4] text-[#2f5d3a]" : "bg-muted text-muted-foreground"}`}>{p.is_active ? "Publicado" : "Oculto"}</span>
                    {p.needs_review && <span className="rounded-full bg-[#fbebd0] px-2 py-0.5 text-[#7a5410]">Por revisar</span>}
                    {p.availability === "agotado" && <span className="rounded-full bg-muted px-2 py-0.5">Agotado</span>}
                    {p.has_variants && <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">Con tonos</span>}
                    {p.is_featured && <span className="rounded-full border border-gold px-2 py-0.5">Destacado</span>}
                  </span>
                </span>
                <span className="grid grid-cols-3 gap-4 text-sm sm:text-right">
                  <span><span className="block text-xs text-muted-foreground">Venta</span>{p.price_cop ? formatCOP(p.price_cop) : <span className="text-destructive">Sin precio</span>}</span>
                  <span><span className="block text-xs text-muted-foreground">Costo</span>{cost ? formatCOP(cost) : "—"}</span>
                  <span><span className="block text-xs text-muted-foreground">Ganancia</span>{m ? formatPct(m.marginPct) : "—"}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && !error && <p className="mt-6 rounded-3xl border bg-card p-8 text-center text-muted-foreground">No hay productos con estos filtros.</p>}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {params.page > 1 && <Link href={productListHref(params, { page: params.page - 1 })} className="rounded-full border px-4 py-2">Anterior</Link>}
          <span>Página {params.page} de {pages}</span>
          {params.page < pages && <Link href={productListHref(params, { page: params.page + 1 })} className="rounded-full border px-4 py-2">Siguiente</Link>}
        </nav>
      )}
    </>
  );
}
