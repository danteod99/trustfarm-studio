import IdeasGallery from "@/app/ideas/IdeasGallery";
import { ideasPublicas } from "@/app/lib/ideas-servidor";

export const metadata = {
  title: "Ideas de videos con IA",
  description: "Ideas listas para generar: máquinas que generan dinero, brainrot, frutinovelas, influencers IA, comida, inmobiliaria y más.",
};

export default async function IdeasPage() {
  return <IdeasGallery ideas={await ideasPublicas()} />;
}
