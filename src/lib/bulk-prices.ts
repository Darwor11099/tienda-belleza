import { formatCOP } from "@/lib/format";
import { grossMargin } from "@/lib/pricing";
import { PRODUCT_FILTERS, type ProductFilter } from "@/lib/admin-products";

/** Cambio masivo de precios: cálculo puro de la vista previa (probado sin base de datos). */

export const ROUNDINGS = [
  { id: "ninguno", label: "Sin redondear" },
  { id: "100", label: "A la centena ($38.420 → $38.400)" },
  { id: "1000", label: "Al millar ($38.420 → $38.000)" },
  { id: "900", label: "Terminar en 900 ($38.420 → $38.900)" },
] as const;
export type Rounding = (typeof ROUNDINGS)[number]["id"];

export type BulkParams = {
  filter: ProductFilter;
  category: string | null;
  q: string;
  base: "venta" | "detal";
  op: "porcentaje" | "monto";
  value: number; // % o pesos; puede ser negativo
  rounding: Rounding;
};

export type BulkRow = { id: string; name: string; sku: string | null; price_cop: number | null; reference_price_cop: number | null; cost: number | null };
export type BulkChange = { id: string; name: string; sku: string | null; old: number | null; next: number; cost: number | null; belowCost: boolean; marginPct: number | null };

export function parseBulkParams(sp: Record<string, string | string[] | undefined>): { params: BulkParams; ready: boolean; error?: string } {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const filter = (PRODUCT_FILTERS.find((f) => f.id === one(sp.filtro))?.id ?? "todos") as ProductFilter;
  const cat = one(sp.categoria);
  const base = one(sp.base) === "detal" ? "detal" : "venta";
  const op = one(sp.op) === "monto" ? "monto" : "porcentaje";
  const rounding = (ROUNDINGS.find((r) => r.id === one(sp.redondeo))?.id ?? "100") as Rounding;
  const raw = one(sp.valor).replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = raw === "" ? NaN : Number(raw);
  const params: BulkParams = {
    filter,
    category: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(cat) ? cat : null,
    q: one(sp.q).replace(/\s+/g, " ").trim().slice(0, 60),
    base,
    op,
    value: Number.isFinite(value) ? value : 0,
    rounding,
  };
  if (raw === "") return { params, ready: false };
  if (!Number.isFinite(value)) return { params, ready: false, error: "Escribe un número válido." };
  if (op === "porcentaje" && (value < -90 || value > 500)) return { params, ready: false, error: "El porcentaje debe estar entre -90 y 500." };
  if (op === "monto" && Math.abs(value) > 10_000_000) return { params, ready: false, error: "El monto es demasiado grande." };
  if (op === "monto" && !Number.isInteger(value)) return { params, ready: false, error: "El monto debe ser en pesos, sin decimales." };
  if (value === 0 && base === "venta") return { params, ready: false, error: "Con 0 % o $0 no cambiaría ningún precio." };
  return { params, ready: true };
}

export function roundPrice(x: number, r: Rounding): number {
  switch (r) {
    case "100": return Math.round(x / 100) * 100;
    case "1000": return Math.round(x / 1000) * 1000;
    case "900": return x <= 900 ? 900 : Math.ceil((x - 900) / 1000) * 1000 + 900;
    default: return Math.round(x);
  }
}

export function newPrice(base: number, p: Pick<BulkParams, "op" | "value" | "rounding">): number {
  const raw = p.op === "porcentaje" ? base * (1 + p.value / 100) : base + p.value;
  return roundPrice(raw, p.rounding);
}

/** Cambios a aplicar: solo productos con precio base y cuyo precio realmente cambia. */
export function buildChanges(rows: BulkRow[], p: BulkParams): { changes: BulkChange[]; skippedNoBase: number; unchanged: number; invalid: number } {
  const changes: BulkChange[] = [];
  let skippedNoBase = 0, unchanged = 0, invalid = 0;
  for (const r of rows) {
    const base = p.base === "detal" ? r.reference_price_cop : r.price_cop;
    if (base === null || base <= 0) { skippedNoBase++; continue; }
    const next = newPrice(base, p);
    if (!Number.isInteger(next) || next <= 0) { invalid++; continue; }
    if (next === r.price_cop) { unchanged++; continue; }
    const m = grossMargin(next, r.cost);
    changes.push({ id: r.id, name: r.name, sku: r.sku, old: r.price_cop, next, cost: r.cost, belowCost: r.cost !== null && next < r.cost, marginPct: m?.marginPct ?? null });
  }
  return { changes, skippedNoBase, unchanged, invalid };
}

export function describeBulk(p: BulkParams, filterLabel: string, categoryName: string | null): string {
  const sign = p.value >= 0 ? "+" : "−";
  const amount = p.op === "porcentaje" ? `${sign}${String(Math.abs(p.value)).replace(".", ",")} %` : `${sign}${formatCOP(Math.abs(p.value))}`;
  const base = p.base === "detal" ? "precio DETAL" : "precio de venta";
  const round = ROUNDINGS.find((r) => r.id === p.rounding)!.label.split(" (")[0].toLowerCase();
  const scope = [filterLabel, categoryName, p.q ? `«${p.q}»` : null].filter(Boolean).join(" · ");
  return `${amount} sobre el ${base}, ${round}. Productos: ${scope}.`;
}
