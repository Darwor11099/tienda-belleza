import Link from "next/link";
import { AvailabilityLabel } from "@/components/store/availability";
import { Price } from "@/components/store/price";
import { ProductImage } from "@/components/store/product-image";
import { displayPrice, effectiveAvailability, mainImage, publicImageUrl, type ProductCard as Card } from "@/lib/catalog-view";

export function ProductCard({ product, photos, priority }: { product: Card; photos: boolean; priority?: boolean }) {
  const img = photos ? mainImage(product) : null;
  const price = displayPrice(product);
  const availability = effectiveAvailability(product);
  return (
    <article className="group relative flex w-full flex-col">
      <ProductImage
        url={publicImageUrl(img?.storage_path)}
        alt={img?.alt ?? product.name}
        categorySlug={product.category.slug}
        sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
        priority={priority}
        className="transition-shadow group-hover:shadow-[0_0_0_1px_var(--gold)]"
      />
      {product.is_new && (
        <span className="absolute top-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium text-primary">Nuevo</span>
      )}
      <h3 className="mt-3 line-clamp-2 font-sans text-[15px] leading-snug">
        <Link href={`/producto/${product.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          {product.name}
        </Link>
      </h3>
      {product.sku && <p className="mt-1 text-xs text-muted-foreground">Ref. {product.sku}</p>}
      <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pt-2">
        <Price amount={price.amount} from={price.from} className={`text-xl ${availability === "agotado" ? "text-muted-foreground" : ""}`} />
        <AvailabilityLabel value={availability} />
      </div>
    </article>
  );
}

export function ProductGrid({ products, photos, priorityCount = 0 }: { products: Card[]; photos: boolean; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id} className="flex">
          <ProductCard product={p} photos={photos} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
