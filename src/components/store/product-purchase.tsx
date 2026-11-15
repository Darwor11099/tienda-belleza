"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChatIcon } from "@/components/layout/icons";
import { AvailabilityLabel } from "@/components/store/availability";
import { Price } from "@/components/store/price";
import { QuantityStepper } from "@/components/store/quantity-stepper";
import { dispatchCart } from "@/lib/cart/store";
import type { Availability } from "@/lib/catalog-view";
import { formatCOP } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";

export type PurchaseVariant = { id: string; name: string; price_cop: number | null; availability: Availability; imageUrl?: string | null };
type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    sku: string | null;
    price_cop: number;
    availability: Availability;
    has_variants: boolean;
    imageUrl: string | null;
  };
  variants: PurchaseVariant[];
  whatsappNumber: string | null;
};

export function ProductPurchase({ product, variants, whatsappNumber }: Props) {
  const groupId = useId();
  const needsVariant = product.has_variants && variants.length > 0;
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState<string | null>(null);
  const [missingVariant, setMissingVariant] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const unitPrice = variant?.price_cop ?? product.price_cop;
  const availability: Availability =
    product.availability === "agotado" ? "agotado" : variant ? variant.availability : product.availability;
  const soldOut = availability === "agotado" || (needsVariant && variants.every((v) => v.availability === "agotado"));

  function add() {
    if (needsVariant && !variant) {
      setMissingVariant(true);
      return;
    }
    dispatchCart({
      type: "add",
      quantity: qty,
      line: {
        productId: product.id,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        slug: product.slug,
        name: product.name,
        sku: product.sku,
        unitPrice,
        imageUrl: variant?.imageUrl ?? product.imageUrl,
      },
    });
    setAdded(`${qty} × ${product.name}${variant ? ` (${variant.name})` : ""}`);
  }

  const consult = whatsappNumber
    ? whatsappLink(
        whatsappNumber,
        `Hola, quiero consultar por ${product.name}${product.sku ? ` (Ref. ${product.sku})` : ""}${variant ? `, tono ${variant.name}` : ""}.`,
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <Price amount={unitPrice} className="text-4xl" />
        <AvailabilityLabel value={soldOut ? "agotado" : availability} />
      </div>

      {needsVariant && (
        <fieldset>
          <legend className="flex items-center gap-3 text-sm font-medium">
            {variant?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={variant.imageUrl} alt="" className="size-12 rounded-xl border bg-white object-contain p-0.5" />
            )}
            <span>Tono: <span className="font-normal text-muted-foreground">{variant?.name ?? "elige uno"}</span></span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-describedby={missingVariant ? `${groupId}-err` : undefined}>
            {variants.map((v) => {
              const out = v.availability === "agotado";
              const selected = v.id === variantId;
              return (
                <label
                  key={v.id}
                  className={`relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                    selected ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card hover:border-foreground/40"
                  } ${out ? "cursor-not-allowed text-muted-foreground line-through" : ""}`}
                >
                  <input
                    type="radio"
                    name={groupId}
                    value={v.id}
                    checked={selected}
                    disabled={out}
                    onChange={() => {
                      setVariantId(v.id);
                      setMissingVariant(false);
                      setAdded(null);
                    }}
                    className="sr-only"
                  />
                  {v.name}
                  {v.price_cop !== null && v.price_cop !== product.price_cop && (
                    <span className="ml-2 text-xs text-muted-foreground no-underline">{formatCOP(v.price_cop)}</span>
                  )}
                  {out && <span className="sr-only"> (agotado)</span>}
                </label>
              );
            })}
          </div>
          {missingVariant && (
            <p id={`${groupId}-err`} role="alert" className="mt-2 text-sm text-destructive">Elige un tono para añadirlo al carrito.</p>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={qty} onChange={(n) => { setQty(n); setAdded(null); }} label="Cantidad" />
        <button
          type="button"
          onClick={add}
          disabled={soldOut}
          className="h-12 flex-1 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground sm:flex-none"
        >
          {soldOut ? "Agotado" : "Añadir al carrito"}
        </button>
      </div>
      {!soldOut && qty > 1 && <p className="-mt-3 text-sm text-muted-foreground">Total: {formatCOP(unitPrice * qty)}</p>}

      <p aria-live="polite" className="min-h-6 text-sm">
        {added && (
          <>
            Añadido: {added}.{" "}
            <Link href="/carrito" className="font-medium text-primary underline underline-offset-4">Ver carrito</Link>
          </>
        )}
      </p>

      {consult && (
        <a
          href={consult}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center gap-2 rounded-full border border-input bg-card px-6 text-sm hover:border-primary hover:text-primary"
        >
          <ChatIcon className="size-5" />
          Consultar por WhatsApp
        </a>
      )}
    </div>
  );
}
