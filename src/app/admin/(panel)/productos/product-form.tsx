import { PriceFields } from "./price-fields";

export type FormDefaults = {
  name: string;
  sku: string | null;
  category_id: string | null;
  description: string | null;
  availability: "disponible" | "consultar" | "agotado";
  price_cop: number | null;
  cost_cop: number | null;
  reference_price_cop: number | null;
  is_featured: boolean;
  is_new: boolean;
  variantMode: "no" | "si-verificadas" | "si-sin-verificar" | "por-decidir";
};

const field = "mt-1 h-11 w-full rounded-2xl border border-input bg-card px-3 text-base focus:border-primary focus:outline-none";

export function ProductFormFields({ d, categories }: { d: FormDefaults; categories: { id: string; name: string }[] }) {
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Datos</h2>
        <label className="block text-sm">
          <span className="text-muted-foreground">Nombre</span>
          <input name="name" required maxLength={200} defaultValue={d.name} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-muted-foreground">Referencia</span>
            <input name="sku" maxLength={40} defaultValue={d.sku ?? ""} className={field} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Categoría</span>
            <select name="categoryId" defaultValue={d.category_id ?? ""} required className={field}>
              <option value="" disabled>Elige una</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Disponibilidad</span>
            <select name="availability" defaultValue={d.availability} className={field}>
              <option value="disponible">Disponible</option>
              <option value="consultar">Consultar disponibilidad</option>
              <option value="agotado">Agotado</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-muted-foreground">Descripción</span>
          <textarea name="description" rows={6} maxLength={4000} defaultValue={d.description ?? ""} className={`${field} h-auto py-2`} />
        </label>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="featured" defaultChecked={d.is_featured} className="size-5 accent-[var(--primary)]" /> Destacado en el inicio</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isNew" defaultChecked={d.is_new} className="size-5 accent-[var(--primary)]" /> Marcar como «Nuevo»</label>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Precio y ganancia</h2>
        <PriceFields price={d.price_cop} cost={d.cost_cop} reference={d.reference_price_cop} />
      </section>

      <section className="space-y-3 rounded-3xl border bg-card p-5">
        <h2 className="font-display text-2xl">Tonos o presentaciones</h2>
        <select name="variants" defaultValue={d.variantMode === "por-decidir" ? "" : d.variantMode} className={`${field} max-w-md`} required={d.variantMode === "por-decidir"}>
          {d.variantMode === "por-decidir" && <option value="" disabled>Por decidir: elige una opción</option>}
          <option value="no">No tiene tonos ni presentaciones</option>
          <option value="si-verificadas">Sí tiene, y están verificadas</option>
          <option value="si-sin-verificar">Sí tiene, pero falta verificarlas</option>
        </select>
        <p className="text-xs text-muted-foreground">La lista de tonos se edita más abajo, en «Lista de tonos o presentaciones».</p>
      </section>
    </div>
  );
}
