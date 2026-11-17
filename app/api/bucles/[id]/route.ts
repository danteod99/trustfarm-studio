import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { nextRunAt } from "@/app/lib/automatizacion";
import { validarConfig, type ToolLoop } from "@/app/lib/bucles-core";
import { CLIPS_BUCKET } from "@/app/lib/clips";
import { isAdminEmail } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function mio(id: string, userId: string): Promise<ToolLoop | null> {
  const { data } = await supabaseAdmin().from("tool_loops").select("*").eq("id", id).eq("owner", userId).maybeSingle();
  return (data as ToolLoop) ?? null;
}

// PATCH { accion: "pausar" | "reanudar" } o { horario/topes/variación } para editar.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const loop = await mio(id, user.id);
  if (!loop) return Response.json({ error: "Bucle no encontrado." }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = supabaseAdmin();
  let patch: Record<string, unknown> = {};
  if (b.accion === "pausar") patch = { status: "paused" };
  else if (b.accion === "reanudar") {
    patch = {
      status: "active", last_error: null, consecutive_failures: 0,
      next_run_at: nextRunAt(loop.hora, loop.days, new Date(), loop.minuto).toISOString(),
    };
  } else {
    const c = validarConfig(loop.tool, { ...loop, ...b }, isAdminEmail(user.email));
    if (!c.ok) return Response.json({ error: c.error }, { status: 400 });
    const v = c.value;
    patch = {
      days: v.days, hora: v.hora, minuto: v.minuto, daily_cap: v.daily_cap, max_per_run: v.max_per_run,
      variacion: v.variacion, pantalla: v.pantalla, ...(v.name ? { name: v.name } : {}),
      next_run_at: nextRunAt(v.hora, v.days, new Date(), v.minuto).toISOString(),
    };
  }
  const { data, error } = await db.from("tool_loops").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("owner", user.id).select("*").single();
  if (error) return Response.json({ error: "No se pudo actualizar." }, { status: 500 });
  return Response.json({ loop: data });
}

// DELETE: borra el bucle, sus vueltas/entregas y los archivos de entregas que seguían en la nube.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const loop = await mio(id, user.id);
  if (!loop) return Response.json({ error: "Bucle no encontrado." }, { status: 404 });
  const db = supabaseAdmin();
  const { data } = await db.from("tool_deliveries").select("storage_path, caption_path").eq("loop_id", id).is("purged_at", null).limit(1000);
  const paths = (data ?? []).flatMap((r: { storage_path: string; caption_path: string | null }) => [r.storage_path, r.caption_path].filter((p): p is string => !!p));
  if (paths.length) await db.storage.from(CLIPS_BUCKET).remove(paths);
  await db.from("tool_loops").delete().eq("id", id).eq("owner", user.id);
  return Response.json({ ok: true });
}
