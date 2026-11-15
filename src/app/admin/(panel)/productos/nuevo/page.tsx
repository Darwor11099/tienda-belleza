import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { createProduct } from "../actions";
import { ProductFormFields } from "../product-form";

export default async function NewProduct({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: cats } = await supabase.from("categories").select("id, name").order("sort_order");
  return (
    <div className="space-y-6">
      <Link href="/admin/productos" className="text-sm underline underline-offset-4">← Productos</Link>
      <h1 className="text-4xl">Nuevo producto</h1>
      <p className="text-sm text-muted-foreground">Se crea oculto. Cuando esté listo, ábrelo y pulsa «Publicar en la tienda».</p>
      {error && <p role="alert" className="rounded-2xl border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{error}</p>}
      <form action={createProduct} className="space-y-6">
        <ProductFormFields
          d={{ name: "", sku: null, category_id: null, description: null, availability: "consultar", price_cop: null, cost_cop: null, reference_price_cop: null, is_featured: false, is_new: true, variantMode: "no" }}
          categories={cats ?? []}
        />
        <div className="flex justify-end"><button className="h-12 rounded-full bg-primary px-8 font-medium text-primary-foreground">Crear producto</button></div>
      </form>
    </div>
  );
}
