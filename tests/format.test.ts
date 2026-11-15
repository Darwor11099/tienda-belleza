import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCOP, parseCOP } from "../src/lib/format";

test("formatCOP usa puntos de miles y sin decimales", () => {
  assert.equal(formatCOP(0), "$0");
  assert.equal(formatCOP(950), "$950");
  assert.equal(formatCOP(25000), "$25.000");
  assert.equal(formatCOP(149000), "$149.000");
  assert.equal(formatCOP(1250000), "$1.250.000");
  assert.equal(formatCOP(79999), "$79.999");
  assert.equal(formatCOP(-5000), "-$5.000");
  assert.equal(formatCOP(Number.NaN), "—");
});

test("parseCOP acepta formatos comunes y rechaza texto", () => {
  assert.equal(parseCOP("25.000"), 25000);
  assert.equal(parseCOP("$ 25.000"), 25000);
  assert.equal(parseCOP("25000"), 25000);
  assert.equal(parseCOP("Consultar"), null);
  assert.equal(parseCOP(""), null);
});
