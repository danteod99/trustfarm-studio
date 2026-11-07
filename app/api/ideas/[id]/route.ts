import { getUser, isAdminEmail } from "@/app/lib/auth";
import { ideaParaEstudio } from "@/app/lib/ideas-datos";
import { ideasParaAdmin, ideasPublicas } from "@/app/lib/ideas-servidor";

// El estudio pide aquí la idea de /estudio?idea=<id>. Una idea oculta responde 404, salvo a un admin:
// así se puede probar en el estudio antes de publicarla.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await ideaParaEstudio(
    id,
    await ideasPublicas(),
    async () => isAdminEmail((await getUser())?.email),
    async () => (await ideasParaAdmin()).ideas,
  );
  if (!idea) return Response.json({ error: "Esa idea no existe." }, { status: 404 });
  return Response.json({ idea });
}
