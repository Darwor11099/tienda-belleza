import { getPublicEnv } from "@/lib/env";

/** Tipos y utilidades de presentación del catálogo (puras, sin acceso a datos). */
export type Availability = "disponible" | "consultar" | "agotado";

export type ProductImage = { storage_path: string; alt: string | null; sort_order: number };
export type ProductVariant = {
  id: string;
  name: string;
  price_cop: number | null;
  availability: Availability;
  image_path: string | null;
  sort_order: number;
};
export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  price_cop: number;
  availability: Availability;
  has_variants: boolean;
  is_new: boolean;
  category: { slug: string; name: string };
  images: ProductImage[];
  variants: Pick<ProductVariant, "id" | "price_cop" | "availability">[];
};
export type ProductDetail = Omit<ProductCard, "variants"> & {
  description: string | null;
  category_id: string;
  variants: ProductVariant[];
};

// ---------------------------------------------------------------------
// Utilidades de presentación (puras)
// ---------------------------------------------------------------------
export function publicImageUrl(storagePath: string | null | undefined): string | null {
  const env = getPublicEnv();
  if (!env || !storagePath) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/imagenes/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function mainImage(p: { images: ProductImage[] }): ProductImage | null {
  return [...p.images].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
}

/** Precio a mostrar en tarjetas: si hay variantes con precio propio distinto, "desde" el menor. */
export function displayPrice(p: Pick<ProductCard, "price_cop" | "has_variants" | "variants">): { amount: number; from: boolean } {
  if (!p.has_variants || p.variants.length === 0) return { amount: p.price_cop, from: false };
  const prices = p.variants.filter((v) => v.availability !== "agotado").map((v) => v.price_cop ?? p.price_cop);
  if (prices.length === 0) return { amount: p.price_cop, from: false };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { amount: min, from: min !== max };
}

/** Disponibilidad efectiva: un producto con variantes está agotado si todas lo están. */
export function effectiveAvailability(p: Pick<ProductCard, "availability" | "has_variants" | "variants">): Availability {
  if (p.availability === "agotado") return "agotado";
  if (p.has_variants && p.variants.length > 0) {
    if (p.variants.every((v) => v.availability === "agotado")) return "agotado";
    if (p.variants.some((v) => v.availability === "disponible")) return "disponible";
    return "consultar";
  }
  return p.availability;
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  disponible: "Disponible",
  consultar: "Consultar disponibilidad",
  agotado: "Agotado",
};
