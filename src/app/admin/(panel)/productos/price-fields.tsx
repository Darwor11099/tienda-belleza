"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { grossMargin } from "@/lib/pricing";
import { formatPct } from "@/lib/admin-products";

const toInt = (s: string) => {
  const d = s.replace(/[$\s.]/g, "");
  return /^\d{1,9}$/.test(d) && Number(d) > 0 ? Number(d) : null;
};
const field = "mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-base focus:border-primary focus:outline-none";

/** Precio de venta y costo con la ganancia calculada mientras se escribe. */
export function PriceFields({ price, cost, reference }: { price: number | null; cost: number | null; reference: number | null }) {
  const [p, setP] = useState(price?.toString() ?? "");
  const [c, setC] = useState(cost?.toString() ?? "");
  const m = grossMargin(toInt(p), toInt(c));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="text-sm">
        <span className="text-muted-foreground">Precio de venta (COP)</span>
        <input name="price" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} placeholder="Sin precio" className={field} />
        {reference !== null && <span className="mt-1 block text-xs text-muted-foreground">DETAL del proveedor: {formatCOP(reference)}</span>}
      </label>
      <label className="text-sm">
        <span className="text-muted-foreground">Costo real de compra (COP)</span>
        <input name="cost" inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} placeholder="Sin registrar" className={field} />
        <span className="mt-1 block text-xs text-muted-foreground">Privado: nunca lo ve la clienta.</span>
      </label>
      <div className="text-sm">
        <span className="text-muted-foreground">Ganancia bruta estimada</span>
        <p className={`mt-1 flex h-11 items-center font-display text-xl ${m && m.grossProfit < 0 ? "text-destructive" : ""}`} data-testid="margin">
          {m ? `${formatCOP(m.grossProfit)} · ${formatPct(m.marginPct)}` : "—"}
        </p>
        <span className="block text-xs text-muted-foreground">{m ? "Precio de venta menos costo real." : "Necesita precio de venta y costo real."}</span>
      </div>
    </div>
  );
}
