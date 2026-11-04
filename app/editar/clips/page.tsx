import Clips from "@/app/editar/clips/Clips";
import { CLIPS_LIMITE_DIARIO, EDITAR_PRECIOS } from "@/app/lib/editar";

export const metadata = { title: "Multiclipping" };

export default function ClipsPage() {
  return <Clips precio={EDITAR_PRECIOS.clips} limite={CLIPS_LIMITE_DIARIO} />;
}
