"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart/store";
import type { PriceUpdate } from "@/lib/cart/cart";
import { formatCOP } from "@/lib/format";

const KEY_STORAGE = "tienda:pedido:clave";

/** UUID v4. crypto.randomUUID solo existe en https/localhost; al probar desde el celular por la red local no. */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Clave del intento de compra: se reutiliza en reintentos para no duplicar pedidos. */
function attemptKey(): string {
  try {
    const existing = window.sessionStorage.getItem(KEY_STORAGE);
    if (existing) return existing;
    const key = uuid();
    window.sessionStorage.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return uuid();
  }
}

type Errors = Record<string, string>;
const input =
  "mt-1.5 h-12 w-full rounded-2xl border border-input bg-card px-4 text-base focus:border-primary focus:outline-none aria-[invalid=true]:border-destructive";

export function CheckoutForm() {
  const router = useRouter();
  const { cart, totals, dispatch } = useCart();
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const [done, setDone] = useState(false);

  // Verificar precios al llegar al formulario
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current || cart.lines.length === 0) return;
    synced.current = true;
    void syncPrices(cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId })), dispatch);
  }, [cart.lines, dispatch]);

  if (done) return <p className="py-16 text-center text-muted-foreground">Abriendo la confirmación de tu pedido…</p>;

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-3xl border bg-card px-6 py-16 text-center">
        <p className="font-display text-3xl">Tu carrito está vacío</p>
        <Link href="/catalogo" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground">Ver catálogo</Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return; // doble clic
    busy.current = true;
    setSending(true);
    setMessage(null);
    setErrors({});
    const f = new FormData(e.currentTarget);
    const body = {
      idempotencyKey: attemptKey(),
      website: String(f.get("website") ?? ""),
      customer: {
        name: String(f.get("name") ?? ""),
        whatsapp: String(f.get("whatsapp") ?? ""),
        email: String(f.get("email") ?? ""),
        city: String(f.get("city") ?? ""),
        address: String(f.get("address") ?? ""),
        notes: String(f.get("notes") ?? ""),
        dataConsent: f.get("dataConsent") === "on",
      },
      items: cart.lines.filter((l) => !l.unavailable).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    };
    try {
      const res = await fetch("/api/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDone(true);
        try { window.sessionStorage.removeItem(KEY_STORAGE); } catch {}
        dispatch({ type: "clear" });
        router.replace(`/pedido/${data.token}?nuevo=1`);
        return;
      }
      setErrors(data.fields ?? {});
      setMessage(data.message ?? "No pudimos registrar tu pedido.");
      if (data.refreshCart) await syncPrices(cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId })), dispatch);
    } catch {
      setMessage("No hay conexión. Revisa tu internet y vuelve a intentarlo; no se duplicará el pedido.");
    }
    busy.current = false;
    setSending(false);
  }

  const err = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `e-${k}` } : {});
  const hint = (k: string) => errors[k] && <p id={`e-${k}`} className="mt-1 text-sm text-destructive">{errors[k]}</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5 rounded-3xl border bg-card p-5 sm:p-8">
        <h2 className="font-display text-2xl">Tus datos</h2>
        <div>
          <label htmlFor="name" className="text-sm font-medium">Nombre completo</label>
          <input id="name" name="name" autoComplete="name" required maxLength={120} className={input} {...err("name")} />
          {hint("name")}
        </div>
        <div>
          <label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" className={input} {...err("whatsapp")} />
          {hint("whatsapp")}
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Correo <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <input id="email" name="email" type="email" autoComplete="email" maxLength={160} className={input} {...err("email")} />
          {hint("email")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className="text-sm font-medium">Ciudad</label>
            <input id="city" name="city" autoComplete="address-level2" required maxLength={80} className={input} {...err("city")} />
            {hint("city")}
          </div>
          <div>
            <label htmlFor="address" className="text-sm font-medium">Dirección <span className="font-normal text-muted-foreground">(si es envío)</span></label>
            <input id="address" name="address" autoComplete="street-address" maxLength={300} className={input} {...err("address")} />
            {hint("address")}
          </div>
        </div>
        <div>
          <label htmlFor="notes" className="text-sm font-medium">Observaciones <span className="font-normal text-muted-foreground">(opcional)</span></label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className={`${input} h-auto py-3`} {...err("notes")} />
          {hint("notes")}
        </div>
        {/* Campo trampa contra robots: oculto para las personas */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">No completar</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="dataConsent" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" {...err("dataConsent")} />
          <span>Autorizo el uso de mis datos para gestionar este pedido y contactarme por WhatsApp. <Link href="/privacidad" target="_blank" className="underline underline-offset-4">Política de privacidad</Link></span>
        </label>
        {hint("dataConsent")}
      </div>

      <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl">Tu pedido</h2>
        <ul className="space-y-3 text-sm">
          {cart.lines.map((l) => (
            <li key={l.key} className={`flex justify-between gap-3 ${l.unavailable ? "text-muted-foreground line-through" : ""}`}>
              <span>
                {l.quantity} × {l.name}
                {l.variantName && <span className="block text-xs text-muted-foreground">Tono: {l.variantName}</span>}
              </span>
              <span className="shrink-0">{formatCOP(l.unitPrice * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t border-gold/40 pt-4">
          <span className="font-medium">Total productos</span>
          <span className="font-display text-3xl" data-testid="checkout-total">{formatCOP(totals.total)}</span>
        </div>
        <p className="text-xs text-muted-foreground">El envío y la forma de pago se confirman por WhatsApp. Los precios se verifican al registrar el pedido.</p>
        {totals.hasUnavailable && (
          <p className="text-sm text-destructive">
            Hay productos que ya no están disponibles. <Link href="/carrito" className="underline">Revisa tu carrito</Link>.
          </p>
        )}
        {message && <p role="alert" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{message}</p>}
        <button
          type="submit"
          disabled={sending || totals.hasUnavailable || totals.units === 0}
          className="h-12 w-full rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sending ? "Registrando pedido…" : "Confirmar pedido"}
        </button>
        <Link href="/carrito" className="block text-center text-sm underline underline-offset-4">Volver al carrito</Link>
      </aside>
    </form>
  );
}

async function syncPrices(items: { productId: string; variantId: string | null }[], dispatch: ReturnType<typeof useCart>["dispatch"]) {
  try {
    const r = await fetch("/api/carrito/precios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    if (!r.ok) return;
    const data: { updates: PriceUpdate[] } = await r.json();
    dispatch({ type: "sync", updates: data.updates });
  } catch {}
}
