import { requireAdmin } from "@/lib/admin";
import { publicImageUrl } from "@/lib/catalog-view";
import { brandColorWarning } from "@/lib/settings-form";
import { DEFAULT_BRAND } from "@/lib/theme";
import { removeBrandImage, saveSettings } from "./actions";
import { BrandUploader } from "./brand-uploader";

type Props = { searchParams: Promise<{ aviso?: string; error?: string }> };
const field = "mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-base focus:border-primary focus:outline-none";
const area = `${field} h-auto py-2`;
const card = "space-y-4 rounded-3xl border bg-card p-5";

export default async function SettingsPage({ searchParams }: Props) {
  const { aviso, error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("store_settings")
    .select("store_name, tagline, whatsapp_number, contact_email, city, business_hours, delivery_info, payment_info, instagram_url, facebook_url, tiktok_url, brand_color, hero_title, hero_subtitle, hero_image_path, logo_path, privacy_policy, product_photos_enabled")
    .eq("id", 1)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (data ?? {}) as any;
  const logo = publicImageUrl(s.logo_path);
  const hero = publicImageUrl(s.hero_image_path);
  const colorWarn = brandColorWarning(s.brand_color);

  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Configuración</h1>
      {aviso && <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{aviso}</p>}
      {error && <p role="alert" className="rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}

      <section className={card}>
        <h2 className="font-display text-2xl">Logo y foto de portada</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Logo (si no hay, se muestra el nombre en texto). Mejor PNG con fondo transparente.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={logo} alt="Logo actual" className="h-12 w-auto rounded border bg-background p-1" />}
            <div className="flex flex-wrap items-center gap-3">
              <BrandUploader kind="logo" label="Logo" />
              {logo && <form action={removeBrandImage.bind(null, "logo")}><button className="text-xs text-muted-foreground underline">Quitar logo</button></form>}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Foto de portada (si no hay, se muestra la paleta de colores). Vertical o cuadrada.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {hero && <img src={hero} alt="Portada actual" className="h-28 w-auto rounded-xl border object-cover" />}
            <div className="flex flex-wrap items-center gap-3">
              <BrandUploader kind="portada" label="Portada" />
              {hero && <form action={removeBrandImage.bind(null, "portada")}><button className="text-xs text-muted-foreground underline">Quitar portada</button></form>}
            </div>
          </div>
        </div>
      </section>

      <form action={saveSettings} className="space-y-6">
        <section className={card}>
          <h2 className="font-display text-2xl">Identidad</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="text-muted-foreground">Nombre de la tienda</span>
              <input name="store_name" required maxLength={60} defaultValue={s.store_name ?? ""} className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Color de marca (botones), formato #A3445E</span>
              <span className="mt-1 flex items-center gap-2">
                <span aria-hidden className="size-11 shrink-0 rounded-2xl border" style={{ background: s.brand_color ?? DEFAULT_BRAND }} />
                <input name="brand_color" maxLength={7} defaultValue={s.brand_color ?? ""} placeholder={`${DEFAULT_BRAND} (predeterminado)`} className={`${field} mt-0 min-w-0`} />
              </span>
              {colorWarn && <span className="mt-1 block text-xs text-destructive">{colorWarn}</span>}
            </label>
          </div>
          <label className="block text-sm"><span className="text-muted-foreground">Frase corta (aparece en el pie y en buscadores)</span>
            <input name="tagline" maxLength={160} defaultValue={s.tagline ?? ""} className={field} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="text-muted-foreground">Título de la portada</span>
              <input name="hero_title" maxLength={90} defaultValue={s.hero_title ?? ""} placeholder="Tu rutina de belleza, en un solo pedido" className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Texto de la portada</span>
              <input name="hero_subtitle" maxLength={220} defaultValue={s.hero_subtitle ?? ""} className={field} /></label>
          </div>
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl">Contacto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="text-muted-foreground">WhatsApp de la tienda (recibe los pedidos)</span>
              <input name="whatsapp_number" required inputMode="tel" defaultValue={s.whatsapp_number ?? ""} placeholder="300 123 4567" className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Correo (opcional)</span>
              <input name="contact_email" type="email" defaultValue={s.contact_email ?? ""} className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Ciudad</span>
              <input name="city" maxLength={80} defaultValue={s.city ?? ""} className={field} /></label>
            <label className="text-sm"><span className="text-muted-foreground">Horario de atención</span>
              <textarea name="business_hours" rows={2} maxLength={300} defaultValue={s.business_hours ?? ""} placeholder={"Lunes a viernes: 9:00 a. m. – 6:00 p. m.\nSábados: 9:00 a. m. – 1:00 p. m."} className={area} /></label>
          </div>
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl">Envíos y pagos</h2>
          <label className="block text-sm"><span className="text-muted-foreground">Información de envíos (zonas, costos, tiempos)</span>
            <textarea name="delivery_info" rows={3} maxLength={1000} defaultValue={s.delivery_info ?? ""} className={area} /></label>
          <label className="block text-sm"><span className="text-muted-foreground">Medios de pago aceptados</span>
            <textarea name="payment_info" rows={2} maxLength={1000} defaultValue={s.payment_info ?? ""} placeholder="Nequi, Daviplata, transferencia Bancolombia, contra entrega en la ciudad." className={area} /></label>
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl">Redes sociales</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["instagram_url", "Instagram"], ["facebook_url", "Facebook"], ["tiktok_url", "TikTok"]].map(([k, l]) => (
              <label key={k} className="text-sm"><span className="text-muted-foreground">{l}</span>
                <input name={k} defaultValue={s[k] ?? ""} placeholder="https://…" className={field} /></label>
            ))}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl">Política de privacidad</h2>
          <p className="text-sm text-muted-foreground">Se publica en /privacidad y se enlaza desde el pie y el formulario de pedido. En la carpeta docs del proyecto hay una plantilla para adaptar; conviene que la revise un abogado.</p>
          <textarea name="privacy_policy" rows={10} maxLength={20000} defaultValue={s.privacy_policy ?? ""} className={area} />
        </section>

        <section className={card}>
          <h2 className="font-display text-2xl">Fotos de productos</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="product_photos_enabled" defaultChecked={s.product_photos_enabled} className="mt-0.5 size-5 accent-[var(--primary)]" />
            <span>Mostrar las fotos de los productos en la tienda. <strong>Actívalo solo si tienes permiso para usar esas fotos</strong> (o si son fotos propias).</span>
          </label>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button className="h-12 rounded-full bg-primary px-8 font-medium text-primary-foreground shadow-lg">Guardar configuración</button>
        </div>
      </form>
    </div>
  );
}
