import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formToObject, parseProductListParams, productFormSchema, productListHref, publishBlockers, remainingReviewNotes, slugFor,
} from "../src/lib/admin-products";

const CAT = "11111111-1111-4111-8111-111111111111";
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { name: " Serum  Vitamina C ", sku: "2728", categoryId: CAT, description: "", availability: "disponible", price: "$38.000", cost: "26000" };

test("parámetros del listado y enlaces", () => {
  const p = parseProductListParams({ q: " pocion ", filtro: "sin-precio", categoria: "rostro", pagina: "2" });
  assert.deepEqual(p, { q: "pocion", filter: "sin-precio", category: "rostro", page: 2 });
  assert.equal(parseProductListParams({ filtro: "x" }).filter, "todos");
  assert.equal(productListHref(p, { filter: "publicados" }), "/admin/productos?q=pocion&filtro=publicados&categoria=rostro");
});

test("formulario: limpia textos y convierte pesos", () => {
  const r = productFormSchema.parse(formToObject(fd({ ...base, featured: "on" })));
  assert.equal(r.name, "Serum Vitamina C");
  assert.equal(r.price, 38000);
  assert.equal(r.cost, 26000);
  assert.equal(r.description, null);
  assert.equal(r.featured, true);
  assert.equal(r.isNew, false);
  assert.equal(r.variants, undefined);
});

test("formulario: precio vacío permitido (producto oculto) pero no decimales ni texto", () => {
  assert.equal(productFormSchema.parse(formToObject(fd({ ...base, price: "" }))).price, null);
  assert.equal(productFormSchema.safeParse(formToObject(fd({ ...base, price: "38.000,50" }))).success, false);
  assert.equal(productFormSchema.safeParse(formToObject(fd({ ...base, cost: "abc" }))).success, false);
  assert.equal(productFormSchema.safeParse(formToObject(fd({ ...base, categoryId: "x" }))).success, false);
});

test("reglas para publicar, con mensajes claros", () => {
  const ok = { price_cop: 38000, has_variants: false, variants_verified: false, review_notes: null, activeVariants: 0 };
  assert.deepEqual(publishBlockers(ok), []);
  assert.equal(publishBlockers({ ...ok, price_cop: null }).length, 1);
  assert.match(publishBlockers({ ...ok, review_notes: "no aprobado; variantes por decidir (Posible)" })[0], /tonos/);
  assert.match(publishBlockers({ ...ok, has_variants: true })[0], /verificadas/);
  assert.match(publishBlockers({ ...ok, has_variants: true, variants_verified: true })[0], /ninguna activa/);
});

test("al guardar se borran de las notas los motivos resueltos", () => {
  const form = productFormSchema.parse(formToObject(fd({ ...base, variants: "no" })));
  assert.equal(remainingReviewNotes("no aprobado; sin precio final de venta; variantes por decidir (Posible)", form), null);
  const sinPrecio = productFormSchema.parse(formToObject(fd({ ...base, price: "" })));
  assert.equal(remainingReviewNotes("no aprobado; sin precio final de venta", sinPrecio), "sin precio final de venta");
});

test("slug estable desde nombre y referencia", () => {
  assert.equal(slugFor("Tónico de Rosas & Aloe", "2303"), "tonico-de-rosas-y-aloe-2303");
  assert.equal(slugFor("***", null), "producto");
});

import { formatPct, isValidUploadPath, plural, variantFormSchema, variantFormToObject } from "../src/lib/admin-products";
const PID = "22222222-2222-4222-8222-222222222222";

test("variantes: nombre obligatorio, precio propio opcional", () => {
  const v = variantFormSchema.parse(variantFormToObject(fd({ name: "  Russet  Orange ", price: "", availability: "disponible", active: "on" })));
  assert.deepEqual(v, { name: "Russet Orange", price: null, availability: "disponible", active: true, imagePath: null });
  assert.equal(variantFormSchema.parse(variantFormToObject(fd({ name: "Flirty", price: "38.000", availability: "agotado" }))).active, false);
  assert.equal(variantFormSchema.safeParse(variantFormToObject(fd({ name: "", availability: "disponible" }))).success, false);
});

test("fotos: solo rutas dentro de la carpeta del producto", () => {
  assert.equal(isValidUploadPath(PID, `productos/${PID}/33333333-3333-4333-8333-333333333333.webp`), true);
  assert.equal(isValidUploadPath(PID, `productos/otro/33333333-3333-4333-8333-333333333333.webp`), false);
  assert.equal(isValidUploadPath(PID, `productos/${PID}/../../secreto.webp`), false);
});

test("formato de porcentaje y plurales en español", () => {
  assert.equal(formatPct(31.6), "31,6 %");
  assert.equal(formatPct(25), "25 %");
  assert.equal(plural(1, "producto", "productos"), "1 producto");
  assert.equal(plural(3, "producto", "productos"), "3 productos");
});
