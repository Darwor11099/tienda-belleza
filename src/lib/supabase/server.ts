import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicEnv } from "@/lib/env";

/**
 * Cliente con la sesión de la administradora (cookies).
 * Se empieza a usar en la fase del panel administrativo.
 */
export async function createSessionClient() {
  const { supabaseUrl, supabaseKey } = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: las cookies se renuevan en el proxy/middleware.
        }
      },
    },
  });
}
