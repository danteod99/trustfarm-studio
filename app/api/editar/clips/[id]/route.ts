import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { CLIPS_BUCKET, reembolsarClip, type JobResult } from "@/app/lib/clips";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => Response.json({ error: "Trabajo no encontrado." }, { status: 404 });

// GET: detalle con enlaces firmados (1 h) de los clips.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: job } = await db
    .from("clip_jobs")
    .select("id, created_at, finished_at, nombre, status, progress, error, options, result, expired, user_email")
    .eq("id", id)
    .maybeSingle();
  if (!job || job.user_email !== user.email.toLowerCase()) return NOT_FOUND();
  let urls: Record<number, { video: string; srt: string | null }> = {};
  if (job.status === "listo" && !job.expired && job.result) {
    const result = job.result as JobResult;
    const paths = result.clips.flatMap((c) => [c.file, c.srt].filter((p): p is string => !!p));
    const { data: signed } = await db.storage.from(CLIPS_BUCKET).createSignedUrls(paths, 3600);
    const map = new Map((signed || []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
    urls = Object.fromEntries(result.clips.map((c) => [c.index, { video: map.get(c.file) || "", srt: c.srt ? map.get(c.srt) || null : null }]));
  }
  return Response.json({ job, urls });
}

// DELETE: borra el trabajo y sus archivos. Si no llegó a procesarse, devuelve los créditos.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: job } = await db.from("clip_jobs").select("id, user_email, status, result, options").eq("id", id).maybeSingle();
  if (!job || job.user_email !== user.email.toLowerCase()) return NOT_FOUND();
  if (job.status === "procesando") return Response.json({ error: "Espera a que termine de procesar." }, { status: 409 });
  if (["subiendo", "pendiente", "error"].includes(job.status)) await reembolsarClip(job, "video cancelado antes de procesarse");
  const result = job.result as JobResult | null;
  const paths = result?.clips?.flatMap((c) => [c.file, c.srt].filter((p): p is string => !!p)) || [];
  if (paths.length) await db.storage.from(CLIPS_BUCKET).remove([...paths, `out/${id}/clips_info.json`]);
  await db.from("clip_jobs").delete().eq("id", id);
  return Response.json({ ok: true });
}
