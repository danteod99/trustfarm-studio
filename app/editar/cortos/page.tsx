import Cortos from "@/app/editar/cortos/Cortos";
import { EDITAR_PRECIOS } from "@/app/lib/editar";

export const metadata = { title: "Editor de cortos" };

export default function CortosPage() {
  return <Cortos precios={{ transcripcion: EDITAR_PRECIOS.transcripcion, retomas: EDITAR_PRECIOS.retomas }} />;
}
