"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImage } from "@/components/store/product-image";

type Img = { url: string; alt: string };

export function ProductGallery({ images, name, categorySlug }: { images: Img[]; name: string; categorySlug: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;
  return (
    <div className="md:sticky md:top-24">
      <ProductImage
        url={current?.url ?? null}
        alt={current?.alt ?? name}
        categorySlug={categorySlug}
        sizes="(min-width: 768px) 50vw, 100vw"
        priority
      />
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Más fotos">
          {images.map((img, i) => (
            <li key={img.url} className="shrink-0">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === active}
                className={`relative block size-16 overflow-hidden rounded-xl border bg-card ${i === active ? "border-primary" : "border-border"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
