import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
          <Link href="/admin/pedidos" className="font-display text-xl">Panel</Link>
          <form action={signOut} className="ml-auto flex items-center gap-3 text-sm sm:order-last">
            <span className="hidden text-muted-foreground md:inline">{user.email}</span>
            <button className="rounded-full border px-3 py-1.5 hover:bg-accent">Salir</button>
          </form>
          <nav className="-mx-1 flex w-full gap-1 overflow-x-auto pt-1 text-sm sm:w-auto sm:pt-0">
            <Link href="/admin/pedidos" className="shrink-0 rounded-full px-3 py-2 hover:bg-accent">Pedidos</Link>
            <Link href="/admin/productos" className="shrink-0 rounded-full px-3 py-2 hover:bg-accent">Productos</Link>
            <Link href="/admin/configuracion" className="shrink-0 rounded-full px-3 py-2 hover:bg-accent">Configuración</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
