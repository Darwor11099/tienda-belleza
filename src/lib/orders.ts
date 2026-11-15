import { z } from "zod";
import { formatCOP } from "@/lib/format";
import { MAX_LINES } from "@/lib/cart/cart";
import { normalizeWhatsApp } from "@/lib/whatsapp";

/** Reglas y textos de pedidos compartidos por la tienda y el panel (sin acceso a datos). */

export const ORDER_STATUSES = ["pendiente", "confirmado", "preparando", "enviado", "entregado", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
export const PAYMENT_STATUS_LABEL = { sin_pago: "Sin pago", parcial: "Pago parcial", pagado: "Pagado" } as const;

export const PAYMENT_METHODS = ["nequi", "daviplata", "bancolombia", "efecty", "efectivo", "contra_entrega", "otro"] as const;
export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  nequi: "Nequi",
  daviplata: "Daviplata",
  bancolombia: "Bancolombia",
  efecty: "Efecty",
  efectivo: "Efectivo",
  contra_entrega: "Contra entrega",
  otro: "Otro",
};

// ---------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------
const text = (min: number, max: number, msg: string) =>
  z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(min, msg).max(max, msg));
const optionalText = (max: number, msg: string) =>
  z
    .string()
    .optional()
    .transform((s) => (s ?? "").replace(/[ \t]+/g, " ").trim())
    .pipe(z.string().max(max, msg))
    .transform((s) => (s === "" ? null : s));

export const checkoutSchema = z.object({
  idempotencyKey: z.uuid(),
  // Campo trampa: las personas no lo ven; si viene con texto, es un robot
  website: z.string().max(0).optional().or(z.literal("")),
  customer: z.object({
    name: text(3, 120, "Escribe tu nombre completo."),
    whatsapp: z
      .string()
      .transform((s) => normalizeWhatsApp(s) ?? "")
      .pipe(z.string().min(1, "Escribe tu celular de 10 dígitos (empieza por 3), por ejemplo 300 123 4567, o el número completo con indicativo si es de otro país.")),
    email: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim())
      .pipe(z.union([z.literal(""), z.email("El correo no es válido.").max(160, "El correo no es válido.")]))
      .transform((s) => (s === "" ? null : s)),
    city: text(2, 80, "Escribe tu ciudad."),
    address: optionalText(300, "La dirección es demasiado larga."),
    notes: optionalText(1000, "Las observaciones son demasiado largas."),
    dataConsent: z.literal(true, { error: "Debes autorizar el uso de tus datos para gestionar el pedido." }),
  }),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        variantId: z.uuid().nullable(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Tu carrito está vacío.")
    .max(MAX_LINES),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Errores por campo, en el formato que muestra el formulario. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.at(-1) === undefined ? "form" : String(issue.path.at(-1));
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Mensaje para la clienta según el error que devuelve la base (create_order). */
export function orderErrorMessage(dbMessage: string | undefined): { message: string; status: number; refreshCart: boolean } {
  const code = (dbMessage ?? "").match(/[A-Z_]{6,}/)?.[0] ?? "";
  switch (code) {
    case "PRODUCTO_NO_DISPONIBLE":
      return { message: "Algún producto de tu carrito cambió o ya no está disponible. Revisa el carrito y vuelve a intentarlo.", status: 409, refreshCart: true };
    case "DEMASIADOS_PEDIDOS":
      return { message: "Recibimos varios pedidos seguidos desde este número o conexión. Espera un momento o escríbenos por WhatsApp.", status: 429, refreshCart: false };
    case "TIENDA_NO_CONFIGURADA":
      return { message: "La tienda todavía no está recibiendo pedidos.", status: 503, refreshCart: false };
    case "NOMBRE_INVALIDO":
    case "WHATSAPP_INVALIDO":
    case "CIUDAD_INVALIDA":
    case "EMAIL_INVALIDO":
    case "DIRECCION_INVALIDA":
    case "NOTAS_INVALIDAS":
    case "CANTIDAD_INVALIDA":
    case "CARRITO_INVALIDO":
      return { message: "Revisa los datos del formulario y del carrito.", status: 400, refreshCart: false };
    default:
      return { message: "No pudimos registrar tu pedido. Intenta de nuevo en unos minutos.", status: 500, refreshCart: false };
  }
}

// ---------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------
export type OrderSummary = {
  order_number: number;
  status: OrderStatus;
  created_at: string;
  subtotal_cop: number;
  shipping_cop: number | null;
  total_cop: number;
  items: { name: string; variant: string | null; sku: string | null; quantity: number; unit_price_cop: number; line_total_cop: number }[];
};

/** Resumen que la clienta envía a la tienda (el envío lo confirma la tienda). */
export function customerOrderMessage(order: OrderSummary, storeName: string): string {
  const lines = order.items.map(
    (i) => `• ${i.quantity} × ${i.name}${i.variant ? ` (tono: ${i.variant})` : ""} — ${formatCOP(i.line_total_cop)}`,
  );
  return [
    `Hola ${storeName}, acabo de hacer el pedido N.º ${order.order_number}:`,
    ...lines,
    `Total productos: ${formatCOP(order.subtotal_cop)}`,
    order.shipping_cop === null ? "Quedo pendiente de la confirmación del envío y la forma de pago." : `Envío: ${formatCOP(order.shipping_cop)}`,
  ].join("\n");
}

/** Mensaje inicial de la encargada a la clienta. */
export function adminContactMessage(customerName: string, orderNumber: number, storeName: string): string {
  const first = customerName.split(" ")[0] ?? customerName;
  return `Hola ${first}, te escribimos de ${storeName} sobre tu pedido N.º ${orderNumber}.`;
}

// ---------------------------------------------------------------------
// Panel: validaciones de formularios
// ---------------------------------------------------------------------
export const statusSchema = z.enum(ORDER_STATUSES);
export const paymentSchema = z.object({
  amount: z
    .string()
    .transform((s) => s.replace(/[$\s.]/g, ""))
    .pipe(z.string().regex(/^\d{1,9}$/, "Escribe el valor en pesos, sin decimales."))
    .transform(Number)
    .pipe(z.number().int().positive("El valor debe ser mayor que cero.")),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().max(120).optional().transform((s) => (s?.trim() ? s.trim() : null)),
  notes: z.string().max(500).optional().transform((s) => (s?.trim() ? s.trim() : null)),
});
export const shippingSchema = z
  .string()
  .transform((s) => s.replace(/[$\s.]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,8}$/, "Escribe el valor en pesos, sin decimales.")]))
  .transform((s) => (s === "" ? null : Number(s)));
