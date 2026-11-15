import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * Cliente sin sesión para leer datos públicos (productos activos, categorías,
 * configuración). Las reglas RLS de la base deciden qué puede ver.
 * Devuelve null si el proyecto aún no tiene variables de entorno.
 */
export function createPublicClient() {
  const env = getPublicEnv();
  if (!env) return null;
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
