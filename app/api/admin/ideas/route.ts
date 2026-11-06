import { FORBIDDEN, getUser, isAdminEmail } from "@/app/lib/auth";
import { validarIdea } from "@/app/lib/ideas-datos";
import { ideasParaAdmin } from "@/app/lib/ideas-servidor";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

const SIN_TABLA = "Falta crear la tabla: corre supabase/15_ideas.sql en Supabase.";

export async function GET() {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();
  return Response.json(await ideasParaAdmin());
}

// Idea nueva: va primero (orden 0).
export async function POST(req: Request) {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();

  const v = validarIdea(await req.json().catch(() => null));
  if ("error" in v) return Response.json({ error: v.error }, { status: 400 });

  const { ideas, faltaTabla, caida } = await ideasParaAdmin();
  if (faltaTabla) return Response.json({ error: SIN_TABLA }, { status: 503 });
  if (caida) return Response.json({ error: "La base no respondió. Intenta de nuevo." }, { status: 503 });
  if (ideas.some((i) => i.id === v.fila.id)) return Response.json({ error: "Ya hay una idea con ese id." }, { status: 409 });

  const { error } = await supabaseAdmin().from("ideas").insert({ ...v.fila, orden: 0, oculta: false });
  if (error) {
    console.error("[admin/ideas] crear:", error.message);
    return Response.json({ error: "No se pudo guardar la idea." }, { status: 500 });
  }
  return Response.json({ ok: true, id: v.fila.id });
}
