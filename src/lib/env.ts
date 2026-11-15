/**
 * Variables de entorno. Las que empiezan por NEXT_PUBLIC_ llegan al navegador;
 * SUPABASE_SECRET_KEY nunca debe tener ese prefijo.
 */
export type PublicEnv = { supabaseUrl: string; supabaseKey: string };

/** Devuelve null si faltan variables, para mostrar una pantalla de configuración en vez de fallar. */
export function getPublicEnv(): PublicEnv | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return { supabaseUrl, supabaseKey };
}

export function requirePublicEnv(): PublicEnv {
  const env = getPublicEnv();
  if (!env) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
    );
  }
  return env;
}
