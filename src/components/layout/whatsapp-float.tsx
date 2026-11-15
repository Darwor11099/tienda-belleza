import { ChatIcon } from "@/components/layout/icons";
import { whatsappLink } from "@/lib/whatsapp";

type Props = { whatsappNumber: string | null; storeName: string };

/** Botón flotante. No se muestra si el número aún no está configurado. */
export function WhatsAppFloat({ whatsappNumber, storeName }: Props) {
  if (!whatsappNumber) return null;
  const link = whatsappLink(whatsappNumber, `Hola ${storeName}, tengo una consulta.`);
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
    >
      <ChatIcon className="size-7" />
    </a>
  );
}
