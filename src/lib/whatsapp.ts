/**
 * Enlaces oficiales de WhatsApp (wa.me) con mensaje precargado.
 * El mensaje NO se envía solo: la persona debe pulsar "Enviar" en WhatsApp.
 */

/**
 * Normaliza un número para wa.me (solo dígitos, con indicativo).
 * Acepta:
 *   - celular colombiano de 10 dígitos que empieza por 3 → se le añade el 57;
 *   - celular colombiano con indicativo: 57 + 3 + 9 dígitos;
 *   - número internacional completo de otro país (11 a 15 dígitos, sin empezar por 57).
 * Cualquier otro (por ejemplo 10 dígitos que no empiezan por 3) es ambiguo y se rechaza.
 */
export function normalizeWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^00/, "");
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  if (/^\d{11,15}$/.test(digits) && !digits.startsWith("57")) return digits;
  return null;
}

export function whatsappLink(number: string, message?: string): string | null {
  const normalized = normalizeWhatsApp(number);
  if (!normalized) return null;
  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
