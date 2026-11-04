import { randomBytes, randomUUID } from "crypto";
import { getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { addCredits, chargeCredits } from "@/app/lib/credits";
import { CLIPS_LIMITE_DIARIO, EDITAR_PRECIOS } from "@/app/lib/editar";
import { reembolsarClip, trustclipOrigin, type CobroClip } from "@/app/lib/clips";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

const COLS = "id, created_at, updated_at, finished_at, nombre, status, progress, error, options, result, expired, input_bytes";

// GET: mis trabajos de Multiclipping (y devuelve los créditos de los que fallaron).
export async function GET() {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { data, error } = await supabaseAdmin()
    .from("clip_jobs")
    .select(COLS)
    .eq("user_email", user.email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return Response.json({ error: "No se pudieron cargar tus videos." }, { status: 500 });
  const jobs = data ?? [];
  for (const j of jobs) {
    if (j.status === "error" && (await reembolsarClip(j, "multiclipping falló"))) {
      const cobro = (j.options as { cobro?: CobroClip }).cobro;
      if (cobro) cobro.reembolsado = true;
    }
  }
  return Response.json({ jobs, activo: !!trustclipOrigin() });
}

// POST: cobra, crea el trabajo y devuelve la URL de subida directa al servicio de clips.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const origin = trustclipOrigin();
  if (!origin) return Response.json({ error: "Multiclipping todavía no está activo. Escríbenos por WhatsApp." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nombre = String(body.nombre || "video").replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 60) || "video";
  const extIn = String(body.ext || "").toLowerCase();
  const ext = ["mp4", "mov", "m4v", "webm", "mkv"].includes(extIn) ? extIn : "mp4";
  const clips = Math.min(15, Math.max(1, Number(body.clips) || 10));
  const preset = body.preset === "short" ? "short" : "standard";
  const [min_duration, max_duration] = preset === "short" ? [15, 60] : [25, 90];
  const admin = isAdminEmail(user.email);
  const email = user.email.toLowerCase();
  const db = supabaseAdmin();

  if (!admin) {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from("clip_jobs")
      .select("id", { count: "exact", head: true })
      .eq("user_email", email)
      .gte("created_at", since)
      .neq("status", "error");
    if ((count || 0) >= CLIPS_LIMITE_DIARIO) {
      return Response.json({ error: `Llegaste al límite de ${CLIPS_LIMITE_DIARIO} videos por día. Intenta mañana.` }, { status: 429 });
    }
  }

  const ref = `clips:${randomUUID()}`;
  const creditos = admin ? 0 : EDITAR_PRECIOS.clips;
  if (creditos) {
    const r = await chargeCredits(user.id, creditos, "editar:clips", ref);
    if (!r.ok) {
      const error = r.insufficient ? `Créditos insuficientes: cada video cuesta ${creditos} créditos. Recarga en /creditos.` : r.error;
      return Response.json({ error, insufficient: !!r.insufficient }, { status: r.insufficient ? 402 : 500 });
    }
  }
  const cobro: CobroClip = { creditos, ref, user_id: user.id };
  const options = {
    clips, subs: body.subs !== false, framing: body.framing === "fit" ? "fit" : "auto",
    preset, min_duration, max_duration, byok: false, origen: "trustfarm", cobro,
  };
  const token = randomBytes(24).toString("hex");
  const { data: job, error } = await db
    .from("clip_jobs")
    .insert({ user_email: email, user_id: user.id, nombre, status: "subiendo", options, upload_token: token })
    .select("id, status, options")
    .single();
  if (error || !job) {
    if (creditos) await addCredits(user.id, creditos, "refund", `refund:${ref}`, { motivo: "no se pudo crear el trabajo" }).catch(() => {});
    return Response.json({ error: "No se pudo crear el trabajo. No se cobró nada." }, { status: 500 });
  }
  return Response.json({ jobId: job.id, uploadUrl: `${origin}/upload/${job.id}?ext=${ext}`, token, cost: creditos });
}
