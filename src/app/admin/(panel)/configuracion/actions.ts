"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { brandColorWarning, isValidBrandPath, settingsFormToObject, settingsSchema } from "@/lib/settings-form";

const PATH = "/admin/configuracion";
function go(kind: "aviso" | "error", msg: string): never {
  revalidatePath("/", "layout");
  redirect(`${PATH}?${kind}=${encodeURIComponent(msg)}`);
}

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = settingsSchema.safeParse(settingsFormToObject(formData));
  if (!parsed.success) go("error", parsed.error.issues[0]?.message ?? "Revisa los datos.");
  const { error } = await supabase.from("store_settings").update(parsed.data).eq("id", 1);
  if (error) go("error", `No se pudo guardar: ${error.message}`);
  const warn = brandColorWarning(parsed.data.brand_color);
  go("aviso", `Configuración guardada. La tienda ya muestra los cambios.${warn ? ` ${warn}` : ""}`);
}

const COLUMN = { logo: "logo_path", portada: "hero_image_path" } as const;

/** Registra el logo o la foto de portada que el navegador ya subió, y borra el archivo anterior. */
export async function setBrandImage(kind: "logo" | "portada", path: string): Promise<{ ok: boolean; message?: string }> {
  if (!(kind in COLUMN) || !isValidBrandPath(path) || !path.startsWith(`marca/${kind}-`)) return { ok: false, message: "Ruta no válida." };
  const { supabase } = await requireAdmin();
  const col = COLUMN[kind];
  const { data: cur } = await supabase.from("store_settings").select(col).eq("id", 1).maybeSingle();
  const { error } = await supabase.from("store_settings").update({ [col]: path }).eq("id", 1);
  if (error) return { ok: false, message: error.message };
  const old = (cur as Record<string, string | null> | null)?.[col];
  if (old && isValidBrandPath(old) && old !== path) await supabase.storage.from("imagenes").remove([old]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeBrandImage(kind: "logo" | "portada") {
  if (!(kind in COLUMN)) return;
  const { supabase } = await requireAdmin();
  const col = COLUMN[kind];
  const { data: cur } = await supabase.from("store_settings").select(col).eq("id", 1).maybeSingle();
  await supabase.from("store_settings").update({ [col]: null }).eq("id", 1);
  const old = (cur as Record<string, string | null> | null)?.[col];
  if (old && isValidBrandPath(old)) await supabase.storage.from("imagenes").remove([old]);
  go("aviso", kind === "logo" ? "Logo quitado: la tienda muestra el nombre en texto." : "Foto de portada quitada: la portada muestra la paleta.");
}
