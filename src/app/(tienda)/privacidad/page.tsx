import type { Metadata } from "next";
import { getStoreSettings } from "@/lib/store";

export const revalidate = 60;
export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage() {
  const s = await getStoreSettings();
  const policy = s.ok ? s.data.privacy_policy : null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-5xl">Política de privacidad</h1>
      {policy ? (
        <div className="mt-8 leading-relaxed whitespace-pre-line">{policy}</div>
      ) : (
        <p className="mt-8 text-muted-foreground">La política de privacidad se publicará próximamente. Si tienes preguntas sobre el uso de tus datos, escríbenos por WhatsApp.</p>
      )}
    </div>
  );
}
