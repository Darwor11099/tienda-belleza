import type { Metadata } from "next";
import { LoginForm } from "@/app/admin/login/login-form";

export const metadata: Metadata = { title: "Panel · Entrar", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-16">
      <h1 className="text-4xl">Panel de la tienda</h1>
      <p className="mt-2 text-sm text-muted-foreground">Acceso solo para la administración.</p>
      <LoginForm initialError={error === "permiso" ? "Esta cuenta no tiene permiso para el panel." : null} />
    </main>
  );
}
