import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-4xl">Página no encontrada</h1>
      <p className="mt-4 text-muted-foreground">El enlace no existe o cambió.</p>
      <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground">Ir al inicio</Link>
    </main>
  );
}
