import { z } from "zod";
import { searchTerms } from "@/lib/catalog-params";

/** Reglas del panel de productos (puras, probadas sin base de datos). */

export const PRODUCT_FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "publicados", label: "Publicados" },
  { id: "ocultos", label: "Ocultos" },
  { id: "revision", label: "Por revisar" },
  { id: "sin-precio", label: "Sin precio" },
  { id: "variantes", label: "Variantes por resolver" },
  { id: "agotados", label: "Agotados" },
] as const;
export type ProductFilter = (typeof PRODUCT_FILTERS)[number]["id"];
export const ADMIN_PAGE_SIZE = 50;

export type ProductListParams = { q: string; filter: ProductFilter; category: string | null; page: number };

export function parseProductListParams(sp: Record<string, string | string[] | undefined>): ProductListParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const f = one(sp.filtro);
  const filter = (PRODUCT_FILTERS.find((x) => x.id === f)?.id ?? "todos") as ProductFilter;
  const cat = one(sp.categoria);
  const page = Number.parseInt(one(sp.pagina), 10);
  return {
    q: one(sp.q).replace(/\s+/g, " ").trim().slice(0, 60),
    filter,
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(cat) ? cat : null,
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

export function productListHref(p: ProductListParams, change: Partial<ProductListParams>): string {
  const n = { ...p, ...change };
  if (!("page" in change)) n.page = 1;
  const sp = new URLSearchParams();
  if (n.q) sp.set("q", n.q);
  if (n.filter !== "todos") sp.set("filtro", n.filter);
  if (n.category) sp.set("categoria", n.category);
  if (n.page > 1) sp.set("pagina", String(n.page));
  const qs = sp.toString();
  return qs ? `/admin/productos?${qs}` : "/admin/productos";
}

export { searchTerms };

// ---------------------------------------------------------------------
// ¿Se puede publicar? (mismas reglas que la base de datos, explicadas)
// ---------------------------------------------------------------------
export type PublishState = {
  price_cop: number | null;
  has_variants: boolean;
  variants_verified: boolean;
  review_notes: string | null;
  activeVariants: number;
};

export function variantsUndecided(p: Pick<PublishState, "review_notes" | "has_variants">): boolean {
  return !p.has_variants && /posible/i.test(p.review_notes ?? "");
}

export function publishBlockers(p: PublishState): string[] {
  const out: string[] = [];
  if (p.price_cop === null) out.push("Falta el precio de venta.");
  if (variantsUndecided(p)) out.push("Indica si el producto tiene tonos o presentaciones.");
  if (p.has_variants && !p.variants_verified) out.push("Marca las variantes como verificadas.");
  if (p.has_variants && p.variants_verified && p.activeVariants === 0) out.push("Tiene variantes marcadas pero ninguna activa y disponible.");
  return out;
}

// ---------------------------------------------------------------------
// Formulario de producto
// ---------------------------------------------------------------------
const money = (msg: string) =>
  z
    .string()
    .transform((s) => s.replace(/[$\s.]/g, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,9}$/, msg)]))
    .transform((s) => (s === "" ? null : Number(s)))
    .pipe(z.number().int().positive(msg).nullable());

export const VARIANT_MODES = ["no", "si-verificadas", "si-sin-verificar"] as const;

export const productFormSchema = z.object({
  name: z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(2, "Escribe el nombre.").max(200, "El nombre es demasiado largo.")),
  sku: z.string().transform((s) => s.trim()).pipe(z.string().max(40, "La referencia es demasiado larga.")).transform((s) => s || null),
  categoryId: z.uuid("Elige una categoría."),
  description: z.string().transform((s) => s.replace(/\r\n/g, "\n").trim()).pipe(z.string().max(4000, "La descripción es demasiado larga.")).transform((s) => s || null),
  availability: z.enum(["disponible", "consultar", "agotado"]),
  price: money("Escribe el precio en pesos, sin decimales."),
  cost: money("Escribe el costo en pesos, sin decimales."),
  variants: z.enum(VARIANT_MODES).optional(),
  featured: z.boolean(),
  isNew: z.boolean(),
});
export type ProductForm = z.infer<typeof productFormSchema>;

export function formToObject(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    name: s("name"),
    sku: s("sku"),
    categoryId: s("categoryId"),
    description: s("description"),
    availability: s("availability"),
    price: s("price"),
    cost: s("cost"),
    variants: fd.get("variants") === null ? undefined : s("variants"),
    featured: fd.get("featured") === "on",
    isNew: fd.get("isNew") === "on",
  };
}

/** Quita de las notas de revisión lo que ya quedó resuelto al guardar. */
export function remainingReviewNotes(notes: string | null, form: ProductForm): string | null {
  if (!notes) return null;
  const parts = notes
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !(/sin precio/i.test(p) && form.price !== null))
    .filter((p) => !(/variantes/i.test(p) && form.variants !== undefined && form.variants !== "si-sin-verificar"))
    .filter((p) => !/no aprobado/i.test(p));
  return parts.length ? parts.join("; ") : null;
}

export function slugFor(name: string, sku: string | null): string {
  const base = `${name} ${sku ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "producto";
}

// ---------------------------------------------------------------------
// Variantes
// ---------------------------------------------------------------------
export const variantFormSchema = z.object({
  name: z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "Escribe el nombre del tono.").max(80, "El nombre del tono es demasiado largo.")),
  price: money("Escribe el precio del tono en pesos, sin decimales."),
  availability: z.enum(["disponible", "consultar", "agotado"]),
  active: z.boolean(),
  imagePath: z.string().transform((s) => s.trim()).transform((s) => s || null),
});

export function variantFormToObject(fd: FormData) {
  return {
    name: String(fd.get("name") ?? ""),
    price: String(fd.get("price") ?? ""),
    availability: String(fd.get("availability") ?? "consultar"),
    active: fd.get("active") === "on",
    imagePath: String(fd.get("imagePath") ?? ""),
  };
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------
/** Ruta permitida para fotos subidas desde el panel: productos/<id del producto>/<nombre>.webp */
export function isValidUploadPath(productId: string, path: string): boolean {
  return new RegExp(`^productos/${productId}/[0-9a-f-]{36}\\.(webp|jpg|jpeg|png)$`, "i").test(path);
}

/** 31.6 → "31,6 %" */
export function formatPct(n: number): string {
  return `${String(n).replace(".", ",")} %`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
