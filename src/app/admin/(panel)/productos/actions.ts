"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import {
  formToObject, isValidUploadPath, productFormSchema, publishBlockers, remainingReviewNotes, slugFor, variantFormSchema, variantFormToObject, type ProductForm,
} from "@/lib/admin-products";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

function go(path: string, kind: "aviso" | "error", msg: string): never {
  revalidatePath("/", "layout"); // la tienda pública refleja el cambio al instante
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
}

function variantFlags(form: ProductForm, current: { has_variants: boolean; variants_verified: boolean }) {
  switch (form.variants) {
    case "no":
      return { has_variants: false, variants_verified: false };
    case "si-verificadas":
      return { has_variants: true, variants_verified: true };
    case "si-sin-verificar":
      return { has_variants: true, variants_verified: false };
    default:
      return { has_variants: current.has_variants, variants_verified: current.variants_verified };
  }
}

async function activeVariantCount(db: Db, id: string) {
  const { count } = await db
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id)
    .eq("is_active", true)
    .neq("availability", "agotado");
  return count ?? 0;
}

async function saveCost(db: Db, id: string, cost: number | null) {
  if (cost === null) return db.from("product_costs").delete().eq("product_id", id);
  return db.from("product_costs").upsert({ product_id: id, cost_cop: cost }, { onConflict: "product_id" });
}

export async function saveProduct(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  const path = `/admin/productos/${id}`;
  const { supabase } = await requireAdmin();
  const parsed = productFormSchema.safeParse(formToObject(formData));
  if (!parsed.success) go(path, "error", parsed.error.issues[0]?.message ?? "Revisa los datos.");
  const form = parsed.data;

  const { data: cur } = await supabase
    .from("products")
    .select("is_active, has_variants, variants_verified, review_notes")
    .eq("id", id)
    .maybeSingle();
  if (!cur) go("/admin/productos", "error", "El producto no existe.");

  const flags = variantFlags(form, cur);
  let notes = remainingReviewNotes(cur.review_notes, form);
  if (flags.has_variants && !flags.variants_verified && !/variantes/i.test(notes ?? "")) {
    notes = notes ? `${notes}; variantes sin verificar` : "variantes sin verificar";
  }
  // Si con los cambios ya no cumple las reglas, se oculta en lugar de fallar
  const blockers = publishBlockers({ price_cop: form.price, ...flags, review_notes: notes, activeVariants: await activeVariantCount(supabase, id) });
  const hide = cur.is_active && blockers.length > 0;

  const { error } = await supabase
    .from("products")
    .update({
      name: form.name,
      sku: form.sku,
      category_id: form.categoryId,
      description: form.description,
      description_needs_review: false,
      availability: form.availability,
      price_cop: form.price,
      is_featured: form.featured,
      is_new: form.isNew,
      ...flags,
      review_notes: notes,
      ...(hide ? { is_active: false } : {}),
    })
    .eq("id", id);
  if (error) go(path, "error", `No se pudo guardar: ${error.message}`);

  const c = await saveCost(supabase, id, form.cost);
  if (c.error) go(path, "error", `Se guardó el producto, pero no el costo: ${c.error.message}`);

  go(path, "aviso", hide ? `Cambios guardados. El producto se ocultó: ${blockers.join(" ")}` : "Cambios guardados.");
}

export async function setPublished(id: string, publish: boolean) {
  if (!UUID.test(id)) return;
  const path = `/admin/productos/${id}`;
  const { supabase } = await requireAdmin();
  if (!publish) {
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    go(path, error ? "error" : "aviso", error ? `No se pudo ocultar: ${error.message}` : "Producto oculto. Ya no aparece en la tienda.");
  }
  const { data: p } = await supabase
    .from("products")
    .select("price_cop, has_variants, variants_verified, review_notes")
    .eq("id", id)
    .maybeSingle();
  if (!p) go("/admin/productos", "error", "El producto no existe.");
  const blockers = publishBlockers({ ...p, activeVariants: await activeVariantCount(supabase, id) });
  if (blockers.length) go(path, "error", `No se puede publicar: ${blockers.join(" ")}`);
  // Publicar es la aprobación de la encargada: se limpia la revisión pendiente
  const { error } = await supabase.from("products").update({ is_active: true, needs_review: false, review_notes: null }).eq("id", id);
  go(path, error ? "error" : "aviso", error ? `No se pudo publicar: ${error.message}` : "Producto publicado. Ya aparece en la tienda.");
}

