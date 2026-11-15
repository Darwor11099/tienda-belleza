import { publicImageUrl } from "@/lib/catalog-view";
import { deleteImage, moveImage } from "../actions";
import { PhotoUploader } from "./photo-uploader";

type Img = { id: string; storage_path: string; sort_order: number; is_low_res: boolean };

export function PhotosSection({ productId, images, photosEnabled }: { productId: string; images: Img[]; photosEnabled: boolean }) {
  const btn = "rounded-full border bg-card px-2.5 py-1 text-[11px] hover:border-primary disabled:opacity-40";
  return (
    <section className="space-y-4 rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Fotos</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            La primera es la principal.{" "}
            {photosEnabled
              ? "Las fotos se muestran en la tienda."
              : "Las fotos aún no se muestran en la tienda: se activarán en Configuración cuando esté confirmado el permiso de uso. Puedes ir subiéndolas."}
          </p>
        </div>
        <PhotoUploader productId={productId} />
      </div>
      {images.length === 0 ? (
        <p className="rounded-2xl bg-muted/60 p-6 text-center text-sm text-muted-foreground">Sin fotos todavía.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="space-y-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicImageUrl(img.storage_path) ?? ""} alt="" className="h-full w-full object-contain p-2" loading="lazy" />
                {i === 0 && <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">Principal</span>}
                {img.is_low_res && <span className="absolute bottom-2 left-2 rounded-full bg-[#fbebd0] px-2 py-0.5 text-[11px] text-[#7a5410]">Baja resolución</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {i > 0 && <form action={moveImage.bind(null, productId, img.id, "first")}><button className={btn}>Principal</button></form>}
                <form action={moveImage.bind(null, productId, img.id, "up")}><button className={btn} disabled={i === 0} aria-label="Mover antes">←</button></form>
                <form action={moveImage.bind(null, productId, img.id, "down")}><button className={btn} disabled={i === images.length - 1} aria-label="Mover después">→</button></form>
                <form action={deleteImage.bind(null, productId, img.id)}><button className={`${btn} text-destructive`}>Quitar</button></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
