import { ideasPublicas } from "@/app/lib/ideas-servidor";

// El estudio pide aquí la idea de /estudio?idea=<id>. Una idea oculta responde 404.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = (await ideasPublicas()).find((i) => i.id === id);
  if (!idea) return Response.json({ error: "Esa idea no existe." }, { status: 404 });
  return Response.json({ idea });
}
