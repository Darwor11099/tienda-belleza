import "server-only";
import { createHash, createHmac } from "node:crypto";

/**
 * El token del enlace de seguimiento se deriva de la clave de idempotencia con
 * un secreto del servidor. Así, si la clienta reintenta (doble clic, red lenta),
 * recibe el mismo enlace sin que la base guarde el token en claro.
 */
function secret(): string {
  const s = process.env.ORDER_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("Falta ORDER_TOKEN_SECRET (mínimo 32 caracteres) en .env.local");
  return s;
}

export function orderToken(idempotencyKey: string): string {
  return createHmac("sha256", secret()).update(`pedido:${idempotencyKey}`).digest("hex");
}

/** Huella de la IP para limitar abusos sin guardar la IP real. */
export function ipFingerprint(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${secret()}:${ip}`).digest("hex");
}
