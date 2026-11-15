import { addVariant, deleteVariant, updateVariant } from "../actions";

type Variant = { id: string; name: string; price_cop: number | null; availability: string; is_active: boolean; image_path: string | null };
type Img = { storage_path: string; label: string };

const field = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm focus:border-primary focus:outline-none";

function Fields({ v, images }: { v?: Variant; images: Img[] }) {
  return (
    <>
      <label className="text-xs sm:col-span-2">
        <span className="text-muted-foreground">Tono o presentación</span>
        <input name="name" required maxLength={80} defaultValue={v?.name} placeholder="Ej.: 02 Durazno" className={field} />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Precio propio</span>
        <input name="price" inputMode="numeric" defaultValue={v?.price_cop ?? ""} placeholder="El del producto" className={field} />
      </label>
      <label className="text-xs">
        <span className="text-muted-foreground">Disponibilidad</span>
        <select name="availability" defaultValue={v?.availability ?? "disponible"} className={field}>
          <option value="disponible">Disponible</option>
          <option value="consultar">Consultar</option>
          <option value="agotado">Agotado</option>
        </select>
      </label>
      {images.length > 0 && (
        <label className="text-xs">
          <span className="text-muted-foreground">Foto del tono</span>
          <select name="imagePath" defaultValue={v?.image_path ?? ""} className={field}>
            <option value="">Sin foto propia</option>
            {images.map((i) => <option key={i.storage_path} value={i.storage_path}>{i.label}</option>)}
          </select>
        </label>
      )}
    </>
  );
}

export function VariantsSection({ productId, hasVariants, variants, images }: { productId: string; hasVariants: boolean; variants: Variant[]; images: Img[] }) {
  return (
    <section className="space-y-4 rounded-3xl border bg-card p-5">
      <div>
        <h2 className="font-display text-2xl">Lista de tonos o presentaciones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasVariants
            ? "La clienta deberá elegir uno antes de añadir al carrito. Los agotados se muestran tachados."
            : "Este producto está marcado como «No tiene tonos»: la tienda no muestra esta lista. Cámbialo arriba si los tiene."}
        </p>
      </div>

      {variants.length > 0 && (
        <ul className="space-y-3">
          {variants.map((v) => (
            <li key={v.id} className={`rounded-2xl border p-3 ${v.is_active ? "" : "bg-muted/50"}`}>
              <form action={updateVariant.bind(null, productId, v.id)} className="grid items-end gap-3 sm:grid-cols-6">
                <Fields v={v} images={images} />
                <label className="flex h-10 items-center gap-2 text-xs"><input type="checkbox" name="active" defaultChecked={v.is_active} className="size-4" /> Activo</label>
                <button className="h-10 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground sm:col-start-6">Guardar</button>
              </form>
              <form action={deleteVariant.bind(null, productId, v.id)} className="mt-2 text-right">
                <button className="text-xs text-muted-foreground underline">Eliminar este tono</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addVariant.bind(null, productId)} className="grid items-end gap-3 rounded-2xl border border-dashed p-3 sm:grid-cols-6">
        <Fields images={images} />
        <button className="h-10 rounded-full border border-primary px-4 text-xs font-medium text-primary sm:col-start-6">+ Añadir tono</button>
      </form>
    </section>
  );
}
