import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { categoryTints } from "@/config/site";
import { publicImageUrl } from "@/lib/catalog-view";
import type { Category } from "@/lib/store";

type Props = { title: string; subtitle: string; imagePath: string | null; categories: Category[] };

/**
 * Portada: texto editable desde la configuración y, a la derecha, la foto de
 * portada si existe; si no, una paleta de sombras cuyos godets son las categorías.
 */
export function Hero({ title, subtitle, imagePath, categories }: Props) {
  const img = publicImageUrl(imagePath);
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-24">
        <div>
          <h1 className="text-[clamp(2.6rem,7.5vw,5.2rem)] leading-[0.96] tracking-tight">{title}</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/catalogo" className="inline-flex h-12 items-center rounded-full bg-primary px-8 font-medium text-primary-foreground transition-opacity hover:opacity-90">
              Ver catálogo
            </Link>
            <Link href="#categorias" className="inline-flex h-12 items-center rounded-full border border-foreground/20 px-7 hover:border-foreground/50">
              Explorar categorías
            </Link>
          </div>
        </div>

        {img ? (
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem]">
            <Image src={img} alt="" fill priority sizes="(min-width: 768px) 45vw, 100vw" className="object-cover" />
          </div>
        ) : (
          <div aria-hidden className="relative mx-auto w-full max-w-[440px]">
            <div className="rounded-[2.2rem] bg-[#2f2325] p-4 shadow-[0_30px_60px_-30px_rgb(59_42_44/0.6)] sm:p-5">
              <div className="rounded-[1.6rem] border border-gold/50 bg-[#3b2a2c] p-5 sm:p-6">
                <div className="grid grid-cols-4 gap-3 sm:gap-4">
                  {categories.slice(0, 8).map((c) => (
                    <span
                      key={c.id}
                      className="swatch block aspect-square rounded-full"
                      style={{ "--tint": categoryTints[c.slug] ?? "var(--blush)", boxShadow: "0 0 0 1px var(--gold), 0 0 0 4px #2f2325" } as CSSProperties}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
