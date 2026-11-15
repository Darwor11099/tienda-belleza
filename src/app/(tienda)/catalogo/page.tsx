import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/layout/search-form";
import { Pagination } from "@/components/store/pagination";
import { ProductGrid } from "@/components/store/product-card";
import { SortSelect } from "@/components/store/sort-select";
import { getCatalog } from "@/lib/catalog";
import { catalogHref, parseCatalogParams } from "@/lib/catalog-params";
import { getCategories, getStoreSettings } from "@/lib/store";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = parseCatalogParams(await searchParams);
  const cats = await getCategories();
  const cat = cats.ok ? cats.data.find((c) => c.slug === params.category) : undefined;
  return {
    title: cat ? cat.name : params.q ? `Búsqueda: ${params.q}` : "Catálogo",
    description: cat?.description ?? undefined,
    robots: params.q || params.page > 1 ? { index: false } : undefined,
  };
}

export default async function CatalogPage({ searchParams }: Props) {
  const params = parseCatalogParams(await searchParams);
  const [result, cats, s] = await Promise.all([getCatalog(params), getCategories(), getStoreSettings()]);
  const categories = cats.ok ? cats.data : [];
  const active = categories.find((c) => c.slug === params.category) ?? null;
  const photos = s.ok ? s.data.product_photos_enabled : false;
  const hidden: Record<string, string> = {};
  if (params.category) hidden.categoria = params.category;
  if (params.sort !== "destacados") hidden.orden = params.sort;

  const chip = (on: boolean) =>
    `inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors ${
      on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary hover:text-primary"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Ruta" className="text-sm text-muted-foreground">
        <Link href="/" className="inline-block py-2 hover:text-foreground">Inicio</Link> <span aria-hidden>/</span>{" "}
        {active ? <Link href="/catalogo" className="inline-block py-2 hover:text-foreground">Catálogo</Link> : <span>Catálogo</span>}
      </nav>
      <h1 className="mt-3 text-5xl">{active?.name ?? "Catálogo"}</h1>
      {active?.description && <p className="mt-3 max-w-xl text-muted-foreground">{active.description}</p>}

      <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,420px)_1fr] md:items-center">
        <SearchForm id="buscar-catalogo" defaultValue={params.q} hidden={hidden} />
        <div className="md:justify-self-end"><SortSelect params={params} /></div>
      </div>

      <nav aria-label="Filtrar por categoría" className="-mx-4 mt-6 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          <li className="shrink-0">
            <Link href={catalogHref(params, { category: null })} className={chip(!params.category)} aria-current={!params.category ? "true" : undefined}>
              Todas
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={catalogHref(params, { category: c.slug })} className={chip(c.slug === params.category)} aria-current={c.slug === params.category ? "true" : undefined}>
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!result.ok ? (
        <p role="alert" className="mt-10 rounded-2xl border bg-card p-6">
          No se pudo cargar el catálogo. Intenta de nuevo en unos minutos.
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
            {result.total === 0
              ? "Sin resultados"
              : `${result.total} ${result.total === 1 ? "producto" : "productos"}${params.q ? ` para «${params.q}»` : ""}`}
          </p>
          {result.items.length > 0 ? (
            <div className="mt-6"><ProductGrid products={result.items} photos={photos} priorityCount={4} /></div>
          ) : (
            <div className="mt-6 rounded-3xl border bg-card px-6 py-14 text-center">
              <p className="font-display text-2xl">
                {result.total > 0
                  ? "Esta página no existe"
                  : params.q
                    ? `No encontramos productos para «${params.q}»`
                    : "Aún no hay productos publicados aquí"}
              </p>
              <p className="mt-2 text-muted-foreground">
                {result.total > 0 ? "Vuelve a la primera página de resultados." : "Prueba con otra palabra, una referencia o una categoría diferente."}
              </p>
              {result.total > 0 && (
                <Link href={catalogHref(params, { page: 1 })} className="mt-6 inline-flex h-11 items-center rounded-full border px-6 hover:border-primary">
                  Ir a la página 1
                </Link>
              )}
              {result.total === 0 && (params.q || params.category) && (
                <Link href="/catalogo" className="mt-6 inline-flex h-11 items-center rounded-full border px-6 hover:border-primary">
                  Ver todo el catálogo
                </Link>
              )}
            </div>
          )}
          <Pagination params={params} pageCount={result.pageCount} />
        </>
      )}
    </div>
  );
}
