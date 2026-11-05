import Link from "next/link";
import type { Metadata } from "next";
import { CONTACTO, ENTREGA_TEXTO, RESERVA_USD } from "@/app/lib/minipc";

export const metadata: Metadata = {
  title: "Gracias por tu reserva — TRUST Assistant",
  robots: { index: false, follow: false },
};

export default function GraciasPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight">Tu equipo está reservado</h1>
      <p className="mt-4 text-mute">
        Recibimos tu reserva de ${RESERVA_USD}, que se descuenta del precio de tu plan. Te escribiremos por WhatsApp para
        coordinar el pago del saldo y la configuración de tu caja (rubro, catálogo y número de WhatsApp). Entrega
        estimada: {ENTREGA_TEXTO} después de pagado el saldo.
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
