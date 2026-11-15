import "server-only";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";

/** Exige sesión de administradora. Úsalo al inicio de cada página y acción del panel. */
export async function requireAdmin() {
  const supabase = await createSessionClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/admin/login");
  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || isAdmin !== true) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=permiso");
  }
  return { supabase, user: auth.user };
}
