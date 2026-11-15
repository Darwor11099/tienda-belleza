import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { PRODUCT_FILTERS, formatPct, plural } from "@/lib/admin-products";
import { buildChanges, describeBulk, parseBulkParams, ROUNDINGS } from "@/lib/bulk-prices";
import { loadBulkRows } from "@/lib/bulk-prices-server";
import { formatCOP } from "@/lib/format";
import { applyBulk, undoBulk } from "./actions";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const field = "mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-base focus:border-primary focus:outline-none";
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const PREVIEW_ROWS = 150;

export default async function BulkPricesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const aviso = typeof sp.aviso === "string" ? sp.aviso : null;
  const errorMsg = typeof sp.error === "string" ? sp.error : null;
  const { params, ready, error } = parseBulkParams(sp);
  const { supabase } = await requireAdmin();

  const [{ data: cats }, { data: batches }] = await Promise.all([
    supabase.from("categories").select("name, slug").order("sort_order"),
    supabase.from("price_change_batches").select("id, description, item_count, created_at, undone_at").order("created_at", { ascending: false }).limit(10),
  ]);

  const preview = ready ? buildChanges(await loadBulkRows(supabase, params), params) : null;
  const catName = (cats ?? []).find((c) => c.slug === params.category)?.name ?? null;
  const description = describeBulk(params, PRODUCT_FILTERS.find((f) => f.id === params.filter)!.label, catName);
  const belowCost = preview?.changes.filter((c) => c.belowCost).length ?? 0;
  const keepParams: [string, string][] = [
    ["filtro", params.filter], ["categoria", params.category ?? ""], ["q", params.q], ["base", params.base],
    ["op", params.op], ["valor", String(params.value).replace(".", ",")], ["redondeo", params.rounding],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/productos" className="text-sm underline underline-offset-4">← Productos</Link>
      <h1 className="text-4xl">Cambiar precios en bloque</h1>
      {aviso && <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{aviso}</p>}
      {(errorMsg || error) && <p role="alert" className="rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{errorMsg ?? error}</p>}

      <form method="get" className="space-y-5 rounded-3xl border bg-card p-5">
        <div>
          <h2 className="font-display text-2xl">1. Qué productos</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <label className="text-sm"><span className="text-muted-foreground">Grupo</span>
              <select name="filtro" defaultValue={params.filter} className={field}>
                {PRODUCT_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="text-muted-foreground">Categoría</span>
              <select name="categoria" defaultValue={params.category ?? ""} className={field}>
                <option value="">Todas</option>
                {(cats ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm"><span className="text-muted-foreground">Nombre o referencia (opcional)</span>
              <input name="q" defaultValue={params.q} placeholder="Ej.: kaba" className={field} />
            </label>
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl">2. Cómo cambian</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <label className="text-sm"><span className="text-muted-foreground">Calcular sobre</span>
              <select name="base" defaultValue={params.base} className={field}>
                <option value="venta">Precio de venta actual</option>
                <option value="detal">Precio DETAL del proveedor</option>
              </select>
            </label>
            <label className="text-sm"><span className="text-muted-foreground">Tipo de cambio</span>
              <select name="op" defaultValue={params.op} className={field}>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo (COP)</option>
              </select>
            </label>
            <label className="text-sm"><span className="text-muted-foreground">Valor (negativo para bajar)</span>
              <input name="valor" inputMode="decimal" defaultValue={ready || error ? String(sp.valor ?? "") : ""} placeholder="Ej.: 10 o -5" className={field} />
            </label>
            <label className="text-sm"><span className="text-muted-foreground">Redondeo</span>
              <select name="redondeo" defaultValue={params.rounding} className={field}>
                {ROUNDINGS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ejemplo para dar precio a productos nuevos: Grupo «Sin precio», calcular sobre «Precio DETAL», porcentaje 0 y redondeo «Sin redondear» para copiar el DETAL exacto, o el margen que quieras.</p>
        </div>
        <button className="h-12 rounded-full bg-primary px-8 font-medium text-primary-foreground">Ver vista previa</button>
      </form>

      {preview && (
        <section className="space-y-4 rounded-3xl border bg-card p-5">
          <h2 className="font-display text-2xl">3. Vista previa</h2>
          <p className="text-sm">{description}</p>
          <ul className="flex flex-wrap gap-2 text-sm">
            <li className="rounded-full bg-accent px-3 py-1 text-accent-foreground">{plural(preview.changes.length, "precio cambiará", "precios cambiarán")}</li>
            {preview.unchanged > 0 && <li className="rounded-full bg-muted px-3 py-1">{plural(preview.unchanged, "queda igual", "quedan iguales")}</li>}
            {preview.skippedNoBase > 0 && <li className="rounded-full bg-muted px-3 py-1">{plural(preview.skippedNoBase, "omitido", "omitidos")} por no tener {params.base === "detal" ? "precio DETAL" : "precio de venta"}</li>}
            {belowCost > 0 && <li className="rounded-full bg-[#f8d7da] px-3 py-1 text-destructive">{plural(belowCost, "quedaría", "quedarían")} por debajo del costo real</li>}
          </ul>
          {preview.changes.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Nuevo</th><th className="px-3 py-2 text-right">Ganancia</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.changes.slice(0, PREVIEW_ROWS).map((c) => (
                      <tr key={c.id} className={c.belowCost ? "bg-[#f8d7da]/40" : ""}>
                        <td className="px-3 py-2"><span className="line-clamp-1">{c.name}</span>{c.sku && <span className="text-xs text-muted-foreground">Ref. {c.sku}</span>}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{c.old === null ? "Sin precio" : formatCOP(c.old)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCOP(c.next)}</td>
                        <td className={`px-3 py-2 text-right ${c.belowCost ? "text-destructive" : ""}`}>{c.marginPct === null ? "—" : formatPct(c.marginPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.changes.length > PREVIEW_ROWS && <p className="text-xs text-muted-foreground">Se muestran los primeros {PREVIEW_ROWS}; el cambio se aplicará a los {preview.changes.length}.</p>}
              <form action={applyBulk} className="space-y-3 rounded-2xl bg-muted/40 p-4">
                {keepParams.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                <input type="hidden" name="esperados" value={preview.changes.length} />
                <p className="text-sm">Los productos <strong>publicados</strong> cambiarán de precio en la tienda en cuanto apliques. Los pedidos ya hechos conservan su precio. Podrás deshacerlo desde el historial.</p>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmar" className="mt-0.5 size-5" /> Confirmo que quiero cambiar {plural(preview.changes.length, "precio", "precios")}.</label>
                <button className="h-12 rounded-full bg-primary px-8 font-medium text-primary-foreground">Aplicar cambios</button>
              </form>
            </>
          )}
        </section>
      )}

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Historial de cambios masivos</h2>
        {(batches ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay cambios masivos.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {(batches ?? []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block">{b.description}</span>
                  <span className="text-xs text-muted-foreground">{fmt.format(new Date(b.created_at))} · {plural(b.item_count, "producto", "productos")}{b.undone_at ? ` · Deshecho el ${fmt.format(new Date(b.undone_at))}` : ""}</span>
                </span>
                {!b.undone_at && (
                  <form action={undoBulk.bind(null, b.id)}><button className="rounded-full border px-4 py-2 text-xs hover:border-primary">Deshacer</button></form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
