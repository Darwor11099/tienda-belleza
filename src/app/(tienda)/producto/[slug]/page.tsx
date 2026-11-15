import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-card";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { getProductBySlug, getProductsWhere } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/catalog-view";
import { getStoreSettings } from "@/lib/store";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  if (!p) return { title: "Producto no encontrado" };
  const description = p.description?.split("\n")[0]?.slice(0, 160) ?? `${p.name}${p.sku ? `, referencia ${p.sku}` : ""}.`;
  return { title: p.name, description, alternates: { canonical: `/producto/${p.slug}` } };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, s] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) notFound();

  const settings = s.ok ? s.data : null;
  const photos = settings?.product_photos_enabled ?? false;
  const images = photos
    ? product.images.map((i) => ({ url: publicImageUrl(i.storage_path)!, alt: i.alt ?? product.name })).filter((i) => i.url)
    : [];
  const related = await getProductsWhere("related", { limit: 4, categoryId: product.category_id, excludeId: product.id });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
      <nav aria-label="Ruta" className="text-sm text-muted-foreground">
        <Link href="/" className="inline-block py-2 hover:text-foreground">Inicio</Link> <span aria-hidden>/</span>{" "}
        <Link href={`/catalogo?categoria=${product.category.slug}`} className="inline-block py-2 hover:text-foreground">{product.category.name}</Link>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-14">
        <ProductGallery images={images} name={product.name} categorySlug={product.category.slug} />

        <div>
          <h1 className="text-[clamp(2rem,5vw,3.2rem)] leading-[1.05]">{product.name}</h1>
          {product.sku && <p className="mt-3 text-sm text-muted-foreground">Ref. {product.sku}</p>}
          <div className="mt-8">
            <ProductPurchase
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                sku: product.sku,
                price_cop: product.price_cop,
                availability: product.availability,
                has_variants: product.has_variants,
                imageUrl: images[0]?.url ?? null,
              }}
              variants={product.variants.map((v) => ({ id: v.id, name: v.name, price_cop: v.price_cop, availability: v.availability, imageUrl: photos ? publicImageUrl(v.image_path) : null }))}
              whatsappNumber={settings?.whatsapp_number ?? null}
            />
          </div>
          {product.description && (
            <section aria-labelledby="t-desc" className="mt-12 border-t border-gold/40 pt-8">
              <h2 id="t-desc" className="text-2xl">Descripción</h2>
              <p className="mt-4 max-w-prose leading-relaxed whitespace-pre-line">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="t-rel" className="mt-24">
          <h2 id="t-rel" className="text-3xl">También en {product.category.name}</h2>
          <div className="mt-8"><ProductGrid products={related} photos={photos} /></div>
        </section>
      )}
    </div>
  );
}
