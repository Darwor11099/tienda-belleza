import { test } from "node:test";
import assert from "node:assert/strict";
import { buildChanges, describeBulk, newPrice, parseBulkParams, roundPrice } from "../src/lib/bulk-prices";

test("redondeos", () => {
  assert.equal(roundPrice(38420, "100"), 38400);
  assert.equal(roundPrice(38450, "100"), 38500);
  assert.equal(roundPrice(38420, "1000"), 38000);
  assert.equal(roundPrice(38420, "900"), 38900);
  assert.equal(roundPrice(38900, "900"), 38900);
  assert.equal(roundPrice(38950, "900"), 39900);
  assert.equal(roundPrice(500, "900"), 900);
  assert.equal(roundPrice(38420.6, "ninguno"), 38421);
});

test("porcentaje y monto, subir y bajar", () => {
  assert.equal(newPrice(36000, { op: "porcentaje", value: 10, rounding: "100" }), 39600);
  assert.equal(newPrice(36000, { op: "porcentaje", value: -15, rounding: "100" }), 30600);
  assert.equal(newPrice(36000, { op: "monto", value: 2000, rounding: "ninguno" }), 38000);
  assert.equal(newPrice(26000, { op: "porcentaje", value: 30, rounding: "900" }), 33900);
});

test("parámetros: valida rangos y entiende formatos colombianos", () => {
  assert.equal(parseBulkParams({ valor: "10" }).ready, true);
  assert.equal(parseBulkParams({ valor: "12,5" }).params.value, 12.5);
  assert.equal(parseBulkParams({ op: "monto", valor: "2.000" }).params.value, 2000);
  assert.equal(parseBulkParams({ valor: "900" }).ready, false); // más de 500 %
  assert.equal(parseBulkParams({ op: "monto", valor: "1500,5" }).ready, false);
  assert.equal(parseBulkParams({ valor: "0" }).ready, false);
  assert.equal(parseBulkParams({ base: "detal", valor: "0" }).ready, true); // copiar el DETAL tal cual
  assert.equal(parseBulkParams({}).ready, false);
});

test("vista previa: omite sin precio base, sin cambio y avisa bajo costo", () => {
  const rows = [
    { id: "a", name: "A", sku: "1", price_cop: 36000, reference_price_cop: 36000, cost: 30000 },
    { id: "b", name: "B", sku: "2", price_cop: null, reference_price_cop: 20000, cost: null },
    { id: "c", name: "C", sku: "3", price_cop: 39600, reference_price_cop: null, cost: null },
    { id: "d", name: "D", sku: "4", price_cop: null, reference_price_cop: null, cost: null },
  ];
  const venta = buildChanges(rows, { filter: "todos", category: null, q: "", base: "venta", op: "porcentaje", value: -20, rounding: "100" });
  assert.deepEqual(venta.changes.map((c) => [c.id, c.next, c.belowCost]), [["a", 28800, true], ["c", 31700, false]]);
  assert.equal(venta.skippedNoBase, 2);
  const detal = buildChanges(rows, { filter: "sin-precio", category: null, q: "", base: "detal", op: "porcentaje", value: 10, rounding: "900" });
  assert.deepEqual(detal.changes.map((c) => [c.id, c.old, c.next]), [["a", 36000, 39900], ["b", null, 22900]]);
  const same = buildChanges([rows[0]], { filter: "todos", category: null, q: "", base: "detal", op: "porcentaje", value: 0, rounding: "100" });
  assert.equal(same.unchanged, 1);
});

test("descripción legible del cambio", () => {
  const { params } = parseBulkParams({ base: "detal", valor: "10", redondeo: "900", filtro: "sin-precio" });
  assert.equal(describeBulk(params, "Sin precio", "Cabello"), "+10 % sobre el precio DETAL, terminar en 900. Productos: Sin precio · Cabello.");
});
