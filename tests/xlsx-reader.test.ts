import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readXlsx, sheetRecords } from "../src/lib/xlsx-reader";

const file = path.join(__dirname, "fixtures", "mini.xlsx");

test("lee hojas, textos con símbolos y números; ignora imágenes", () => {
  const book = readXlsx(file);
  assert.deepEqual([...book.keys()], ["Productos", "Variantes"]);
  const rows = sheetRecords(book.get("Productos")!);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].get("Nombre del producto"), "Tónico «Rosas» & Agua <300 ml>");
  assert.equal(rows[0].get("Precio DETAL proveedor (COP)"), 38000);
  assert.equal(rows[1].get("Precio DETAL proveedor (COP)"), null);
  assert.equal(rows[0].row, 2);
});

test("una columna inexistente da un error claro", () => {
  const rows = sheetRecords(readXlsx(file).get("Productos")!);
  assert.throws(() => rows[0].get("No existe"), /no tiene la columna «No existe»/);
});