export async function createProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = productFormSchema.safeParse(formToObject(formData));
  if (!parsed.success) go("/admin/productos/nuevo", "error", parsed.error.issues[0]?.message ?? "Revisa los datos.");
  const form = parsed.data;
  const flags = variantFlags(form, { has_variants: false, variants_verified: false });

  // Dirección web única
  const base = slugFor(form.name, form.sku);
  const { data: taken } = await supabase.from("products").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug as string));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: form.name,
      sku: form.sku,
      slug,
      category_id: form.categoryId,
      description: form.description,
      availability: form.availability,
      price_cop: form.price,
      is_featured: form.featured,
      is_new: form.isNew,
      ...flags,
      is_active: false,
      needs_review: false,
      review_notes: flags.has_variants && !flags.variants_verified ? "variantes sin verificar" : null,
      source_section: "panel",
    })
    .select("id")
    .single();
  if (error || !data) go("/admin/productos/nuevo", "error", `No se pudo crear: ${error?.message ?? "error desconocido"}`);
  await saveCost(supabase, data.id, form.cost);
  go(`/admin/productos/${data.id}`, "aviso", "Producto creado (oculto). Revísalo y pulsa «Publicar» cuando esté listo.");
}

export async function deleteProduct(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  if (formData.get("confirmar") !== "on") go(`/admin/productos/${id}`, "error", "Marca la casilla de confirmación para eliminar.");
  const { supabase } = await requireAdmin();
  // Los pedidos anteriores conservan nombre, tono y precio: se guardaron como copia
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) go(`/admin/productos/${id}`, "error", `No se pudo eliminar: ${error.message}`);
  go("/admin/productos", "aviso", "Producto eliminado.");
}

// ---------------------------------------------------------------------
// Variantes (tonos, colores, presentaciones)
// ---------------------------------------------------------------------
/** Tras tocar variantes: si el producto publicado se queda sin variantes válidas, se oculta. */
async function rehideIfNeeded(db: Db, id: string): Promise<string> {
  const { data: p } = await db.from("products").select("is_active, price_cop, has_variants, variants_verified, review_notes").eq("id", id).maybeSingle();
  if (!p?.is_active) return "";
  const blockers = publishBlockers({ ...p, activeVariants: await activeVariantCount(db, id) });
  if (!blockers.length) return "";
  await db.from("products").update({ is_active: false }).eq("id", id);
  return ` El producto se ocultó: ${blockers.join(" ")}`;
}

export async function addVariant(productId: string, formData: FormData) {
  if (!UUID.test(productId)) return;
  const path = `/admin/productos/${productId}`;
  const { supabase } = await requireAdmin();
  const v = variantFormSchema.safeParse({ ...variantFormToObject(formData), active: true });
  if (!v.success) go(path, "error", v.error.issues[0]?.message ?? "Revisa los datos del tono.");
  const { count } = await supabase.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await supabase.from("product_variants").insert({
    product_id: productId, name: v.data.name, price_cop: v.data.price, availability: v.data.availability,
    is_active: true, image_path: v.data.imagePath, sort_order: count ?? 0,
  });
  if (error) go(path, "error", error.code === "23505" ? `Ya existe un tono llamado «${v.data.name}».` : `No se pudo añadir: ${error.message}`);
  go(path, "aviso", `Tono «${v.data.name}» añadido.`);
}

