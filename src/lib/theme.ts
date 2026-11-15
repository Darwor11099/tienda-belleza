/** Color de marca configurable con contraste suficiente para texto blanco (WCAG AA). */
export const DEFAULT_BRAND = "#a3445e";

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/** Devuelve el color si es válido y legible con texto blanco; si no, el de la marca por defecto. */
export function safeBrandColor(input: string | null | undefined): string {
  if (!input || !/^#[0-9a-fA-F]{6}$/.test(input)) return DEFAULT_BRAND;
  return contrastWithWhite(input) >= 4.5 ? input.toLowerCase() : DEFAULT_BRAND;
}
