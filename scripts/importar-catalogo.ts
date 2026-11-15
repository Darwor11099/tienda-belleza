/**
 * Importa el catálogo desde el Excel de revisión a Supabase.
 *
 *   npm run importar -- --archivo revision_catalogo.xlsx                 (simulación: no escribe nada)
 *   npm run importar -- --archivo revision_catalogo.xlsx --aplicar       (escribe en Supabase)
 *   npm run importar -- --archivo ... --aplicar --solo-nuevos            (no toca productos ya importados)
 *   npm run importar -- --archivo ... --aplicar --subir-fotos --fotos ./fotos_catalogo
 *        (solo si FOTOS_AUTORIZADAS=si en .env.local: confirma antes el permiso de uso)
 *
 * Repetible: la clave es el "ID importación" (página del PDF), no la referencia.
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readXlsx, sheetRecords } from "../src/lib/xlsx-reader";
import {
  buildImportPlan,
  type ImportPlan,
  type ProductRow,
  type VariantRow,
} from "../src/lib/catalog-import";

// ---------------------------------------------------------------------
// Argumentos y entorno
// ---------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const file = option("--archivo");
const photosDir = option("--fotos") ?? "fotos_catalogo";
const apply = flag("--aplicar");
const onlyNew = flag("--solo-nuevos");
const uploadPhotos = flag("--subir-fotos");

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------
// Lectura del Excel (lector propio: ignora miniaturas y dibujos)
// ---------------------------------------------------------------------
function readWorkbook(filePath: string) {
  const book = readXlsx(filePath);
  const ps = book.get("Productos") ?? fail("Falta la hoja «Productos».");
  const vs = book.get("Variantes") ?? fail("Falta la hoja «Variantes».");

  const rows: ProductRow[] = sheetRecords(ps).map((r) => ({
    key: r.get("ID importación"),
    name: r.get("Nombre del producto"),
    ref: r.get("Referencia"),
    category: r.get("Categoría"),
    referencePrice: r.get("Precio DETAL proveedor (COP)"),
    cost: r.get("Costo real de compra (COP)"),
    salePrice: r.get("Precio final de venta (COP)"),
    description: r.get("Descripción corregida"),
    descriptionStatus: r.get("Estado de la descripción"),
    hasVariants: r.get("¿Tiene variantes?"),
    variantsVerified: r.get("Variantes verificadas"),
    availability: r.get("Disponibilidad"),
    imageFile: r.get("Archivo de foto"),
    imageQuality: r.get("Calidad de foto"),
    approved: r.get("Aprobado para publicar"),
    sheetRow: r.row,
  }));

  const variants: VariantRow[] = sheetRecords(vs).map((r) => ({
    productKey: r.get("ID importación del producto"),
    name: r.get("Variante (tono, color o presentación)"),
    price: r.get("Precio propio (COP, opcional)"),
    availability: r.get("Disponibilidad"),
    imageFile: r.get("Archivo de foto (opcional)"),
    active: r.get("Activa"),
    sheetRow: r.row,
  }));
  return { rows, variants };
}

// ---------------------------------------------------------------------
// Escritura en Supabase
// ---------------------------------------------------------------------
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function applyPlan(plan: ImportPlan) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local.");
  // Se carga solo al importar de verdad: la simulación no necesita conexión
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: cats, error: catErr } = await db.from("categories").select("id, slug");
  if (catErr) fail(`No se pudieron leer las categorías: ${catErr.message}`);
  const catId = new Map(cats!.map((c) => [c.slug as string, c.id as string]));

  let products = plan.products;
  if (onlyNew) {
    const { data: existing, error } = await db.from("products").select("import_key").not("import_key", "is", null);
    if (error) fail(error.message);
    const have = new Set(existing!.map((e) => e.import_key as string));
    products = products.filter((p) => !have.has(p.import_key));
    console.log(`  --solo-nuevos: ${plan.products.length - products.length} ya existían y no se tocan.`);
  }

  // 1. Productos (upsert por import_key)
  const idByKey = new Map<string, string>();
  for (const part of chunk(products, 100)) {
    const payload = part.map((p) => ({
      import_key: p.import_key,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      category_id: catId.get(p.categorySlug) ?? fail(`Categoría ${p.categorySlug} no existe en la base.`),
      description: p.description,
      description_needs_review: p.description_needs_review,
      reference_price_cop: p.reference_price_cop,
      price_cop: p.price_cop,
      availability: p.availability,
      has_variants: p.has_variants,
      variants_verified: p.variants_verified,
      needs_review: p.needs_review,
      is_active: p.is_active,
      review_notes: p.review_notes,
      source_section: "pdf",
    }));
    const { data, error } = await db.from("products").upsert(payload, { onConflict: "import_key" }).select("id, import_key");
    if (error) fail(`Error guardando productos: ${error.message}`);
    for (const r of data!) idByKey.set(r.import_key as string, r.id as string);
  }
  console.log(`  ✓ ${idByKey.size} productos guardados.`);

  // 2. Costos reales (solo los que vienen informados; nunca el DETAL)
  const costs = products
    .filter((p) => p.cost_cop !== null)
    .map((p) => ({ product_id: idByKey.get(p.import_key)!, cost_cop: p.cost_cop! }));
  for (const part of chunk(costs, 200)) {
    const { error } = await db.from("product_costs").upsert(part, { onConflict: "product_id" });
    if (error) fail(`Error guardando costos: ${error.message}`);
  }
  console.log(`  ✓ ${costs.length} costos reales guardados.`);

  // 3. Variantes (upsert por producto + nombre; no se borran las existentes)
  const variants = plan.variants
    .filter((v) => idByKey.has(v.productKey))
    .map((v) => ({
      product_id: idByKey.get(v.productKey)!,
      name: v.name,
      price_cop: v.price_cop,
      availability: v.availability,
      is_active: v.is_active,
      sort_order: v.sort_order,
    }));
  for (const part of chunk(variants, 200)) {
    const { error } = await db.from("product_variants").upsert(part, { onConflict: "product_id,name" });
    if (error) fail(`Error guardando variantes: ${error.message}`);
  }
  console.log(`  ✓ ${variants.length} variantes guardadas.`);

  // 4. Fotos (solo con permiso confirmado)
  if (uploadPhotos) {
    let uploaded = 0;
    const missing: string[] = [];
    for (const p of products) {
      if (!p.imageFile) continue;
      const local = path.join(photosDir, p.imageFile);
      if (!existsSync(local)) {
        missing.push(p.imageFile);
        continue;
      }
      const storagePath = `productos/${p.imageFile}`;
      const { error: upErr } = await db.storage
        .from("imagenes")
        .upload(storagePath, readFileSync(local), { contentType: "image/webp", upsert: true });
      if (upErr) fail(`Error subiendo ${p.imageFile}: ${upErr.message}`);
      const { error } = await db.from("product_images").upsert(
        { product_id: idByKey.get(p.import_key)!, storage_path: storagePath, alt: p.name, sort_order: 0, is_low_res: p.imageLowRes },
        { onConflict: "product_id,storage_path" },
      );
      if (error) fail(`Error registrando la foto de ${p.import_key}: ${error.message}`);
      uploaded++;
    }
    console.log(`  ✓ ${uploaded} fotos subidas.${missing.length ? ` Faltan ${missing.length} archivos en ${photosDir}.` : ""}`);
  }
}

// ---------------------------------------------------------------------
async function main() {
  loadEnvLocal();
  if (!file) fail("Indica el archivo: --archivo revision_catalogo.xlsx");
  if (!existsSync(file)) fail(`No existe el archivo ${file}.`);
  if (uploadPhotos && process.env.FOTOS_AUTORIZADAS !== "si") {
    fail("Las fotos no se suben hasta confirmar el permiso de uso. Cuando esté confirmado, añade FOTOS_AUTORIZADAS=si a .env.local.");
  }
  if (uploadPhotos && !existsSync(photosDir)) fail(`No existe la carpeta de fotos ${photosDir}.`);

  const { rows, variants } = readWorkbook(file);
  const plan = buildImportPlan(rows, variants);

  console.log(`\nArchivo: ${file}`);
  console.log(`  Productos: ${plan.stats.total}  ·  se publicarán: ${plan.stats.publish}  ·  ocultos para revisión: ${plan.stats.hidden}`);
  console.log(`  Variantes: ${plan.stats.variants}`);
  console.log(`  Errores: ${plan.errors.length}  ·  Avisos: ${plan.warnings.length}`);
  for (const e of plan.errors.slice(0, 20)) console.log(`  ✗ [${e.sheet} fila ${e.row}] ${e.message}`);
  for (const w of plan.warnings.slice(0, 20)) console.log(`  ! [${w.sheet}${w.row ? ` fila ${w.row}` : ""}] ${w.message}`);

  writeFileSync("importacion-reporte.json", JSON.stringify(plan, null, 2));
  console.log("  Detalle completo en importacion-reporte.json");

  if (plan.errors.length > 0) fail("Corrige los errores del Excel antes de importar.");
  if (!apply) {
    console.log("\nSimulación terminada: no se escribió nada. Usa --aplicar para importar.\n");
    return;
  }
  console.log("\nImportando…");
  await applyPlan(plan);
  console.log("\nImportación terminada.\n");
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
