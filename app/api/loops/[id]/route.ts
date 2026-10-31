import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { nextRunAt } from "@/app/lib/automatizacion";

// Pausar / reanudar (al reanudar se recalcula la próxima corrida).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const { active } = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data: l } = await db.from("ai_loops").select("hour, days").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!l) return Response.json({ error: "No existe ese loop." }, { status: 404 });
  const patch = active ? { active: true, next_run_at: nextRunAt(l.hour, l.days).toISOString(), last_error: null } : { active: false };
  const { data } = await db.from("ai_loops").update(patch).eq("id", id).select().single();
  return Response.json({ loop: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  await supabaseAdmin().from("ai_loops").delete().eq("id", id).eq("user_id", user.id);
  return Response.json({ ok: true });
}
