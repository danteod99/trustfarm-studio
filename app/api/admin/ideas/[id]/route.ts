import { FORBIDDEN, getUser, isAdminEmail } from "@/app/lib/auth";
import { ideaAFila, validarIdea, type IdeaAdmin } from "@/app/lib/ideas-datos";
import { ideasParaAdmin } from "@/app/lib/ideas-servidor";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** La idea actual, o la Response de error si no se puede escribir en la base. */
async function actual(id: string): Promise<IdeaAdmin | Response> {
  const { ideas, faltaTabla, caida } = await ideasParaAdmin();
  if (faltaTabla) return Response.json({ error: "Falta crear la tabla: corre supabase/15_ideas.sql en Supabase." }, { status: 503 });
  if (caida) return Response.json({ error: "La base no respondió. Intenta de nuevo." }, { status: 503 });
  return ideas.find((i) => i.id === id) ?? Response.json({ error: "Esa idea no existe." }, { status: 404 });
}

async function guardar(fila: object) {
  // Una idea que solo estaba en el archivo crea aquí su fila.
  const { error } = await supabaseAdmin().from("ideas").upsert({ ...fila, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) {
    console.error("[admin/ideas] guardar:", error.message);
    return Response.json({ error: "No se pudo guardar la idea." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// Editar. El id no cambia: es el enlace de /estudio?idea=<id>.
export async function PUT(req: Request, { params }: Ctx) {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();
  const { id } = await params;
  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validarIdea(cuerpo && { ...cuerpo, id });
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });
  const previa = await actual(id);
  if (previa instanceof Response) return previa;
  return guardar({ ...v.fila, orden: previa.orden, oculta: previa.oculta });
}

// Ocultar o mostrar. No se borra: una idea oculta se puede volver a publicar.
export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();
  const { id } = await params;
  const { oculta } = (await req.json().catch(() => ({}))) as { oculta?: unknown };
  if (typeof oculta !== "boolean") return Response.json({ error: "Indica si la idea se oculta." }, { status: 400 });
  const previa = await actual(id);
  if (previa instanceof Response) return previa;
  return guardar(ideaAFila(previa, previa.orden, oculta));
}
