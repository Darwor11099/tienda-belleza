import { formatCOP } from "@/lib/format";

export function Price({ amount, from = false, className = "" }: { amount: number; from?: boolean; className?: string }) {
  return (
    <p className={`font-display ${className}`}>
      {from && <span className="mr-1 font-sans text-xs text-muted-foreground">Desde</span>}
      {formatCOP(amount)}
    </p>
  );
}
