"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente del navegador con la sesión de la administradora (cookies).
 * Solo se usa en el panel para subir fotos directamente al almacenamiento;
 * los permisos los decide Supabase (solo administradoras pueden subir).
 */
export function createPanelBrowserClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
