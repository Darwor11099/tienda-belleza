"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPanelBrowserClient } from "@/lib/supabase/browser";
import { setBrandImage } from "./actions";

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Sube el logo (máx. 800 px, conserva transparencia) o la portada (máx. 2000 px) en WebP. */
export function BrandUploader({ kind, label }: { kind: "logo" | "portada"; label: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setMsg("Usa una imagen JPG, PNG o WebP.");
    setBusy(true);
    setMsg("Procesando…");
    try {
      const bmp = await createImageBitmap(file);
      const max = kind === "logo" ? 800 : 2000;
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
      if (!blob) throw new Error("No se pudo procesar la imagen.");
      const path = `marca/${kind}-${uuid()}.webp`;
      const db = createPanelBrowserClient();
      const up = await db.storage.from("imagenes").upload(path, blob, { contentType: "image/webp" });
      if (up.error) throw new Error(up.error.message);
      const r = await setBrandImage(kind, path);
      if (!r.ok) {
        await db.storage.from("imagenes").remove([path]);
        throw new Error(r.message ?? "No se pudo guardar.");
      }
      setMsg(`${label} actualizado.`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al subir.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-1">
      <label className={`inline-flex h-10 cursor-pointer items-center rounded-full border border-primary px-4 text-sm text-primary ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? "Subiendo…" : `Subir ${label.toLowerCase()}`}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </div>
  );
}
