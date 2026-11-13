import Perfil from "@/app/editar/perfil/Perfil";
import { EDITAR_PRECIOS, PERFIL_LIMITE_DIARIO } from "@/app/lib/editar";

export const metadata = { title: "Perfil de TikTok" };

export default function PerfilPage() {
  return <Perfil precio={EDITAR_PRECIOS.perfil} precioVariacion={EDITAR_PRECIOS.perfilVariacion} limite={PERFIL_LIMITE_DIARIO} />;
}
