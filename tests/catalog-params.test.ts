import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogHref, pageList, parseCatalogParams, searchTerms } from "../src/lib/catalog-params";
import { displayPrice, effectiveAvailability } from "../src/lib/catalog-view";

test("parámetros válidos e inválidos", () => {
  assert.deepEqual(parseCatalogParams({}), { q: "", category: null, sort: "destacados", page: 1 });
  assert.deepEqual(parseCatalogParams({ q: "  serum  vitamina ", categoria: "rostro", orden: "precio-asc", pagina: "3" }),
    { q: "serum vitamina", category: "rostro", sort: "precio-asc", page: 3 });
  assert.deepEqual(parseCatalogParams({ categoria: "../admin", orden: "drop", pagina: "-1" }),
    { q: "", category: null, sort: "destacados", page: 1 });
  assert.equal(parseCatalogParams({ q: ["a", "b"] }).q, "a");
});

test("enlaces: cambiar filtro vuelve a la página 1; paginar conserva filtros", () => {
  const cur = { q: "kaba", category: "cabello", sort: "nombre" as const, page: 4 };
  assert.equal(catalogHref(cur, { category: "rostro" }), "/catalogo?q=kaba&categoria=rostro&orden=nombre");
  assert.equal(catalogHref(cur, { page: 5 }), "/catalogo?q=kaba&categoria=cabello&orden=nombre&pagina=5");
  assert.equal(catalogHref(cur, { q: "", category: null, sort: "destacados" }), "/catalogo");
});

test("búsqueda sin tildes y sin símbolos peligrosos", () => {
  assert.deepEqual(searchTerms("Poción  ÁCIDO"), ["pocion", "acido"]);
  assert.deepEqual(searchTerms("100%_(x),y*"), ["100", "x", "y"]);
  assert.deepEqual(searchTerms("2728"), ["2728"]);
  assert.deepEqual(searchTerms("a b c d e f g").length, 5);
});

test("paginación compacta", () => {
  assert.deepEqual(pageList(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageList(6, 20), [1, "…", 5, 6, 7, "…", 20]);
  assert.deepEqual(pageList(1, 20), [1, 2, "…", 20]);
});

test("precio 'desde' y disponibilidad con variantes", () => {
  const base = { price_cop: 30000, has_variants: true, availability: "consultar" as const };
  assert.deepEqual(displayPrice({ ...base, variants: [{ id: "1", price_cop: null, availability: "disponible" }] }), { amount: 30000, from: false });
  assert.deepEqual(displayPrice({ ...base, variants: [{ id: "1", price_cop: 28000, availability: "disponible" }, { id: "2", price_cop: null, availability: "consultar" }] }), { amount: 28000, from: true });
  assert.equal(effectiveAvailability({ ...base, variants: [{ id: "1", price_cop: null, availability: "agotado" }] }), "agotado");
  assert.equal(effectiveAvailability({ ...base, variants: [{ id: "1", price_cop: null, availability: "agotado" }, { id: "2", price_cop: null, availability: "disponible" }] }), "disponible");
  assert.equal(effectiveAvailability({ ...base, has_variants: false, variants: [] }), "consultar");
});

import { safeBrandColor } from "../src/lib/theme";
test("color de marca: válido y legible, si no el predeterminado", () => {
  assert.equal(safeBrandColor("#7F3247"), "#7f3247");
  assert.equal(safeBrandColor("#F3D5DA"), "#a3445e"); // rosa pastel: texto blanco ilegible
  assert.equal(safeBrandColor("rojo"), "#a3445e");
  assert.equal(safeBrandColor(null), "#a3445e");
});
