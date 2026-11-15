import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-4xl">Este producto no está disponible</h1>
      <p className="mt-4 text-muted-foreground">Puede que se haya retirado o que el enlace no sea correcto.</p>
      <Link href="/catalogo" className="mt-8 inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground">
        Ver catálogo
      </Link>
    </div>
  );
}
