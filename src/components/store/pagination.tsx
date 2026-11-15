import Link from "next/link";
import { catalogHref, pageList, type CatalogParams } from "@/lib/catalog-params";

export function Pagination({ params, pageCount }: { params: CatalogParams; pageCount: number }) {
  if (pageCount <= 1) return null;
  const page = Math.min(params.page, pageCount);
  const item = "inline-flex size-10 items-center justify-center rounded-full text-sm";
  return (
    <nav aria-label="Páginas" className="mt-14 flex items-center justify-center gap-1">
      {page > 1 && (
        <Link href={catalogHref(params, { page: page - 1 })} className={`${item} w-auto px-4 hover:bg-accent`} rel="prev">Anterior</Link>
      )}
      <ul className="flex items-center gap-1">
        {pageList(page, pageCount).map((n, i) =>
          n === "…" ? (
            <li key={`e${i}`} className={`${item} text-muted-foreground`} aria-hidden>…</li>
          ) : (
            <li key={n} className={n === page ? "" : "hidden sm:block"}>
              <Link
                href={catalogHref(params, { page: n })}
                aria-current={n === page ? "page" : undefined}
                className={`${item} ${n === page ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < pageCount && (
        <Link href={catalogHref(params, { page: page + 1 })} className={`${item} w-auto px-4 hover:bg-accent`} rel="next">Siguiente</Link>
      )}
    </nav>
  );
}
