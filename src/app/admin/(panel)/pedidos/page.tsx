import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { parseTab, tabCounts, TABS } from "@/lib/admin-orders";
import { formatCOP } from "@/lib/format";
import { PAYMENT_STATUS_LABEL, STATUS_LABEL, type OrderStatus } from "@/lib/orders";

type Props = { searchParams: Promise<{ estado?: string }> };
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function OrdersPage({ searchParams }: Props) {
  const tab = parseTab((await searchParams).estado);
  const { supabase } = await requireAdmin();

  const { data: all } = await supabase.from("orders").select("status, seen_at").limit(5000);
  const counts = tabCounts((all ?? []) as { status: OrderStatus; seen_at: string | null }[]);

  let q = supabase
    .from("orders")
    .select("id, order_number, created_at, status, payment_status, seen_at, customer_name, customer_city, total_cop, shipping_cop")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab === "nuevos") q = q.eq("status", "pendiente").is("seen_at", null);
  else if (tab !== "todos") q = q.eq("status", tab);
  const { data: orders, error } = await q;

  return (
    <>
      <h1 className="text-4xl">Pedidos</h1>
      <nav aria-label="Estados" className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {TABS.map((t) => (
            <li key={t.id} className="shrink-0">
              <Link
                href={`/admin/pedidos?estado=${t.id}`}
                aria-current={t.id === tab ? "page" : undefined}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm ${t.id === tab ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-xs ${t.id === tab ? "bg-white/20" : "bg-muted"}`}>{counts[t.id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {error && <p role="alert" className="mt-6 text-destructive">No se pudieron cargar los pedidos: {error.message}</p>}
      {orders && orders.length === 0 && <p className="mt-10 rounded-3xl border bg-card p-8 text-center text-muted-foreground">No hay pedidos aquí.</p>}

      <ul className="mt-6 space-y-3">
        {(orders ?? []).map((o) => (
          <li key={o.id}>
            <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 hover:border-primary">
              <span className="font-display text-xl">N.º {o.order_number}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{o.customer_name}</span>
                <span className="block text-sm text-muted-foreground">{o.customer_city} · {fmt.format(new Date(o.created_at))}</span>
              </span>
              <span className="text-sm">
                {o.status === "pendiente" && !o.seen_at && <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Nuevo</span>}
                {STATUS_LABEL[o.status as OrderStatus]} · {PAYMENT_STATUS_LABEL[o.payment_status as keyof typeof PAYMENT_STATUS_LABEL]}
              </span>
              <span className="font-display text-lg">{formatCOP(o.total_cop)}{o.shipping_cop === null && <span className="ml-1 font-sans text-xs text-muted-foreground">+ envío</span>}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
