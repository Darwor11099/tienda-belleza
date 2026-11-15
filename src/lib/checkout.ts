import { checkoutSchema, fieldErrors, orderErrorMessage } from "@/lib/orders";

/**
 * Registro de un pedido, con las dependencias inyectadas para poder probarlo
 * sin base de datos. La ruta /api/pedidos conecta Supabase y el secreto real.
 */
export type CreateOrderRpc = (args: {
  p_customer: Record<string, string | null>;
  p_items: { product_id: string; variant_id: string | null; quantity: number }[];
  p_token: string;
  p_idempotency_key: string;
  p_ip_hash: string | null;
}) => Promise<{
  data: { out_order_id: string; out_order_number: number; out_subtotal_cop: number; out_existing: boolean }[] | null;
  error: { message: string } | null;
}>;

export type PlaceOrderResult =
  | { ok: true; status: 200; orderNumber: number; token: string; existing: boolean }
  | { ok: false; status: number; message: string; fields?: Record<string, string>; refreshCart?: boolean };

export async function placeOrder(
  body: unknown,
  deps: { rpc: CreateOrderRpc; token: (key: string) => string; ipHash: string | null },
): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    if (fields.website !== undefined) return { ok: false, status: 400, message: "Solicitud no válida." };
    return { ok: false, status: 400, message: "Revisa los datos marcados.", fields };
  }
  const { idempotencyKey, customer, items } = parsed.data;
  const token = deps.token(idempotencyKey);

  // Solo identificadores y cantidades: el precio lo pone la base de datos
  const { data, error } = await deps.rpc({
    p_customer: {
      name: customer.name,
      whatsapp: customer.whatsapp,
      email: customer.email,
      city: customer.city,
      address: customer.address,
      notes: customer.notes,
    },
    p_items: items.map((i) => ({ product_id: i.productId, variant_id: i.variantId, quantity: i.quantity })),
    p_token: token,
    p_idempotency_key: idempotencyKey,
    p_ip_hash: deps.ipHash,
  });

  if (error || !data?.[0]) {
    const e = orderErrorMessage(error?.message);
    return { ok: false, status: e.status, message: e.message, refreshCart: e.refreshCart };
  }
  return { ok: true, status: 200, orderNumber: data[0].out_order_number, token, existing: data[0].out_existing };
}
