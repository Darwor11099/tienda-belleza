import { AVAILABILITY_LABEL, type Availability } from "@/lib/catalog-view";

const DOT: Record<Availability, string> = {
  disponible: "bg-[#4f7a5a]",
  consultar: "bg-gold",
  agotado: "bg-muted-foreground/50",
};

export function AvailabilityLabel({ value, className = "" }: { value: Availability; className?: string }) {
  return (
    <p className={`inline-flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[value]}`} />
      {AVAILABILITY_LABEL[value]}
    </p>
  );
}
