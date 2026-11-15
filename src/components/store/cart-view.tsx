"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/layout/icons";
import { QuantityStepper } from "@/components/store/quantity-stepper";
import { useCart } from "@/lib/cart/store";
import { formatCOP } from "@/lib/format";
import type { PriceUpdate } from "@/lib/cart/cart";

/** Carrito: cantidades, subtotales, total y paso al checkout. */
export function CartView() {
  const { cart, totals, dispatch } = useCart();
  const [checking, setChecking] = useState(false);
  const checked = useRef(false);

  // Al abrir el carrito se confirman precios y disponibilidad actuales
  useEffect(() => {
    if (checked.current || cart.lines.length === 0) return;
    checked.current = true;
    setChecking(true);
    fetch("/api/carrito/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.lines.map((l) => ({ productId: l.productId, variantId: l.variantId })) }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { updates: PriceUpdate[] } | null) => {
        if (data) dispatch({ type: "sync", updates: data.updates });
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [cart.lines, dispatch]);

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-3xl border bg-card px-6 py-16 text-center">
        <p className="font-display text-3xl">Tu carrito está vacío</p>
        <p className="mt-3 text-muted-foreground">Explora el catálogo y añade los productos que quieras pedir.</p>
        <Link href="/catalogo" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground">
          Ver catálogo
        </Link>
      </div>
    );
  }

  const subtotal = new Map(totals.lines.map((l) => [l.key, l.subtotal]));

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
      <ul className="divide-y rounded-3xl border bg-card">
        {cart.lines.map((l) => (
          <li key={l.key} className={`flex gap-4 p-4 sm:p-5 ${l.unavailable ? "opacity-60" : ""}`}>
            <Link href={`/producto/${l.slug}`} className="relative block size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
              {l.imageUrl ? (
                <Image src={l.imageUrl} alt="" fill sizes="96px" className="object-contain p-1" />
              ) : (
                <span className="flex h-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">Imagen próximamente</span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/producto/${l.slug}`} className="line-clamp-2 leading-snug hover:text-primary">{l.name}</Link>
                  {l.variantName && <p className="mt-0.5 text-sm">Tono: <span className="font-medium">{l.variantName}</span></p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.sku ? `Ref. ${l.sku} · ` : ""}{formatCOP(l.unitPrice)} c/u
                  </p>
                  {l.unavailable && <p className="mt-1 text-sm text-destructive">Ya no está disponible. Quítalo para continuar.</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "remove", key: l.key })}
                  aria-label={`Quitar ${l.name}${l.variantName ? ` (${l.variantName})` : ""}`}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                <QuantityStepper
                  size="sm"
                  value={l.quantity}
                  label={`Cantidad de ${l.name}`}
                  onChange={(n) => dispatch({ type: "set", key: l.key, quantity: n })}
                />
                <p className="font-display text-lg" data-testid="line-subtotal">{formatCOP(subtotal.get(l.key) ?? 0)}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit space-y-4 rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between"><dt>Productos</dt><dd>{totals.units} {totals.units === 1 ? "unidad" : "unidades"}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd className="text-muted-foreground">Se confirma por WhatsApp</dd></div>
        </dl>
        <div className="flex items-baseline justify-between border-t border-gold/40 pt-4">
          <span className="font-medium">Total</span>
          <span className="font-display text-3xl" data-testid="cart-total">{formatCOP(totals.total)}</span>
        </div>
        {checking && <p className="text-xs text-muted-foreground">Confirmando precios…</p>}
        {totals.hasUnavailable && <p className="text-sm text-destructive">Hay productos que ya no están disponibles; no se suman al total.</p>}
        {totals.hasUnavailable || totals.units === 0 ? (
          <p className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">Quita los productos no disponibles para continuar.</p>
        ) : (
          <Link href="/checkout" className="flex h-12 w-full items-center justify-center rounded-full bg-primary font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Continuar con el pedido
          </Link>
        )}
        <div className="flex items-center justify-between text-sm">
          <Link href="/catalogo" className="underline underline-offset-4">Seguir comprando</Link>
          <button type="button" onClick={() => dispatch({ type: "clear" })} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Vaciar carrito
          </button>
        </div>
      </aside>
    </div>
  );
}
