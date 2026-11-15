"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** En el catálogo ya hay un buscador propio (que conserva filtros): no se repite arriba. */
export function HideOnCatalog({ children }: { children: ReactNode }) {
  const path = usePathname();
  if (path?.startsWith("/catalogo")) return null;
  return <>{children}</>;
}
