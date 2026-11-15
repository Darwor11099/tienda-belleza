import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatIcon } from "@/components/layout/icons";
import { siteConfig } from "@/config/site";
import { requireAdmin } from "@/lib/admin";
import { formatCOP } from "@/lib/format";
import {
  adminContactMessage, ORDER_STATUSES, PAYMENT_METHOD_LABEL, PAYMENT_METHODS, PAYMENT_STATUS_LABEL, STATUS_LABEL, type OrderStatus,
} from "@/lib/orders";
import { getStoreSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";
import { addPayment, deletePayment, saveNotes, updateShipping, updateStatus } from "./actions";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> };
const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const field = "h-11 rounded-2xl border border-input bg-card px-3 text-base focus:border-primary focus:outline-none";
const btn = "h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90";

type Item = { id: string; product_name: string; product_sku: string | null; variant_name: string | null; quantity: number; unit_price_cop: number; line_total_cop: number };
type Payment = { id: string; amount_cop: number; method: (typeof PAYMENT_METHODS)[number]; reference: string | null; notes: string | null; paid_at: string };
type History = { id: number; from_status: OrderStatus | null; to_status: OrderStatus; created_at: string };

export default async function OrderDetail({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const { data: o } = await supabase
    .from("orders")
    .select(
      "id, order_number, created_at, status, payment_status, seen_at, customer_name, customer_whatsapp, customer_email, customer_city, customer_address, customer_notes, subtotal_cop, shipping_cop, total_cop, admin_notes, " +
        "items:order_items(id, product_name, product_sku, variant_name, quantity, unit_price_cop, line_total_cop), " +
        "payments(id, amount_cop, method, reference, notes, paid_at), " +
        "history:order_status_history(id, from_status, to_status, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();
  const order = o as unknown as {
    id: string; order_number: number; created_at: string; status: OrderStatus; payment_status: keyof typeof PAYMENT_STATUS_LABEL; seen_at: string | null;
    customer_name: string; customer_whatsapp: string; customer_email: string | null; customer_city: string; customer_address: string | null; customer_notes: string | null;
    subtotal_cop: number; shipping_cop: number | null; total_cop: number; admin_notes: string | null; items: Item[]; payments: Payment[]; history: History[];
  };

  // Al abrirlo deja de ser "nuevo"
  if (!order.seen_at) await supabase.from("orders").update({ seen_at: new Date().toISOString() }).eq("id", id);

  const s = await getStoreSettings();
  const storeName = s.ok ? s.data.store_name : siteConfig.fallbackName;
  const wa = whatsappLink(order.customer_whatsapp, adminContactMessage(order.customer_name, order.order_number, storeName));
  const paid = order.payments.reduce((n, p) => n + p.amount_cop, 0);
  const history = [...order.history].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="space-y-6">
      <Link href="/admin/pedidos" className="text-sm underline underline-offset-4">← Pedidos</Link>
      {aviso && <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{aviso}</p>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Pedido N.º {order.order_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{fmt.format(new Date(order.created_at))} · {STATUS_LABEL[order.status]} · {PAYMENT_STATUS_LABEL[order.payment_status]}</p>
        </div>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
            <ChatIcon className="size-5" /> Escribir por WhatsApp
          </a>
        )}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border bg-card p-5">
          <h2 className="font-display text-2xl">Cliente</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-muted-foreground">Nombre</dt><dd>{order.customer_name}</dd></div>
            <div><dt className="text-muted-foreground">WhatsApp</dt><dd>+{order.customer_whatsapp}</dd></div>
            {order.customer_email && <div><dt className="text-muted-foreground">Correo</dt><dd>{order.customer_email}</dd></div>}
            <div><dt className="text-muted-foreground">Ciudad</dt><dd>{order.customer_city}</dd></div>
            {order.customer_address && <div><dt className="text-muted-foreground">Dirección</dt><dd>{order.customer_address}</dd></div>}
            {order.customer_notes && <div><dt className="text-muted-foreground">Observaciones</dt><dd className="whitespace-pre-line">{order.customer_notes}</dd></div>}
          </dl>
        </div>

        <div className="space-y-5 rounded-3xl border bg-card p-5">
          <h2 className="font-display text-2xl">Gestión</h2>
          <form action={updateStatus.bind(null, order.id)} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-muted-foreground">Estado</span>
              <select name="status" defaultValue={order.status} className={`${field} mt-1`}>
                {ORDER_STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
              </select>
            </label>
            <button className={btn}>Guardar estado</button>
          </form>
          <form action={updateShipping.bind(null, order.id)} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-muted-foreground">Costo de envío (COP)</span>
              <input name="shipping" inputMode="numeric" defaultValue={order.shipping_cop ?? ""} placeholder="Por definir" className={`${field} mt-1 w-40`} />
            </label>
            <button className={btn}>Guardar envío</button>
          </form>
          <form action={saveNotes.bind(null, order.id)} className="space-y-2">
            <label htmlFor="notes" className="block text-sm text-muted-foreground">Notas internas</label>
            <textarea id="notes" name="notes" rows={3} defaultValue={order.admin_notes ?? ""} className={`${field} h-auto w-full py-2`} />
            <button className={btn}>Guardar notas</button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Productos</h2>
        <ul className="mt-3 divide-y text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <span>
                <span className="font-medium">{i.quantity} ×</span> {i.product_name}
                {i.variant_name && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Tono: {i.variant_name}</span>}
                <span className="block text-xs text-muted-foreground">{i.product_sku ? `Ref. ${i.product_sku} · ` : ""}{formatCOP(i.unit_price_cop)} c/u</span>
              </span>
              <span className="shrink-0">{formatCOP(i.line_total_cop)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between"><dt>Productos</dt><dd>{formatCOP(order.subtotal_cop)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{order.shipping_cop === null ? "Por definir" : formatCOP(order.shipping_cop)}</dd></div>
          <div className="flex justify-between text-base font-medium"><dt>Total</dt><dd>{formatCOP(order.total_cop)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Pagado</dt><dd>{formatCOP(paid)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Saldo</dt><dd>{formatCOP(Math.max(0, order.total_cop - paid))}</dd></div>
        </dl>
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Pagos</h2>
        {order.payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin pagos registrados.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {formatCOP(p.amount_cop)} · {PAYMENT_METHOD_LABEL[p.method]}{p.reference ? ` · Ref. ${p.reference}` : ""}
                  <span className="block text-xs text-muted-foreground">{fmt.format(new Date(p.paid_at))}{p.notes ? ` · ${p.notes}` : ""}</span>
                </span>
                <form action={deletePayment.bind(null, order.id, p.id)}>
                  <button className="text-xs text-muted-foreground underline">Eliminar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addPayment.bind(null, order.id)} className="mt-4 grid gap-3 sm:grid-cols-[140px_160px_1fr_auto] sm:items-end">
          <label className="text-sm"><span className="block text-muted-foreground">Valor (COP)</span><input name="amount" inputMode="numeric" required className={`${field} mt-1 w-full`} /></label>
          <label className="text-sm">
            <span className="block text-muted-foreground">Medio</span>
            <select name="method" className={`${field} mt-1 w-full`}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="block text-muted-foreground">Referencia (opcional)</span><input name="reference" maxLength={120} className={`${field} mt-1 w-full`} /></label>
          <button className={btn}>Registrar pago</button>
        </form>
      </section>

      {history.length > 0 && (
        <section className="rounded-3xl border bg-card p-5">
          <h2 className="font-display text-2xl">Historial</h2>
          <ol className="mt-3 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>{fmt.format(new Date(h.created_at))}: {h.from_status ? `${STATUS_LABEL[h.from_status]} → ` : ""}{STATUS_LABEL[h.to_status]}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
