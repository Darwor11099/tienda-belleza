import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImportPlan, money, slugify, type ProductRow, type VariantRow } from "../src/lib/catalog-import";

function row(over: Partial<ProductRow> = {}, sheetRow = 2): ProductRow {
  return {
    key: "pdf-0039", name: "Serum Vitamina C Arana", ref: "2728", category: "Rostro",
    referencePrice: 38000, cost: null, salePrice: null, description: "Texto.", descriptionStatus: "Correcta",
    hasVariants: "No", variantsVerified: "N/A", availability: "Consultar", imageFile: "pdf-0039.webp",
    imageQuality: "Buena", approved: "No", sheetRow, ...over,
  };
}
const v = (over: Partial<VariantRow>, sheetRow = 2): VariantRow => ({
  productKey: "pdf-0525", name: "Flirty", price: null, availability: "Disponible", imageFile: null, active: "Sí", sheetRow, ...over,
});

test("money acepta formatos COP y rechaza decimales o texto", () => {
  assert.equal(money(25000), 25000);
  assert.equal(money("$25.000"), 25000);
  assert.equal(money(""), null);
  assert.equal(money(null), null);
  assert.equal(money(25000.5), undefined);
  assert.equal(money("Consultar"), undefined);
  assert.equal(money(0), undefined);
});

test("sin aprobar o sin precio de venta: se importa oculto y para revisión", () => {
  const plan = buildImportPlan([row(), row({ key: "pdf-0040", approved: "Sí" }, 3)], []);
  assert.equal(plan.stats.publish, 0);
  assert.ok(plan.products.every((p) => !p.is_active && p.needs_review));
  assert.equal(plan.products[0].price_cop, null);
  assert.equal(plan.products[0].reference_price_cop, 38000); // DETAL se guarda solo como referencia
  assert.ok(plan.warnings.some((w) => w.message.includes("sin precio final de venta")));
});

test("aprobado con precio de venta y sin variantes: se publica", () => {
  const plan = buildImportPlan([row({ approved: "Sí", salePrice: 39000, cost: 26000 })], []);
  const p = plan.products[0];
  assert.equal(p.is_active, true);
  assert.equal(p.price_cop, 39000);
  assert.equal(p.cost_cop, 26000);
  assert.equal(p.slug, "serum-vitamina-c-arana-2728");
});

test("el precio DETAL nunca se usa como precio de venta ni costo", () => {
  const p = buildImportPlan([row({ approved: "Sí" })], []).products[0];
  assert.equal(p.price_cop, null);
  assert.equal(p.cost_cop, null);
});

test("variantes: 'Posible' bloquea, 'Sí' exige verificación y al menos una activa", () => {
  const base = { key: "pdf-0525", name: "Rubor Líquido Velvet Atenea", ref: "2823", approved: "Sí", salePrice: 36000 };
  const posible = buildImportPlan([row({ ...base, hasVariants: "Posible" })], []);
  assert.equal(posible.products[0].is_active, false);

  const sinVerificar = buildImportPlan([row({ ...base, hasVariants: "Sí", variantsVerified: "No" })], [v({})]);
  assert.equal(sinVerificar.products[0].is_active, false);

  const agotadas = buildImportPlan([row({ ...base, hasVariants: "Sí", variantsVerified: "Sí" })], [v({ availability: "Agotado" })]);
  assert.equal(agotadas.products[0].is_active, false);

  const ok = buildImportPlan(
    [row({ ...base, hasVariants: "Sí", variantsVerified: "Sí" })],
    [v({ name: "Russet Orange" }, 2), v({ name: "Flirty", price: "38.000" }, 3)],
  );
  assert.equal(ok.products[0].is_active, true);
  assert.equal(ok.products[0].has_variants, true);
  assert.equal(ok.variants.length, 2);
  assert.equal(ok.variants[1].price_cop, 38000);
});

test("referencias repetidas no chocan: la clave es el ID de importación y el slug es único", () => {
  const plan = buildImportPlan(
    [
      row({ key: "pdf-0622", name: "Perfume Para El Cabello Lluvia De Estrellas", ref: "2873" }, 2),
      row({ key: "pdf-0623", name: "Perfume Para El Cabello Lluvia De Estrellas", ref: "2873" }, 3),
    ],
    [],
  );
  assert.equal(plan.products.length, 2);
  assert.notEqual(plan.products[0].slug, plan.products[1].slug);
  assert.deepEqual(plan.products.map((p) => p.import_key), ["pdf-0622", "pdf-0623"]);
});

test("errores de datos se reportan sin importar la fila", () => {
  const plan = buildImportPlan(
    [row({ salePrice: "abc" }), row({ key: "pdf-0039" }, 3), row({ key: "pdf-0050", category: "Uñas" }, 4)],
    [v({ productKey: "pdf-9999" })],
  );
  assert.equal(plan.products.length, 0);
  assert.equal(plan.errors.length, 3);
  assert.ok(plan.warnings.some((w) => w.message.includes("pdf-9999")));
});

test("slugify quita tildes y símbolos", () => {
  assert.equal(slugify("Tónico de Rosas Lluvia de Estrellas 150 ml"), "tonico-de-rosas-lluvia-de-estrellas-150-ml");
  assert.equal(slugify("Nivea Micellair® Agua Micelar & Rosas"), "nivea-micellair-agua-micelar-y-rosas");
});
