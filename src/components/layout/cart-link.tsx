"use client";

import Link from "next/link";
import { BagIcon } from "@/components/layout/icons";
import { useCart } from "@/lib/cart/store";

export function CartLink() {
  const { totals } = useCart();
  const n = totals.units;
  return (
    <Link
      href="/carrito"
      aria-label={n > 0 ? `Carrito, ${n} ${n === 1 ? "unidad" : "unidades"}` : "Carrito vacío"}
      className="relative inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-accent"
    >
      <BagIcon className="size-6" />
      {n > 0 && (
        <span className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-medium text-primary-foreground">
          {n > 99 ? "99+" : n}
        </span>
      )}
    </Link>
  );
}
