import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { nextRunAt } from "@/app/lib/automatizacion";

// Pausar / reanudar (al reanudar una que se repite se recalcula la próxima corrida).
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const { active } = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  const { data: l } = await db
    .from("ai_loops")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!l)
    return Response.json(
      { error: "No existe esa programación." },
      { status: 404 },
    );
  if (active && l.once && new Date(l.next_run_at).getTime() <= Date.now()) {
    return Response.json(
      { error: "Esa fecha ya pasó: bórrala y prográmala de nuevo." },
      { status: 400 },
    );
  }
  const next = l.once
    ? l.next_run_at
    : nextRunAt(l.hour, l.days, new Date(), l.minute ?? 0).toISOString();
  const patch = active
    ? { active: true, next_run_at: next, last_error: null }
    : { active: false };
  const { data } = await db
    .from("ai_loops")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  return Response.json({ loop: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  await supabaseAdmin()
    .from("ai_loops")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  return Response.json({ ok: true });
}
