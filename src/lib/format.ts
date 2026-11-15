/**
 * Formato de pesos colombianos: $25.000, $1.250.000.
 * Se construye a mano para que el resultado sea idéntico en servidor y
 * navegador (Intl puede insertar espacios distintos según el sistema).
 */
export function formatCOP(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$${digits}`;
}

/** Convierte un texto como "25.000", "$25.000" o "25000" en número entero. */
export function parseCOP(input: string): number | null {
  const clean = input.replace(/[$\s.]/g, "");
  if (!/^\d+$/.test(clean)) return null;
  const n = Number.parseInt(clean, 10);
  return Number.isSafeInteger(n) ? n : null;
}
