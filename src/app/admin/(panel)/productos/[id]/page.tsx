import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { publishBlockers, variantsUndecided } from "@/lib/admin-products";
import { deleteProduct, saveProduct, setPublished } from "../actions";
import { ProductFormFields, type FormDefaults } from "../product-form";
import { PhotosSection } from "./photos-section";
import { VariantsSection } from "./variants-section";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string; error?: string }> };

export default async function EditProduct({ params, searchParams }: Props) {
  const { id } = await params;
  const { aviso, error } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireAdmin();

  const [{ data: p }, { data: cats }, { data: settings }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, sku, slug, description, category_id, availability, price_cop, reference_price_cop, is_active, needs_review, review_notes, " +
          "has_variants, variants_verified, is_featured, is_new, import_key, cost:product_costs(cost_cop), " +
          "variants:product_variants(id, name, price_cop, availability, is_active, sort_order, image_path), " +
          "images:product_images(id, storage_path, sort_order, is_low_res)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order"),
    supabase.from("store_settings").select("product_photos_enabled").eq("id", 1).maybeSingle(),
  ]);
  if (!p) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prod = p as any;
  const cost = Array.isArray(prod.cost) ? prod.cost[0]?.cost_cop ?? null : prod.cost?.cost_cop ?? null;
  const variants = [...(prod.variants ?? [])].sort((a, b) => a.sort_order - b.sort_order) as {
    id: string; name: string; price_cop: number | null; availability: string; is_active: boolean; image_path: string | null;
  }[];
  const images = [...(prod.images ?? [])].sort((a, b) => a.sort_order - b.sort_order) as {
    id: string; storage_path: string; sort_order: number; is_low_res: boolean;
  }[];
  const activeVariants = variants.filter((v) => v.is_active && v.availability !== "agotado").length;
  const blockers = publishBlockers({ ...prod, activeVariants });
  const undecided = variantsUndecided(prod);

  const d: FormDefaults = {
    name: prod.name, sku: prod.sku, category_id: prod.category_id, description: prod.description, availability: prod.availability,
    price_cop: prod.price_cop, cost_cop: cost, reference_price_cop: prod.reference_price_cop, is_featured: prod.is_featured, is_new: prod.is_new,
    variantMode: undecided ? "por-decidir" : prod.has_variants ? (prod.variants_verified ? "si-verificadas" : "si-sin-verificar") : "no",
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/productos" className="text-sm underline underline-offset-4">← Productos</Link>
      {aviso && <p role="status" className="rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">{aviso}</p>}
      {error && <p role="alert" className="rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight sm:text-4xl">{prod.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {prod.sku ? `Ref. ${prod.sku}` : "Sin referencia"}{prod.import_key ? ` · ${prod.import_key}` : ""}
          </p>
        </div>
        {prod.is_active && (
          <a href={`/producto/${prod.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full border px-4 py-2 text-sm hover:border-primary">Ver en la tienda ↗</a>
        )}
      </div>

      <section className="rounded-3xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="font-display text-2xl">{prod.is_active ? "Publicado" : "Oculto"}</p>
          </div>
          {prod.is_active ? (
            <form action={setPublished.bind(null, prod.id, false)}><button className="h-11 rounded-full border px-5 text-sm hover:border-primary">Ocultar de la tienda</button></form>
          ) : (
            <form action={setPublished.bind(null, prod.id, true)}>
              <button disabled={blockers.length > 0} className="h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">Publicar en la tienda</button>
            </form>
          )}
        </div>
        {!prod.is_active && blockers.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-[#7a5410]">
            {blockers.map((b) => <li key={b}>• {b}</li>)}
          </ul>
        )}
        {prod.review_notes && <p className="mt-3 text-xs text-muted-foreground">Notas de la importación: {prod.review_notes}</p>}
      </section>

      <form action={saveProduct.bind(null, prod.id)} className="space-y-6">
        <ProductFormFields d={d} categories={cats ?? []} />
        <div className="sticky bottom-4 z-10 flex justify-end">
          <button className="h-12 rounded-full bg-primary px-8 font-medium text-primary-foreground shadow-lg">Guardar cambios</button>
        </div>
      </form>

      <VariantsSection
        productId={prod.id}
        hasVariants={prod.has_variants}
        variants={variants}
        images={images.map((img, i) => ({ storage_path: img.storage_path, label: `Foto ${i + 1}` }))}
      />

      <PhotosSection productId={prod.id} images={images} photosEnabled={settings?.product_photos_enabled ?? false} />

      <section className="rounded-3xl border border-destructive/30 bg-card p-5">
        <h2 className="font-display text-2xl">Eliminar producto</h2>
        <p className="mt-2 text-sm text-muted-foreground">Se borra de la tienda y del panel, con sus variantes y costo. Los pedidos anteriores conservan su copia del nombre y el precio. Si solo quieres retirarlo, usa «Ocultar».</p>
        <form action={deleteProduct.bind(null, prod.id)} className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmar" className="size-5" /> Sí, quiero eliminarlo definitivamente</label>
          <button className="h-11 rounded-full border border-destructive px-5 text-sm text-destructive">Eliminar</button>
        </form>
      </section>
    </div>
  );
}
