import { z } from "zod";
import { safeBrandColor, DEFAULT_BRAND } from "@/lib/theme";
import { normalizeWhatsApp } from "@/lib/whatsapp";

/** Formulario de configuración de la tienda (puro, probado). */
const text = (max: number, msg: string) =>
  z.string().transform((s) => s.replace(/\r\n/g, "\n").trim()).pipe(z.string().max(max, msg)).transform((s) => s || null);

const url = (label: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.union([z.literal(""), z.url(`El enlace de ${label} no es válido.`).max(200).refine((u) => /^https:\/\//i.test(u), `El enlace de ${label} debe empezar por https://`)]))
    .transform((s) => s || null);

export const settingsSchema = z.object({
  store_name: z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(2, "Escribe el nombre de la tienda.").max(60, "El nombre es demasiado largo.")),
  tagline: text(160, "La frase corta es demasiado larga."),
  whatsapp_number: z
    .string()
    .transform((s) => normalizeWhatsApp(s) ?? "")
    .pipe(z.string().min(1, "Escribe el WhatsApp de la tienda: celular de 10 dígitos (empieza por 3) o número internacional completo.")),
  contact_email: z.string().transform((s) => s.trim()).pipe(z.union([z.literal(""), z.email("El correo no es válido.").max(160)])).transform((s) => s || null),
  city: text(80, "La ciudad es demasiado larga."),
  business_hours: text(300, "El horario es demasiado largo."),
  delivery_info: text(1000, "La información de envíos es demasiado larga."),
  payment_info: text(1000, "La información de pagos es demasiado larga."),
  instagram_url: url("Instagram"),
  facebook_url: url("Facebook"),
  tiktok_url: url("TikTok"),
  brand_color: z.string().transform((s) => s.trim()).pipe(z.union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/, "El color debe tener el formato #A3445E.")])).transform((s) => s.toLowerCase() || null),
  hero_title: text(90, "El título de la portada es demasiado largo."),
  hero_subtitle: text(220, "El texto de la portada es demasiado largo."),
  privacy_policy: text(20000, "La política de privacidad es demasiado larga."),
  product_photos_enabled: z.boolean(),
});
export type SettingsForm = z.infer<typeof settingsSchema>;

export function settingsFormToObject(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    store_name: s("store_name"), tagline: s("tagline"), whatsapp_number: s("whatsapp_number"), contact_email: s("contact_email"),
    city: s("city"), business_hours: s("business_hours"), delivery_info: s("delivery_info"), payment_info: s("payment_info"),
    instagram_url: s("instagram_url"), facebook_url: s("facebook_url"), tiktok_url: s("tiktok_url"), brand_color: s("brand_color"),
    hero_title: s("hero_title"), hero_subtitle: s("hero_subtitle"), privacy_policy: s("privacy_policy"),
    product_photos_enabled: fd.get("product_photos_enabled") === "on",
  };
}

/** Aviso si el color elegido no se puede usar (texto blanco ilegible) y la tienda usará el predeterminado. */
export function brandColorWarning(color: string | null): string | null {
  if (!color) return null;
  return safeBrandColor(color) === DEFAULT_BRAND && color.toLowerCase() !== DEFAULT_BRAND
    ? "Ese color es demasiado claro para los botones (el texto blanco no se leería). La tienda seguirá usando el color predeterminado."
    : null;
}

/** Ruta permitida para logo y portada subidos desde el panel. */
export function isValidBrandPath(path: string): boolean {
  return /^marca\/(logo|portada)-[0-9a-f-]{36}\.webp$/i.test(path);
}
