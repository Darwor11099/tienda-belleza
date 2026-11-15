/**
 * Lector mínimo de archivos .xlsx (sin dependencias externas).
 *
 * Solo lee valores de celdas: ignora imágenes, dibujos y formatos. Así no falla
 * con libros que contienen miniaturas (como el Excel de revisión del catálogo)
 * y no arrastra librerías con vulnerabilidades. Uso: solo en scripts locales.
 */
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

export type CellValue = string | number | boolean | null;
export type Sheet = { name: string; rows: Map<number, CellValue[]> };

// ---------------------------------------------------------------------
// ZIP (un .xlsx es un ZIP con archivos XML)
// ---------------------------------------------------------------------
function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("El archivo no es un .xlsx válido (no se encontró el índice ZIP).");
  const entries = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Índice ZIP dañado.");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue; // imágenes: no hacen falta
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + compSize);
    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) files.set(name, inflateRawSync(data));
    else throw new Error(`Compresión no soportada en ${name}.`);
  }
  return files;
}

// ---------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------
function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = decode(m[2]);
  return out;
}

/** Texto de un <si> o <is>: concatena todos los <t>, sin la guía fonética (<rPh>). */
function richText(xml: string): string {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) out += decode(m[1] ?? "");
  return out;
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ---------------------------------------------------------------------
// Libro
// ---------------------------------------------------------------------
export function readXlsx(path: string): Map<string, Sheet> {
  const files = unzip(readFileSync(path));
  const text = (name: string) => files.get(name)?.toString("utf8");

  const shared: string[] = [];
  const sst = text("xl/sharedStrings.xml");
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(richText(m[1]));

  const rels = new Map<string, string>();
  for (const m of (text("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const a = attrs(m[0]);
    if (a.Id && a.Target) rels.set(a.Id, a.Target.startsWith("/") ? a.Target.slice(1) : `xl/${a.Target}`);
  }

  const sheets = new Map<string, Sheet>();
  for (const m of (text("xl/workbook.xml") ?? "").matchAll(/<sheet\b[^>]*>/g)) {
    const a = attrs(m[0]);
    const target = rels.get(a["r:id"] ?? "");
    const xml = target ? text(target) : undefined;
    if (!a.name || !xml) continue;
    const rows = new Map<number, CellValue[]>();
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const r = Number(attrs(`<row ${rm[1]}>`).r);
      const cells: CellValue[] = [];
      for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ca = attrs(`<c ${cm[1]}>`);
        const body = cm[2] ?? "";
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let value: CellValue = null;
        switch (ca.t) {
          case "s":
            value = v === undefined ? null : shared[Number(v)] ?? null;
            break;
          case "inlineStr":
            value = richText(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
            break;
          case "str":
            value = v === undefined ? null : decode(v);
            break;
          case "b":
            value = v === "1";
            break;
          case "e":
            value = null;
            break;
          default:
            value = v === undefined || v === "" ? null : Number(v);
        }
        if (typeof value === "string" && value === "") value = null;
        cells[colIndex(ca.r ?? "A")] = value;
      }
      if (r) rows.set(r, cells);
    }
    sheets.set(a.name, { name: a.name, rows });
  }
  return sheets;
}

/** Filas de una hoja como objetos usando la fila 1 como encabezados. */
export function sheetRecords(sheet: Sheet): { row: number; get: (header: string) => CellValue }[] {
  const headerRow = sheet.rows.get(1) ?? [];
  const headers = new Map<string, number>();
  headerRow.forEach((h, i) => {
    if (typeof h === "string") headers.set(h.trim(), i);
  });
  const out: { row: number; get: (header: string) => CellValue }[] = [];
  for (const [r, cells] of [...sheet.rows.entries()].sort((a, b) => a[0] - b[0])) {
    if (r === 1) continue;
    out.push({
      row: r,
      get: (header) => {
        const i = headers.get(header);
        if (i === undefined) throw new Error(`La hoja «${sheet.name}» no tiene la columna «${header}».`);
        return cells[i] ?? null;
      },
    });
  }
  return out;
}
