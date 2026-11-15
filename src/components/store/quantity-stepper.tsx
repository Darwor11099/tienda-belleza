"use client";

import { MinusIcon, PlusIcon } from "@/components/layout/icons";
import { MAX_QTY } from "@/lib/cart/cart";

type Props = { value: number; onChange: (n: number) => void; label: string; size?: "md" | "sm" };

export function QuantityStepper({ value, onChange, label, size = "md" }: Props) {
  const h = size === "md" ? "h-12" : "h-10";
  const btn = `inline-flex ${size === "md" ? "w-12" : "w-10"} items-center justify-center text-foreground disabled:text-muted-foreground/50`;
  return (
    <div role="group" aria-label={label} className={`inline-flex ${h} items-stretch rounded-full border border-input bg-card`}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Quitar una unidad">
        <MinusIcon className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_QTY}
        value={value}
        aria-label="Cantidad"
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(MAX_QTY, Math.max(1, n)));
        }}
        className="w-10 [appearance:textfield] bg-transparent text-center text-base tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label="Añadir una unidad">
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
