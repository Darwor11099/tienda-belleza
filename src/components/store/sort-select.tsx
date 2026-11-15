"use client";

import { useRouter } from "next/navigation";
import { catalogHref, SORT_LABELS, SORTS, type CatalogParams, type Sort } from "@/lib/catalog-params";

export function SortSelect({ params }: { params: CatalogParams }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Ordenar</span>
      <select
        value={params.sort}
        onChange={(e) => router.push(catalogHref(params, { sort: e.target.value as Sort }))}
        className="h-10 rounded-full border border-input bg-card px-4 pr-8 text-sm focus:border-primary focus:outline-none"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>{SORT_LABELS[s]}</option>
        ))}
      </select>
    </label>
  );
}
