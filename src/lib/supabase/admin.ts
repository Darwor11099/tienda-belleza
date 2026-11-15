import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";

/**
 * Cliente con la clave secreta. SOLO en el servidor (server actions, rutas).
 * Ignora RLS: úsalo únicamente para crear pedidos (función create_order)
 * y consultar el estado por token. "server-only" hace fallar la compilación
 * si alguien lo importa en un componente del navegador.
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Falta SUPABASE_SECRET_KEY en .env.local");
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
