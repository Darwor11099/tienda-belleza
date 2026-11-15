"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { paymentSchema, shippingSchema, statusSchema } from "@/lib/orders";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function back(id: string, aviso: string): never {
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${id}?aviso=${encodeURIComponent(aviso)}`);
}

export async function updateStatus(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  const { supabase } = await requireAdmin();
  const status = statusSchema.safeParse(formData.get("status"));
  if (!status.success) back(id, "Estado no válido.");
  const { error } = await supabase.from("orders").update({ status: status.data }).eq("id", id);
  back(id, error ? `No se pudo cambiar el estado: ${error.message}` : "Estado actualizado.");
}

export async function updateShipping(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  const { supabase } = await requireAdmin();
  const shipping = shippingSchema.safeParse(String(formData.get("shipping") ?? ""));
  if (!shipping.success) back(id, "Escribe el envío en pesos, sin decimales.");
  const { error } = await supabase.from("orders").update({ shipping_cop: shipping.data }).eq("id", id);
  back(id, error ? `No se pudo guardar el envío: ${error.message}` : "Envío guardado.");
}

export async function saveNotes(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  const { supabase } = await requireAdmin();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000) || null;
  const { error } = await supabase.from("orders").update({ admin_notes: notes }).eq("id", id);
  back(id, error ? `No se pudieron guardar las notas: ${error.message}` : "Notas guardadas.");
}

export async function addPayment(id: string, formData: FormData) {
  if (!UUID.test(id)) return;
  const { supabase } = await requireAdmin();
  const p = paymentSchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    method: formData.get("method"),
    reference: String(formData.get("reference") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!p.success) back(id, p.error.issues[0]?.message ?? "Revisa los datos del pago.");
  const { error } = await supabase.from("payments").insert({
    order_id: id, amount_cop: p.data.amount, method: p.data.method, reference: p.data.reference, notes: p.data.notes,
  });
  back(id, error ? `No se pudo registrar el pago: ${error.message}` : "Pago registrado.");
}

export async function deletePayment(id: string, paymentId: string) {
  if (!UUID.test(id) || !UUID.test(paymentId)) return;
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId).eq("order_id", id);
  back(id, error ? `No se pudo borrar el pago: ${error.message}` : "Pago eliminado.");
}
