import { test } from "node:test";
import assert from "node:assert/strict";
import { placeOrder, type CreateOrderRpc } from "../src/lib/checkout";
import { customerOrderMessage, orderErrorMessage, paymentSchema, shippingSchema } from "../src/lib/orders";

const P = "11111111-1111-4111-8111-111111111111";
const V = "33333333-3333-4333-8333-333333333333";
const KEY = "44444444-4444-4444-8444-444444444444";
const valid = () => ({
  idempotencyKey: KEY,
  website: "",
  customer: { name: "  Laura  Gómez ", whatsapp: "300 123 4567", email: "", city: "Medellín", address: "Calle 1 # 2-3", notes: "", dataConsent: true },
  items: [{ productId: P, variantId: V, quantity: 2 }],
});

function fakeRpc(result: Awaited<ReturnType<CreateOrderRpc>>) {
  const calls: Parameters<CreateOrderRpc>[0][] = [];
  const rpc: CreateOrderRpc = async (args) => { calls.push(args); return result; };
  return { rpc, calls };
}
const okRow = { data: [{ out_order_id: "x", out_order_number: 1001, out_subtotal_cop: 72000, out_existing: false }], error: null };

test("envía a la base solo IDs y cantidades, con datos normalizados", async () => {
  const { rpc, calls } = fakeRpc(okRow);
  const body = { ...valid(), items: [{ productId: P, variantId: V, quantity: 2, unitPrice: 1, price_cop: 1 }] } as unknown;
  const r = await placeOrder(body, { rpc, token: (k) => `t-${k}`, ipHash: "h" });
  assert.equal(r.ok, true);
  assert.deepEqual(calls[0].p_items, [{ product_id: P, variant_id: V, quantity: 2 }]); // el precio enviado se ignora
  assert.equal(calls[0].p_customer.name, "Laura Gómez");
  assert.equal(calls[0].p_customer.whatsapp, "573001234567");
  assert.equal(calls[0].p_customer.email, null);
  assert.equal(calls[0].p_idempotency_key, KEY);
});

test("doble envío: misma clave → mismo token y la base devuelve el pedido existente", async () => {
  const token = (k: string) => `t-${k}`;
  const first = await placeOrder(valid(), { rpc: fakeRpc(okRow).rpc, token, ipHash: null });
  const second = await placeOrder(valid(), {
    rpc: fakeRpc({ data: [{ ...okRow.data[0], out_existing: true }], error: null }).rpc, token, ipHash: null,
  });
  assert.ok(first.ok && second.ok);
  if (first.ok && second.ok) {
    assert.equal(first.token, second.token);
    assert.equal(second.existing, true);
    assert.equal(second.orderNumber, 1001);
  }
});

test("validaciones del formulario y campo trampa", async () => {
  const { rpc, calls } = fakeRpc(okRow);
  const bad = valid();
  bad.customer.whatsapp = "9046672647"; // 10 dígitos que no empiezan por 3
  bad.customer.dataConsent = false as unknown as true;
  const r = await placeOrder(bad, { rpc, token: (k) => k, ipHash: null });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.fields?.whatsapp);
    assert.ok(r.fields?.dataConsent);
  }
  const bot = await placeOrder({ ...valid(), website: "http://spam" }, { rpc, token: (k) => k, ipHash: null });
  assert.equal(bot.ok, false);
  const qty = await placeOrder({ ...valid(), items: [{ productId: P, variantId: null, quantity: 100 }] }, { rpc, token: (k) => k, ipHash: null });
  assert.equal(qty.ok, false);
  assert.equal(calls.length, 0); // nada inválido llega a la base
});

test("errores de la base se traducen para la clienta", async () => {
  const r = await placeOrder(valid(), {
    rpc: fakeRpc({ data: null, error: { message: "PRODUCTO_NO_DISPONIBLE" } }).rpc, token: (k) => k, ipHash: null,
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 409);
    assert.equal(r.refreshCart, true);
  }
  assert.equal(orderErrorMessage("DEMASIADOS_PEDIDOS").status, 429);
  assert.equal(orderErrorMessage("algo raro").status, 500);
});

test("mensaje de WhatsApp con tonos y total", () => {
  const msg = customerOrderMessage({
    order_number: 1001, status: "pendiente", created_at: "2026-11-13", subtotal_cop: 184000, shipping_cop: null, total_cop: 184000,
    items: [
      { name: "Serum Vitamina C Arana", variant: null, sku: "2728", quantity: 2, unit_price_cop: 38000, line_total_cop: 76000 },
      { name: "Rubor Líquido Velvet Atenea", variant: "Russet Orange", sku: "2823", quantity: 3, unit_price_cop: 36000, line_total_cop: 108000 },
    ],
  }, "Tienda Belleza");
  assert.match(msg, /pedido N\.º 1001/);
  assert.match(msg, /3 × Rubor Líquido Velvet Atenea \(tono: Russet Orange\) — \$108\.000/);
  assert.match(msg, /Total productos: \$184\.000/);
});

test("formularios del panel: pago y envío", () => {
  assert.equal(paymentSchema.parse({ amount: "$50.000", method: "nequi" }).amount, 50000);
  assert.equal(paymentSchema.safeParse({ amount: "50.000,50", method: "nequi" }).success, false);
  assert.equal(paymentSchema.safeParse({ amount: "1000", method: "bitcoin" }).success, false);
  assert.equal(shippingSchema.parse("12.000"), 12000);
  assert.equal(shippingSchema.parse(""), null);
});

import { parseTab, tabCounts } from "../src/lib/admin-orders";
test("pestañas del panel: nuevos = pendientes no abiertos", () => {
  const rows = [
    { status: "pendiente" as const, seen_at: null },
    { status: "pendiente" as const, seen_at: "2026-11-13" },
    { status: "entregado" as const, seen_at: "2026-11-13" },
    { status: "cancelado" as const, seen_at: null },
  ];
  const c = tabCounts(rows);
  assert.equal(c.nuevos, 1);
  assert.equal(c.pendiente, 2);
  assert.equal(c.entregado, 1);
  assert.equal(c.todos, 4);
  assert.equal(parseTab("x"), "nuevos");
});
