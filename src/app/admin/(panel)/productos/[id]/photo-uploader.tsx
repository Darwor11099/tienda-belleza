"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createPanelBrowserClient } from "@/lib/supabase/browser";
import { registerImage } from "../actions";

const MAX_SIDE = 1600;

/** Reduce la foto en el navegador (máx. 1600 px, WebP) antes de subirla. */
async function optimize(file: File): Promise<{ blob: Blob; lowRes: boolean }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return { blob, lowRes: Math.min(bmp.width, bmp.height) < 600 };
}

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function PhotoUploader({ productId }: { productId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const db = createPanelBrowserClient();
    const notes: string[] = [];
    let done = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("formato no admitido (usa JPG, PNG o WebP)");
        setStatus(`Procesando ${file.name}…`);
        const { blob, lowRes } = await optimize(file);
        const path = `productos/${productId}/${uuid()}.webp`;
        const { error } = await db.storage.from("imagenes").upload(path, blob, { contentType: "image/webp", upsert: false });
        if (error) throw new Error(error.message);
        const r = await registerImage(productId, path, lowRes);
        if (!r.ok) {
          await db.storage.from("imagenes").remove([path]);
          throw new Error(r.message ?? "no se pudo registrar");
        }
        done++;
        if (lowRes) notes.push(`${file.name}: resolución baja (menos de 600 px)`);
      } catch (e) {
        notes.push(`${file.name}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    setStatus(`${done} ${done === 1 ? "foto subida" : "fotos subidas"}.${notes.length ? ` ${notes.join(" · ")}` : ""}`);
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className={`inline-flex h-11 cursor-pointer items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? "Subiendo…" : "Subir fotos"}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
      </label>
      <p className="text-xs text-muted-foreground">JPG, PNG o WebP, hasta 10 a la vez. Se optimizan solas (máx. 1600 px).</p>
      {status && <p role="status" className="text-sm">{status}</p>}
    </div>
  );
}
