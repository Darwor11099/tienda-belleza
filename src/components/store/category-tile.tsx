import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { categoryTints } from "@/config/site";
import { publicImageUrl } from "@/lib/catalog-view";
import type { Category } from "@/lib/store";

/** Imagen de la categoría si la encargada la sube; si no, el godet de su tono. */
export function CategoryTile({ category }: { category: Category }) {
  const img = publicImageUrl(category.image_path);
  return (
    <Link href={`/catalogo?categoria=${category.slug}`} className="group flex flex-col items-center text-center">
      {img ? (
        <span className="relative block size-16 overflow-hidden rounded-full ring-1 ring-gold ring-offset-4 ring-offset-background sm:size-28">
          <Image src={img} alt="" fill sizes="112px" className="object-cover transition-transform group-hover:scale-105" />
        </span>
      ) : (
        <span
          aria-hidden
          className="swatch block size-16 rounded-full transition-transform group-hover:scale-[1.04] sm:size-28"
          style={{ "--tint": categoryTints[category.slug] ?? "var(--blush)" } as CSSProperties}
        />
      )}
      <span className="mt-3 font-display text-sm leading-tight group-hover:text-primary sm:mt-4 sm:text-lg">{category.name}</span>
      {category.description && <span className="mt-1 hidden max-w-[24ch] text-sm text-muted-foreground sm:block">{category.description}</span>}
    </Link>
  );
}
