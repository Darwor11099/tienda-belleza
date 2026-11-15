import { test } from "node:test";
import assert from "node:assert/strict";
import { readJsonBody } from "../src/lib/http";

const req = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api", { method: "POST", body, headers });

test("lee JSON dentro del límite", async () => {
  const r = await readJsonBody(req('{"a":1}'), 100);
  assert.deepEqual(r, { ok: true, data: { a: 1 } });
});

test("rechaza cuerpos demasiado grandes sin validarlos (413)", async () => {
  const huge = JSON.stringify({ items: Array.from({ length: 5000 }, () => ({ productId: "x", quantity: 1 })) });
  assert.deepEqual(await readJsonBody(req(huge), 20_000), { ok: false, status: 413 });
  // aunque la cabecera mienta sobre el tamaño
  assert.deepEqual(await readJsonBody(req(huge, { "content-length": "10" }), 20_000), { ok: false, status: 413 });
});

test("JSON inválido devuelve 400", async () => {
  assert.deepEqual(await readJsonBody(req("{no"), 100), { ok: false, status: 400 });
});
