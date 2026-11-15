import { test } from "node:test";
import assert from "node:assert/strict";
import { cartReducer, cartTotals, EMPTY_CART, lineKey, MAX_QTY, parseStoredCart, type NewLine } from "../src/lib/cart/cart";

const item = (productId: string, unitPrice: number, variantId: string | null = null, variantName: string | null = null): NewLine => ({
  productId, variantId, variantName, slug: `p-${productId}`, name: `Producto ${productId}`, sku: "1", unitPrice, imageUrl: null,
});

test("ejemplo del enunciado: 50.000 + 54.000 + 45.000 = 149.000", () => {
  let s = EMPTY_CART;
  s = cartReducer(s, { type: "add", line: item("crema", 25000), quantity: 2 });
  s = cartReducer(s, { type: "add", line: item("labial", 18000), quantity: 3 });
  s = cartReducer(s, { type: "add", line: item("perfume", 45000), quantity: 1 });
  const t = cartTotals(s);
  assert.deepEqual(t.lines.map((l) => l.subtotal), [50000, 54000, 45000]);
  assert.equal(t.total, 149000);
  assert.equal(t.units, 6);
});

test("añadir el mismo producto suma cantidades; distinta variante es otra línea", () => {
  let s = EMPTY_CART;
  s = cartReducer(s, { type: "add", line: item("rubor", 36000, "v1", "Flirty"), quantity: 1 });
  s = cartReducer(s, { type: "add", line: item("rubor", 36000, "v1", "Flirty"), quantity: 2 });
  s = cartReducer(s, { type: "add", line: item("rubor", 36000, "v2", "Chili & Hot"), quantity: 1 });
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[0].quantity, 3);
  assert.equal(s.lines[1].variantName, "Chili & Hot");
  assert.equal(cartTotals(s).total, 4 * 36000);
});

test("aumentar, disminuir, fijar y eliminar respetan 1..99", () => {
  let s = cartReducer(EMPTY_CART, { type: "add", line: item("a", 1000), quantity: 1 });
  const k = lineKey("a", null);
  s = cartReducer(s, { type: "decrement", key: k });
  assert.equal(s.lines[0].quantity, 1);
  s = cartReducer(s, { type: "increment", key: k });
  assert.equal(s.lines[0].quantity, 2);
  s = cartReducer(s, { type: "set", key: k, quantity: 500 });
  assert.equal(s.lines[0].quantity, MAX_QTY);
  s = cartReducer(s, { type: "set", key: k, quantity: -3 });
  assert.equal(s.lines[0].quantity, 1);
  s = cartReducer(s, { type: "remove", key: k });
  assert.equal(s.lines.length, 0);
});

test("la verificación de precios actualiza el precio y excluye del total lo no disponible", () => {
  let s = cartReducer(EMPTY_CART, { type: "add", line: item("a", 10000), quantity: 2 });
  s = cartReducer(s, { type: "add", line: item("b", 5000), quantity: 1 });
  s = cartReducer(s, { type: "sync", updates: [{ key: lineKey("a", null), unitPrice: 12000, available: true }] });
  const t = cartTotals(s);
  assert.equal(s.lines[0].unitPrice, 12000);
  assert.equal(s.lines[1].unavailable, true); // "b" ya no existe
  assert.equal(t.total, 24000);
  assert.equal(t.hasUnavailable, true);
});

test("datos guardados dañados o manipulados se descartan", () => {
  assert.deepEqual(parseStoredCart("{no es json"), EMPTY_CART);
  assert.deepEqual(parseStoredCart(JSON.stringify({ version: 2, lines: [] })), EMPTY_CART);
  const s = parseStoredCart(JSON.stringify({ version: 1, lines: [
    { productId: "a", variantId: null, slug: "a", name: "A", unitPrice: 1000, quantity: 3 },
    { productId: "b", variantId: null, slug: "b", name: "B", unitPrice: -5, quantity: 1 },
    { productId: "c", variantId: null, slug: "c", name: "C", unitPrice: 2000, quantity: 1e9 },
  ] }));
  assert.equal(s.lines.length, 2);
  assert.equal(s.lines[1].quantity, MAX_QTY);
});
