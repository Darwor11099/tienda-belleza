import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal, grossMargin, lineTotal } from "../src/lib/pricing";

test("ejemplo del enunciado: total $149.000", () => {
  const lines = [
    { unitPrice: 25000, quantity: 2 },
    { unitPrice: 18000, quantity: 3 },
    { unitPrice: 45000, quantity: 1 },
  ];
  assert.deepEqual(lines.map(lineTotal), [50000, 54000, 45000]);
  assert.equal(cartTotal(lines), 149000);
  assert.equal(cartTotal([]), 0);
});

test("ganancia bruta solo si hay precio y costo", () => {
  assert.deepEqual(grossMargin(38000, 26000), { grossProfit: 12000, marginPct: 31.6 });
  assert.equal(grossMargin(38000, null), null);
  assert.equal(grossMargin(null, 26000), null);
  assert.deepEqual(grossMargin(20000, 25000), { grossProfit: -5000, marginPct: -25 });
});
