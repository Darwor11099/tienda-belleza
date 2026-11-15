/**
 * Reglas de importación del catálogo (sin dependencias: se puede probar sola).
 * Convierte las filas del Excel de revisión en registros para Supabase y
 * decide qué productos se pueden publicar.
 */

export const CATEGORY_SLUGS: Record<string, string> = {
  Rostro: "rostro",
  Ojos: "ojos",
  Labios: "labios",
  Cabello: "cabello",
  Cuerpo: "cuerpo",
  Perfumería: "perfumeria",
  "Maquillaje y Sets": "maquillaje-y-sets",
  "Herramientas y Accesorios": "herramientas-y-accesorios",
};

const AVAILABILITY: Record<string, "disponible" | "consultar" | "agotado"> = {
  disponible: "disponible",
  consultar: "consultar",
  agotado: "agotado",
};

/** Fila de la hoja "Productos" (valores tal como vienen de la celda). */
export type ProductRow = {
  key: unknown;
  name: unknown;
  ref: unknown;
  category: unknown;
  referencePrice: unknown;
  cost: unknown;
  salePrice: unknown;
  description: unknown;
  descriptionStatus: unknown;
  hasVariants: unknown;
  variantsVerified: unknown;
  availability: unknown;
  imageFile: unknown;
  imageQuality: unknown;
  approved: unknown;
  sheetRow: number;
};

/** Fila de la hoja "Variantes". */
export type VariantRow = {
  productKey: unknown;
  name: unknown;
  price: unknown;
  availability: unknown;
  imageFile: unknown;
  active: unknown;
  sheetRow: number;
};

export type ProductRecord = {
  import_key: string;
  name: string;
  slug: string;
  sku: string | null;
  categorySlug: string;
  description: string | null;
  description_needs_review: boolean;
  reference_price_cop: number | null;
  price_cop: number | null;
  cost_cop: number | null;
  availability: "disponible" | "consultar" | "agotado";
  has_variants: boolean;
  variants_verified: boolean;
  needs_review: boolean;
  is_active: boolean;
  review_notes: string | null;
  imageFile: string | null;
  imageLowRes: boolean;
};

export type VariantRecord = {
  productKey: string;
  name: string;
  price_cop: number | null;
  availability: "disponible" | "consultar" | "agotado";
  is_active: boolean;
  imageFile: string | null;
  sort_order: number;
};

export type Issue = { sheet: "Productos" | "Variantes"; row: number; message: string };

export type ImportPlan = {
  products: ProductRecord[];
  variants: VariantRecord[];
  errors: Issue[];
  warnings: Issue[];
  stats: { total: number; publish: number; hidden: number; variants: number };
};

// ---------------------------------------------------------------------
// Utilidades de lectura de celdas
// ---------------------------------------------------------------------
export function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

/** Texto conservando saltos de línea (descripciones). */
export function longText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return s === "" ? null : s;
}

