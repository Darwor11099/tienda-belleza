import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCheckBody, priceUpdates } from "../src/lib/cart/price-check";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const V = "33333333-3333-4333-8333-333333333333";

test("valida el cuerpo de la petición", () => {
  assert.deepEqual(parseCheckBody({ items: [{ productId: A, variantId: null }] }), [{ productId: A, variantId: null }]);
  assert.equal(parseCheckBody({ items: [] }), null);
  assert.equal(parseCheckBody({ items: [{ productId: "1 or 1=1", variantId: null }] }), null);
  assert.equal(parseCheckBody({ items: [{ productId: A, variantId: "x" }] }), null);
  assert.equal(parseCheckBody("nada"), null);
});

test("precios actuales: variante con precio propio, producto retirado y variante agotada", () => {
  const products = [
    { id: A, price_cop: 36000, availability: "consultar", has_variants: true, variants: [{ id: V, price_cop: 38000, availability: "disponible" }] },
  ];
  const u = priceUpdates(
    [{ productId: A, variantId: V }, { productId: A, variantId: null }, { productId: B, variantId: null }],
    products,
  );
  assert.deepEqual(u[0], { key: `${A}:${V}`, unitPrice: 38000, available: true });
  assert.equal(u[1].available, false); // falta elegir tono
  assert.equal(u[2].available, false); // producto ya no publicado
});
