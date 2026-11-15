"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { loadBulkRows } from "@/lib/bulk-prices-server";
import { PRODUCT_FILTERS } from "@/lib/admin-products";
import { buildChanges, describeBulk, parseBulkParams } from "@/lib/bulk-prices";

const BASE = "/admin/productos/precios";
function go(qs: string, kind: "aviso" | "error", msg: string): never {
  revalidatePath("/", "layout");
  redirect(`${BASE}?${qs}${qs ? "&" : ""}${kind}=${encodeURIComponent(msg)}`);
}

export async function applyBulk(formData: FormData) {
  const sp = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const keep = new URLSearchParams(Object.entries(sp).filter(([k]) => ["filtro", "categoria", "q", "base", "op", "valor", "redondeo"].includes(k))).toString();
  if (sp.confirmar !== "on") go(keep, "error", "Marca la casilla de confirmación para aplicar los cambios.");
  const { params, ready, error } = parseBulkParams(sp);
  if (!ready) go(keep, "error", error ?? "Revisa los datos del cambio.");

  const { supabase } = await requireAdmin();
  const { changes } = buildChanges(await loadBulkRows(supabase, params), params);
  if (changes.length === 0) go(keep, "error", "No hay precios que cambiar con estos datos.");
  if (String(changes.length) !== sp.esperados) {
    go(keep, "error", "Los productos cambiaron desde la vista previa. Revisa la vista previa de nuevo antes de aplicar.");
  }
  const { data: cat } = params.category
    ? await supabase.from("categories").select("name").eq("slug", params.category).maybeSingle()
    : { data: null };
  const description = describeBulk(params, PRODUCT_FILTERS.find((f) => f.id === params.filter)!.label, cat?.name ?? null);

  const { data, error: rpcError } = await supabase.rpc("admin_apply_price_batch", {
    p_description: description,
    p_changes: changes.map((c) => ({ product_id: c.id, old_price: c.old, new_price: c.next })),
  });
  if (rpcError) {
    const msg = rpcError.message.includes("PRECIOS_CAMBIARON")
      ? "Alguien cambió precios mientras revisabas. Vuelve a generar la vista previa."
      : `No se pudieron aplicar los cambios: ${rpcError.message}`;
    go(keep, "error", msg);
  }
  const n = (data as { out_count: number }[] | null)?.[0]?.out_count ?? changes.length;
  go("", "aviso", `${n} ${n === 1 ? "precio actualizado" : "precios actualizados"}. Puedes deshacerlo desde el historial.`);
}

export async function undoBulk(batchId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_undo_price_batch", { p_batch: batchId });
  if (error) go("", "error", error.message.includes("LOTE_NO_DISPONIBLE") ? "Ese cambio ya se deshizo." : `No se pudo deshacer: ${error.message}`);
  const r = (data as { out_reverted: number; out_skipped: number }[] | null)?.[0];
  const skipped = r?.out_skipped ?? 0;
  go("", "aviso", `Cambio deshecho: ${r?.out_reverted ?? 0} precios restaurados.${skipped ? ` ${skipped} se dejaron como estaban porque cambiaron después o están publicados y antes no tenían precio.` : ""}`);
}