/** Pesos enteros positivos. Acepta 25000, "25.000", "$25.000". Devuelve undefined si es inválido. */
export function money(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isInteger(v) && v > 0 ? v : undefined;
  const s = String(v).replace(/[$\s.]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number.parseInt(s, 10);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
}

export function yes(v: unknown): boolean {
  const s = text(v)?.toLowerCase();
  return s === "sí" || s === "si";
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

// ---------------------------------------------------------------------
// Plan de importación
// ---------------------------------------------------------------------
export function buildImportPlan(rows: ProductRow[], variantRows: VariantRow[]): ImportPlan {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const products: ProductRecord[] = [];
  const seenKeys = new Set<string>();

  // Variantes agrupadas por producto
  const variantsByKey = new Map<string, VariantRecord[]>();
  for (const v of variantRows) {
    const productKey = text(v.productKey);
    const name = text(v.name);
    if (!productKey && !name) continue; // fila vacía
    if (!productKey || !name) {
      errors.push({ sheet: "Variantes", row: v.sheetRow, message: "Falta el ID del producto o el nombre de la variante." });
      continue;
    }
    const price = money(v.price);
    if (price === undefined) {
      errors.push({ sheet: "Variantes", row: v.sheetRow, message: `Precio propio no válido: «${String(v.price)}».` });
      continue;
    }
    const list = variantsByKey.get(productKey) ?? [];
    if (list.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      errors.push({ sheet: "Variantes", row: v.sheetRow, message: `Variante repetida «${name}» en ${productKey}.` });
      continue;
    }
    list.push({
      productKey,
      name: name.slice(0, 80),
      price_cop: price,
      availability: AVAILABILITY[text(v.availability)?.toLowerCase() ?? ""] ?? "consultar",
      is_active: text(v.active) === null ? true : yes(v.active),
      imageFile: text(v.imageFile),
      sort_order: list.length,
    });
    variantsByKey.set(productKey, list);
  }

  for (const r of rows) {
    const key = text(r.key);
    if (!key) continue; // fila vacía
    const at = (message: string) => ({ sheet: "Productos" as const, row: r.sheetRow, message: `${key}: ${message}` });

    if (seenKeys.has(key)) {
      errors.push(at("ID de importación repetido."));
      continue;
    }
    seenKeys.add(key);

    const name = text(r.name);
    if (!name || name.length < 2) {
      errors.push(at("Falta el nombre."));
      continue;
    }
    const categoryName = text(r.category) ?? "";
    const categorySlug = CATEGORY_SLUGS[categoryName];
    if (!categorySlug) {
      errors.push(at(`Categoría desconocida «${categoryName}».`));
      continue;
    }
    const referencePrice = money(r.referencePrice);
    const cost = money(r.cost);
    const salePrice = money(r.salePrice);
    if (referencePrice === undefined) errors.push(at("Precio DETAL no válido."));
    if (cost === undefined) errors.push(at("Costo real no válido (pesos enteros, sin decimales)."));
    if (salePrice === undefined) errors.push(at("Precio final de venta no válido (pesos enteros, sin decimales)."));
    if (referencePrice === undefined || cost === undefined || salePrice === undefined) continue;

    const variantChoice = text(r.hasVariants)?.toLowerCase() ?? "no";
    const variantsPossible = variantChoice === "posible";
    const hasVariants = variantChoice === "sí" || variantChoice === "si";
    const verified = hasVariants && yes(r.variantsVerified);
    const myVariants = variantsByKey.get(key) ?? [];
    const activeVariants = myVariants.filter((v) => v.is_active && v.availability !== "agotado");
    const approved = yes(r.approved);

    // ¿Se puede publicar?
    const blockers: string[] = [];
    if (!approved) blockers.push("no aprobado");
    if (salePrice === null) blockers.push("sin precio final de venta");
    if (variantsPossible) blockers.push("variantes por decidir (Posible)");
    if (hasVariants && !verified) blockers.push("variantes sin verificar");
    if (hasVariants && verified && activeVariants.length === 0) blockers.push("sin variantes activas");
    const publish = blockers.length === 0;

    if (approved && !publish) warnings.push(at(`Aprobado pero no se publica: ${blockers.join(", ")}.`));
    if (!hasVariants && myVariants.length > 0)
      warnings.push(at("Tiene filas en la hoja Variantes pero «¿Tiene variantes?» no es «Sí»; se ignoran."));
    if (salePrice !== null && cost !== null && cost > salePrice)
      warnings.push(at("El costo real es mayor que el precio de venta."));

    const descriptionStatus = text(r.descriptionStatus)?.toLowerCase() ?? "";
    const description = longText(r.description);

    products.push({
      import_key: key,
      name: name.slice(0, 200),
      slug: "", // se asigna abajo
      sku: text(r.ref),
      categorySlug,
      description,
      description_needs_review: description !== null && descriptionStatus !== "correcta" && !approved,
      reference_price_cop: referencePrice,
      price_cop: salePrice,
      cost_cop: cost,
      availability: AVAILABILITY[text(r.availability)?.toLowerCase() ?? ""] ?? "consultar",
      has_variants: hasVariants,
      variants_verified: verified,
      needs_review: !publish,
      is_active: publish,
      review_notes: publish ? null : blockers.join("; "),
      imageFile: text(r.imageFile),
      imageLowRes: text(r.imageQuality)?.toLowerCase() === "baja",
    });

    if (hasVariants) variantsByKey.set(key, myVariants);
    else variantsByKey.delete(key);
  }

  // Variantes de productos que no existen en la hoja
  for (const [k, list] of variantsByKey) {
    if (!seenKeys.has(k)) {
      for (const v of list) warnings.push({ sheet: "Variantes", row: 0, message: `${k}: producto inexistente; variante «${v.name}» ignorada.` });
      variantsByKey.delete(k);
    }
  }

  // Slugs estables y únicos (nombre + referencia; sufijo si se repite)
  const used = new Map<string, number>();
  for (const p of [...products].sort((a, b) => a.import_key.localeCompare(b.import_key))) {
    const base = slugify(`${p.name} ${p.sku ?? p.import_key}`) || slugify(p.import_key);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    p.slug = n === 1 ? base : `${base}-${n}`;
  }

  const variants = [...variantsByKey.values()].flat();
  const publishCount = products.filter((p) => p.is_active).length;
  return {
    products,
    variants,
    errors,
    warnings,
    stats: { total: products.length, publish: publishCount, hidden: products.length - publishCount, variants: variants.length },
  };
}
