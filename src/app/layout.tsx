import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Jost } from "next/font/google";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/store";
import { safeBrandColor } from "@/lib/theme";
import "./globals.css";

const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", display: "swap" });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings();
  const name = s.ok ? s.data.store_name : siteConfig.fallbackName;
  return {
    title: { default: name, template: `%s | ${name}` },
    description: (s.ok && s.data.tagline) || siteConfig.description,
  };
}

export const viewport: Viewport = { themeColor: "#faf5ef" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getStoreSettings();
  const brand = safeBrandColor(s.ok ? s.data.brand_color : null);
  return (
    <html lang="es-CO" className={`${bodoni.variable} ${jost.variable}`}>
      <head>
        {/* Color de marca editable desde la configuración */}
        <style>{`:root{--primary:${brand};--ring:${brand};--accent-foreground:${brand}}`}</style>
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
