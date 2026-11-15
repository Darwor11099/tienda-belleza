import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";

/** Pestañas del panel de pedidos (pura, probada). */
export const TABS = [
  { id: "nuevos", label: "Nuevos" },
  { id: "pendiente", label: "Pendientes" },
  { id: "confirmado", label: "Confirmados" },
  { id: "preparando", label: "Preparando" },
  { id: "enviado", label: "Enviados" },
  { id: "entregado", label: "Completados" },
  { id: "cancelado", label: "Cancelados" },
  { id: "todos", label: "Todos" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

export function parseTab(v: string | undefined): TabId {
  return (TABS.find((t) => t.id === v)?.id ?? "nuevos") as TabId;
}

type Row = { status: OrderStatus; seen_at: string | null };

export function tabMatches(tab: TabId, row: Row): boolean {
  if (tab === "todos") return true;
  if (tab === "nuevos") return row.status === "pendiente" && row.seen_at === null;
  return row.status === tab;
}

export function tabCounts(rows: Row[]): Record<TabId, number> {
  const out = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<TabId, number>;
  for (const r of rows) for (const t of TABS) if (tabMatches(t.id, r)) out[t.id]++;
  return out;
}

export const isStatus = (v: unknown): v is OrderStatus => typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);
