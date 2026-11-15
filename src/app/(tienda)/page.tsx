import Link from "next/link";
import { CategoryTile } from "@/components/store/category-tile";
import { Hero } from "@/components/store/hero";
import { ProductGrid } from "@/components/store/product-card";
import { siteConfig } from "@/config/site";
import { getProductsWhere } from "@/lib/catalog";
import { getCategories, getStoreSettings } from "@/lib/store";

export const revalidate = 60;

export default async function HomePage() {
  const [s, c, featured, fresh] = await Promise.all([
    getStoreSettings(),
    getCategories(),
    getProductsWhere("featured", { limit: 8 }),
    getProductsWhere("new", { limit: 8 }),
  ]);
  const settings = s.ok ? s.data : null;
  const categories = c.ok ? c.data : [];
  const photos = settings?.product_photos_enabled ?? false;
  // Si aún no hay destacados marcados, se muestran los últimos publicados
  const showcase = featured.length > 0 ? featured : await getProductsWhere("latest", { limit: 8 });

  return (
    <>
      <Hero
        title={settings?.hero_title ?? "Tu rutina de belleza, en un solo pedido"}
        subtitle={
          settings?.hero_subtitle ??
          settings?.tagline ??
          "Maquillaje, cuidado facial y capilar, cuerpo, perfumería y accesorios. Elige tus productos y te confirmamos el pedido por WhatsApp."
        }
        imagePath={settings?.hero_image_path ?? null}
        categories={categories}
      />

      {categories.length > 0 && (
        <section id="categorias" aria-labelledby="t-categorias" className="scroll-mt-24 border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="t-categorias" className="text-4xl">Categorías</h2>
            <div className="mt-10 grid grid-cols-4 gap-x-2 gap-y-8 sm:gap-x-4 sm:gap-y-12">
              {categories.map((cat) => <CategoryTile key={cat.id} category={cat} />)}
            </div>
          </div>
        </section>
      )}

      {showcase.length > 0 && (
        <section aria-labelledby="t-destacados" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <h2 id="t-destacados" className="text-4xl">{featured.length > 0 ? "Destacados" : "Recién publicados"}</h2>
            <Link href="/catalogo" className="shrink-0 text-sm underline underline-offset-4">Ver todo</Link>
          </div>
          <div className="mt-10"><ProductGrid products={showcase} photos={photos} priorityCount={2} /></div>
        </section>
      )}

      {fresh.length > 0 && (
        <section aria-labelledby="t-novedades" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
          <h2 id="t-novedades" className="text-4xl">Novedades</h2>
          <div className="mt-10"><ProductGrid products={fresh} photos={photos} /></div>
        </section>
      )}

      {showcase.length === 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
          <p className="rounded-3xl border bg-card px-6 py-10 text-center text-muted-foreground">
            Estamos preparando el catálogo de {settings?.store_name ?? siteConfig.fallbackName}. Muy pronto verás aquí los productos.
          </p>
        </section>
      )}

      <section aria-labelledby="t-como" className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <h2 id="t-como" className="text-4xl">Cómo pedir</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {[
            "Añade al carrito los productos y las cantidades que quieres.",
            "Envía tu pedido con tu nombre, ciudad y WhatsApp. Queda registrado con un número.",
            "Te confirmamos disponibilidad, envío y forma de pago por WhatsApp.",
          ].map((text, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold font-display text-lg">{i + 1}</span>
              <p className="pt-1.5 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
