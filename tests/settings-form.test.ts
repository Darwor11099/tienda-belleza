import { test } from "node:test";
import assert from "node:assert/strict";
import { brandColorWarning, isValidBrandPath, settingsFormToObject, settingsSchema } from "../src/lib/settings-form";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const base = { store_name: " Bella  Tienda ", whatsapp_number: "314 378 8951", instagram_url: "https://instagram.com/bella", brand_color: "#7F3247" };

test("normaliza y valida la configuración", () => {
  const r = settingsSchema.parse(settingsFormToObject(fd(base)));
  assert.equal(r.store_name, "Bella Tienda");
  assert.equal(r.whatsapp_number, "573143788951");
  assert.equal(r.brand_color, "#7f3247");
  assert.equal(r.tagline, null);
  assert.equal(r.product_photos_enabled, false);
});

test("rechaza WhatsApp ambiguo, enlaces sin https y colores mal escritos", () => {
  assert.equal(settingsSchema.safeParse(settingsFormToObject(fd({ ...base, whatsapp_number: "9046672647" }))).success, false);
  assert.equal(settingsSchema.safeParse(settingsFormToObject(fd({ ...base, instagram_url: "http://instagram.com/x" }))).success, false);
  assert.equal(settingsSchema.safeParse(settingsFormToObject(fd({ ...base, instagram_url: "javascript:alert(1)" }))).success, false);
  assert.equal(settingsSchema.safeParse(settingsFormToObject(fd({ ...base, brand_color: "rosa" }))).success, false);
  assert.equal(settingsSchema.safeParse(settingsFormToObject(fd({ ...base, store_name: "A" }))).success, false);
});

test("avisa si el color no sirve para botones", () => {
  assert.equal(brandColorWarning("#f3d5da") !== null, true);
  assert.equal(brandColorWarning("#7f3247"), null);
  assert.equal(brandColorWarning(null), null);
});

test("rutas de logo y portada", () => {
  assert.equal(isValidBrandPath("marca/logo-33333333-3333-4333-8333-333333333333.webp"), true);
  assert.equal(isValidBrandPath("marca/../productos/x.webp"), false);
});
