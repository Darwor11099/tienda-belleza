/**
 * Valores por defecto mientras no exista configuración en la base.
 * El nombre real, el logo y el WhatsApp se cambian desde el panel
 * (tabla store_settings), no aquí.
 */
export const siteConfig = {
  fallbackName: "Tienda Belleza",
  description:
    "Maquillaje, cuidado facial, capilar y corporal, perfumería y accesorios. Pedidos con atención por WhatsApp.",
  locale: "es-CO",
} as const;

/**
 * Tono de cada categoría, como el godet de una paleta de maquillaje.
 * Solo decorativo: el texto nunca va sobre estos colores sin contraste suficiente.
 */
export const categoryTints: Record<string, string> = {
  rostro: "#E7C3AE",
  ojos: "#C7B4D2",
  labios: "#C46A80",
  cabello: "#DFC79C",
  cuerpo: "#EED8C6",
  perfumeria: "#E6C2CB",
  "maquillaje-y-sets": "#D59F9C",
  "herramientas-y-accesorios": "#CDB898",
};
