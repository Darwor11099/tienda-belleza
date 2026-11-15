import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { siteConfig } from "@/config/site";
import { getCategories, getStoreSettings } from "@/lib/store";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [s, c] = await Promise.all([getStoreSettings(), getCategories()]);
  if (!s.ok && s.reason === "sin-configurar") {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <h1 className="text-4xl">Falta conectar Supabase</h1>
        <p className="mt-4 text-muted-foreground">
          Copia <code>.env.example</code> como <code>.env.local</code>, completa las claves de tu proyecto y reinicia{" "}
          <code>npm run dev</code>.
        </p>
      </main>
    );
  }
  const settings = s.ok ? s.data : null;
  const categories = c.ok ? c.data : [];
  const storeName = settings?.store_name ?? siteConfig.fallbackName;
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2">
        Ir al contenido
      </a>
      <SiteHeader storeName={storeName} logoPath={settings?.logo_path ?? null} categories={categories} />
      <main id="contenido">{children}</main>
      <SiteFooter settings={settings} storeName={storeName} categories={categories} />
      <WhatsAppFloat whatsappNumber={settings?.whatsapp_number ?? null} storeName={storeName} />
    </>
  );
}
