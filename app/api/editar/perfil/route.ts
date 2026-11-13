import { randomUUID } from "crypto";
import { getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { addCredits, chargeCredits } from "@/app/lib/credits";
import { EDITAR_PRECIOS, PERFIL_LIMITE_DIARIO } from "@/app/lib/editar";
import { reembolsarClip, trustclipOrigin, type CobroClip } from "@/app/lib/clips";
import { opcionesPerfil } from "@/app/lib/perfil";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLS = "id, created_at, updated_at, finished_at, nombre, status, progress, error, options, result, expired";

// GET: mis trabajos de Perfil de TikTok (y devuelve los créditos de los que fallaron).
// El detalle con enlaces firmados y el borrado se reutilizan de /api/editar/clips/[id].
export async function GET() {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { data, error } = await supabaseAdmin()
    .from("clip_jobs")
    .select(COLS)
    .eq("user_email", user.email.toLowerCase())
    .eq("options->>tipo", "perfil")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return Response.json({ error: "No se pudieron cargar tus trabajos." }, { status: 500 });
  const jobs = data ?? [];
  for (const j of jobs) {
    if (j.status === "error" && (await reembolsarClip(j, "perfil de TikTok falló"))) {
      const cobro = (j.options as { cobro?: CobroClip }).cobro;
      if (cobro) cobro.reembolsado = true;
    }
  }
  return Response.json({ jobs, activo: !!trustclipOrigin() });
}

// POST: cobra y deja el trabajo en cola (status "pendiente"); el servicio trustclip lo toma solo.
// No hay subida de archivo: la web escribe directo en clip_jobs con la clave de servicio.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  if (!trustclipOrigin()) return Response.json({ error: "Esta herramienta todavía no está activa. Escríbenos por WhatsApp." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const opts = opcionesPerfil(body);
  if (!opts) return Response.json({ error: "Escribe un usuario de TikTok válido (por ejemplo @tucuenta)." }, { status: 400 });

  const admin = isAdminEmail(user.email);
  const email = user.email.toLowerCase();
  const db = supabaseAdmin();

  if (!admin) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from("clip_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_email", email)
      .eq("options->>tipo", "perfil")
      .gte("created_at", since)
      .neq("status", "error");
    if ((count || 0) >= PERFIL_LIMITE_DIARIO) {
      return Response.json({ error: `Llegaste al límite de ${PERFIL_LIMITE_DIARIO} descargas de perfil por día. Intenta mañana.` }, { status: 429 });
    }
  }

  const ref = `perfil:${randomUUID()}`;
  const creditos = admin ? 0 : opts.variacion ? EDITAR_PRECIOS.perfilVariacion : EDITAR_PRECIOS.perfil;
  if (creditos) {
    const r = await chargeCredits(user.id, creditos, "editar:perfil", ref);
    if (!r.ok) {
      const error = r.insufficient ? `Créditos insuficientes: cuesta ${creditos} créditos. Recarga en /creditos.` : r.error;
      return Response.json({ error, insufficient: !!r.insufficient }, { status: r.insufficient ? 402 : 500 });
    }
  }
  const cobro: CobroClip = { creditos, ref, user_id: user.id };
  const { data: job, error } = await db
    .from("clip_jobs")
    .insert({
      user_email: email, user_id: user.id, nombre: `@${opts.handle}`, status: "pendiente", progress: "En cola",
      options: { ...opts, origen: "trustfarm", cobro },
    })
    .select("id")
    .single();
  if (error || !job) {
    if (creditos) await addCredits(user.id, creditos, "refund", `refund:${ref}`, { motivo: "no se pudo crear el trabajo" }).catch(() => {});
    return Response.json({ error: "No se pudo crear el trabajo. No se cobró nada." }, { status: 500 });
  }
  return Response.json({ jobId: job.id, cost: creditos });
}
