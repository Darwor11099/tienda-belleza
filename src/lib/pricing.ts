/** Cálculos de precios. Solo para mostrar: el total real lo calcula la base de datos. */

export type CartLine = { unitPrice: number; quantity: number };

export function lineTotal({ unitPrice, quantity }: CartLine): number {
  return unitPrice * quantity;
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line), 0);
}

export type Margin = { grossProfit: number; marginPct: number } | null;

/**
 * Ganancia bruta estimada de un producto.
 * Devuelve null si falta el costo o el precio (no se inventa ninguno).
 * marginPct = ganancia / precio de venta, con un decimal.
 */
export function grossMargin(priceCop: number | null, costCop: number | null): Margin {
  if (priceCop == null || costCop == null || priceCop <= 0) return null;
  const grossProfit = priceCop - costCop;
  const marginPct = Math.round((grossProfit / priceCop) * 1000) / 10;
  return { grossProfit, marginPct };
}