export async function updateVariant(productId: string, variantId: string, formData: FormData) {
  if (!UUID.test(productId) || !UUID.test(variantId)) return;
  const path = `/admin/productos/${productId}`;
  const { supabase } = await requireAdmin();
  const v = variantFormSchema.safeParse(variantFormToObject(formData));
  if (!v.success) go(path, "error", v.error.issues[0]?.message ?? "Revisa los datos del tono.");
  const { error } = await supabase
    .from("product_variants")
    .update({ name: v.data.name, price_cop: v.data.price, availability: v.data.availability, is_active: v.data.active, image_path: v.data.imagePath })
    .eq("id", variantId)
    .eq("product_id", productId);
  if (error) go(path, "error", error.code === "23505" ? `Ya existe un tono llamado «${v.data.name}».` : `No se pudo guardar: ${error.message}`);
  go(path, "aviso", `Tono «${v.data.name}» guardado.${await rehideIfNeeded(supabase, productId)}`);
}

export async function deleteVariant(productId: string, variantId: string) {
  if (!UUID.test(productId) || !UUID.test(variantId)) return;
  const path = `/admin/productos/${productId}`;
  const { supabase } = await requireAdmin();
  // Los pedidos anteriores conservan el nombre del tono (copia en la línea del pedido)
  const { error } = await supabase.from("product_variants").delete().eq("id", variantId).eq("product_id", productId);
  if (error) go(path, "error", `No se pudo eliminar: ${error.message}`);
  go(path, "aviso", `Tono eliminado.${await rehideIfNeeded(supabase, productId)}`);
}

// ---------------------------------------------------------------------
// Fotos (el archivo lo sube el navegador; aquí se registra, ordena o borra)
// ---------------------------------------------------------------------
export async function registerImage(productId: string, storagePath: string, lowRes: boolean): Promise<{ ok: boolean; message?: string }> {
  if (!UUID.test(productId) || !isValidUploadPath(productId, storagePath)) return { ok: false, message: "Ruta de foto no válida." };
  const { supabase } = await requireAdmin();
  const [{ data: prod }, { count }] = await Promise.all([
    supabase.from("products").select("name").eq("id", productId).maybeSingle(),
    supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId),
  ]);
  if (!prod) return { ok: false, message: "El producto no existe." };
  const { error } = await supabase.from("product_images").insert({
    product_id: productId, storage_path: storagePath, alt: prod.name, sort_order: count ?? 0, is_low_res: lowRes,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function moveImage(productId: string, imageId: string, direction: "first" | "up" | "down") {
  if (!UUID.test(productId) || !UUID.test(imageId)) return;
  const path = `/admin/productos/${productId}`;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("product_images").select("id, sort_order").eq("product_id", productId).order("sort_order");
  const list = (data ?? []).map((r) => r.id as string);
  const i = list.indexOf(imageId);
  if (i < 0) go(path, "error", "La foto no existe.");
  list.splice(i, 1);
  const to = direction === "first" ? 0 : direction === "up" ? Math.max(0, i - 1) : Math.min(list.length, i + 1);
  list.splice(to, 0, imageId);
  // Reescribe el orden completo (pocas fotos por producto)
  for (const [n, id] of list.entries()) await supabase.from("product_images").update({ sort_order: n }).eq("id", id);
  go(path, "aviso", direction === "first" ? "Foto principal actualizada." : "Orden de fotos actualizado.");
}

export async function deleteImage(productId: string, imageId: string) {
  if (!UUID.test(productId) || !UUID.test(imageId)) return;
  const path = `/admin/productos/${productId}`;
  const { supabase } = await requireAdmin();
  const { data: img } = await supabase.from("product_images").select("storage_path").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (!img) go(path, "error", "La foto no existe.");
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) go(path, "error", `No se pudo quitar la foto: ${error.message}`);
  // Si ninguna variante la usa, se borra también el archivo
  await supabase.from("product_variants").update({ image_path: null }).eq("product_id", productId).eq("image_path", img.storage_path);
  if (isValidUploadPath(productId, img.storage_path)) await supabase.storage.from("imagenes").remove([img.storage_path]);
  go(path, "aviso", "Foto eliminada.");
}
