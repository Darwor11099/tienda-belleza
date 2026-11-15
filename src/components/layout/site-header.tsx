import Link from "next/link";
import { CartLink } from "@/components/layout/cart-link";
import { HideOnCatalog } from "@/components/layout/mobile-search";
import { SearchForm } from "@/components/layout/search-form";
import { publicImageUrl } from "@/lib/catalog-view";
import type { Category } from "@/lib/store";

type Props = { storeName: string; logoPath: string | null; categories: Category[] };

export function SiteHeader({ storeName, logoPath, categories }: Props) {
  const logo = publicImageUrl(logoPath);
  return (
    <>
      <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="shrink-0 font-display text-[1.6rem] leading-none tracking-tight sm:text-[1.8rem]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={storeName} className="h-9 w-auto" />
            ) : (
              storeName
            )}
          </Link>
          <SearchForm id="buscar-escritorio" className="mx-auto hidden w-full max-w-md md:block" />
          <nav aria-label="Tienda" className="ml-auto flex items-center gap-1 md:ml-0">
            <Link href="/catalogo" className="hidden rounded-full px-4 py-2 text-sm hover:bg-accent sm:inline-block">
              Catálogo
            </Link>
            <CartLink />
          </nav>
        </div>
      </div>
      <div className="border-b bg-background">
        <HideOnCatalog>
          <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6 md:hidden">
            <SearchForm id="buscar-movil" />
          </div>
        </HideOnCatalog>
        <nav aria-label="Categorías" className="mx-auto max-w-6xl">
          <ul className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/catalogo?categoria=${c.slug}`}
                  className="inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors hover:border-primary hover:text-primary"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
