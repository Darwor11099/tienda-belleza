import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatIcon } from "@/components/layout/icons";
import { siteConfig } from "@/config/site";
import { formatCOP } from "@/lib/format";
import { customerOrderMessage, STATUS_LABEL, type OrderSummary } from "@/lib/orders";
import { getStoreSettings } from "@/lib/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { whatsappLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ nuevo?: string }> };

/** Confirmación y seguimiento del pedido. El enlace secreto no muestra datos personales. */
export default async function OrderPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { nuevo } = await searchParams;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();

  const db = createAdminClient();
  const [{ data }, s] = await Promise.all([db.rpc("get_order_by_token", { p_token: token }), getStoreSettings()]);
  if (!data) notFound();
  const order = data as OrderSummary;
  const settings = s.ok ? s.data : null;
  const storeName = settings?.store_name ?? siteConfig.fallbackName;
  const wa = settings?.whatsapp_number ? whatsappLink(settings.whatsapp_number, customerOrderMessage(order, storeName)) : null;
  const date = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(order.created_at));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {nuevo ? (
        <>
          <p className="text-sm font-medium text-primary">Pedido registrado</p>
          <h1 className="mt-2 text-5xl">¡Gracias! Tu pedido es el N.º {order.order_number}</h1>
          <p className="mt-4 text-muted-foreground">
            Ya lo recibimos. Envíanos el resumen por WhatsApp para confirmar disponibilidad, envío y forma de pago.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Seguimiento</p>
          <h1 className="mt-2 text-5xl">Pedido N.º {order.order_number}</h1>
        </>
      )}

      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 font-medium text-primary-foreground hover:opacity-90">
          <ChatIcon className="size-5" />
          Enviar resumen por WhatsApp
        </a>
      )}

      <section className="mt-10 rounded-3xl border bg-card p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted-foreground">Estado</dt><dd className="mt-1 font-medium" data-testid="order-status">{STATUS_LABEL[order.status]}</dd></div>
          <div><dt className="text-muted-foreground">Fecha</dt><dd className="mt-1">{date}</dd></div>
        </dl>
        <ul className="mt-6 divide-y border-t">
          {order.items.map((i, k) => (
            <li key={k} className="flex justify-between gap-4 py-3 text-sm">
              <span>
                {i.quantity} × {i.name}
                {i.variant && <span className="block text-xs text-muted-foreground">Tono: {i.variant}</span>}
                <span className="block text-xs text-muted-foreground">{formatCOP(i.unit_price_cop)} c/u</span>
              </span>
              <span className="shrink-0">{formatCOP(i.line_total_cop)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-2 border-t border-gold/40 pt-4 text-sm">
          <div className="flex justify-between"><dt>Productos</dt><dd>{formatCOP(order.subtotal_cop)}</dd></div>
          <div className="flex justify-between"><dt>Envío</dt><dd>{order.shipping_cop === null ? "Por confirmar" : formatCOP(order.shipping_cop)}</dd></div>
          <div className="flex items-baseline justify-between pt-2"><dt className="font-medium">Total</dt><dd className="font-display text-3xl" data-testid="order-total">{formatCOP(order.total_cop)}</dd></div>
        </dl>
      </section>
      <p className="mt-6 text-sm text-muted-foreground">Guarda este enlace: aquí podrás ver el estado de tu pedido.</p>
    </div>
  );
}
