import Link from "next/link";
import type { Category, StoreSettings } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";

type Props = { settings: StoreSettings | null; storeName: string; categories: Category[] };

export function SiteFooter({ settings, storeName, categories }: Props) {
  const wa = settings?.whatsapp_number ? whatsappLink(settings.whatsapp_number) : null;
  const social = [
    { label: "Instagram", href: settings?.instagram_url },
    { label: "Facebook", href: settings?.facebook_url },
    { label: "TikTok", href: settings?.tiktok_url },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  return (
    <footer className="mt-24 bg-blush/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-3xl">{storeName}</p>
          {settings?.tagline && <p className="mt-3 max-w-xs text-sm">{settings.tagline}</p>}
          {settings?.city && <p className="mt-3 text-sm">{settings.city}</p>}
        </div>

        <nav aria-label="Categorías del pie">
          <p className="text-sm font-medium">Categorías</p>
          <ul className="mt-3 space-y-2 text-sm">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/catalogo?categoria=${c.slug}`} className="underline-offset-4 hover:underline">{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-5 text-sm">
          {(wa || settings?.contact_email) && (
            <div>
              <p className="font-medium">Contacto</p>
              <ul className="mt-3 space-y-2">
                {wa && <li><a href={wa} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">WhatsApp</a></li>}
                {settings?.contact_email && <li><a href={`mailto:${settings.contact_email}`} className="underline-offset-4 hover:underline">{settings.contact_email}</a></li>}
              </ul>
            </div>
          )}
          {settings?.business_hours && (
            <div>
              <p className="font-medium">Horario de atención</p>
              <p className="mt-2 whitespace-pre-line">{settings.business_hours}</p>
            </div>
          )}
        </div>

        <div className="space-y-5 text-sm">
          {settings?.delivery_info && (
            <div>
              <p className="font-medium">Envíos</p>
              <p className="mt-2 whitespace-pre-line">{settings.delivery_info}</p>
            </div>
          )}
          {settings?.payment_info && (
            <div>
              <p className="font-medium">Pagos</p>
              <p className="mt-2 whitespace-pre-line">{settings.payment_info}</p>
            </div>
          )}
          {social.length > 0 && (
            <div>
              <p className="font-medium">Síguenos</p>
              <ul className="mt-2 flex flex-wrap gap-4">
                {social.map((s) => (
                  <li key={s.label}><a href={s.href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">{s.label}</a></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-foreground/10 px-4 py-5 text-center text-xs">
        © {new Date().getFullYear()} {storeName}
        {settings?.privacy_policy && (
          <>
            {" · "}
            <Link href="/privacidad" className="underline-offset-4 hover:underline">Política de privacidad</Link>
          </>
        )}
      </p>
    </footer>
  );
}
