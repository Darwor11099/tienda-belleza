import Image from "next/image";
import type { CSSProperties } from "react";
import { categoryTints } from "@/config/site";

type Props = {
  url: string | null;
  alt: string;
  categorySlug: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

/**
 * Foto del producto o, si aún no hay foto autorizada, una tarjeta neutra
 * con el tono de su categoría (no se usan fotos sin permiso).
 */
export function ProductImage({ url, alt, categorySlug, sizes, priority, className = "" }: Props) {
  return (
    <div className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-card ${className}`}>
      {url ? (
        <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className="object-contain p-3" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/70">
          <span
            aria-hidden
            className="swatch block size-16 rounded-full"
            style={{ "--tint": categoryTints[categorySlug] ?? "var(--blush)" } as CSSProperties}
          />
          <span className="text-xs text-muted-foreground">Imagen próximamente</span>
        </div>
      )}
    </div>
  );
}
