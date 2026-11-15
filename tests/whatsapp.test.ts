import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsApp, whatsappLink } from "../src/lib/whatsapp";

test("normaliza celulares colombianos", () => {
  assert.equal(normalizeWhatsApp("300 123 4567"), "573001234567");
  assert.equal(normalizeWhatsApp("+57 300-123-4567"), "573001234567");
  assert.equal(normalizeWhatsApp("123"), null);
  assert.equal(normalizeWhatsApp("573001234567"), "573001234567");
});

test("rechaza números ambiguos y acepta internacionales completos", () => {
  assert.equal(normalizeWhatsApp("9046672647"), null); // 10 dígitos que no empiezan por 3
  assert.equal(normalizeWhatsApp("314 487 693"), null); // 9 dígitos
  assert.equal(normalizeWhatsApp("5760112345678"), null); // 57 sin celular
  assert.equal(normalizeWhatsApp("+1 305 555 0100"), "13055550100");
  assert.equal(normalizeWhatsApp("0034 612 345 678"), "34612345678");
});

test("genera enlace wa.me con mensaje codificado", () => {
  assert.equal(
    whatsappLink("3001234567", "Hola, pedido #1001: $149.000"),
    "https://wa.me/573001234567?text=Hola%2C%20pedido%20%231001%3A%20%24149.000",
  );
  assert.equal(whatsappLink("3001234567"), "https://wa.me/573001234567");
  assert.equal(whatsappLink("abc", "x"), null);
});
