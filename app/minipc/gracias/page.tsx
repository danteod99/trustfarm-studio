import Link from "next/link";
import type { Metadata } from "next";
import { CONTACTO, ENTREGA_TEXTO } from "@/app/lib/minipc";

export const metadata: Metadata = {
  title: "Gracias por tu compra — TRUST Assistant",
  robots: { index: false, follow: false },
};

export default function GraciasPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight">Recibimos tu pago</h1>
      <p className="mt-4 text-mute">
        Te escribiremos para coordinar la configuración de tu caja (rubro, catálogo y número de WhatsApp). Entrega
        estimada: {ENTREGA_TEXTO}.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/minipc" className="btn-ghost">
          Volver a TRUST Assistant
        </Link>
        <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Soporte por WhatsApp {CONTACTO.whatsapp}
        </a>
      </div>
    </div>
  );
}
