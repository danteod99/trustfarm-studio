import Variaciones from "@/app/editar/variaciones/Variaciones";
import { EDITAR_PRECIOS } from "@/app/lib/editar";

export const metadata = { title: "Variaciones únicas" };

export default function VariacionesPage() {
  return <Variaciones subsCost={EDITAR_PRECIOS.transcripcion + EDITAR_PRECIOS.detectarSubs} />;
}
