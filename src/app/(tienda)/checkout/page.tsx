import type { Metadata } from "next";
import { CheckoutForm } from "@/components/store/checkout-form";

export const metadata: Metadata = { title: "Confirmar pedido", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-5xl">Confirmar pedido</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">No necesitas crear una cuenta. Al confirmar, tu pedido queda registrado con un número y luego puedes enviarnos el resumen por WhatsApp.</p>
      <div className="mt-8"><CheckoutForm /></div>
    </div>
  );
}
