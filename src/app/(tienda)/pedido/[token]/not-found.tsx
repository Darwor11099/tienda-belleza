import Link from "next/link";

export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-4xl">No encontramos ese pedido</h1>
      <p className="mt-4 text-muted-foreground">Revisa que el enlace esté completo. Si necesitas ayuda, escríbenos por WhatsApp.</p>
      <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground">Ir al inicio</Link>
    </div>
  );
}
