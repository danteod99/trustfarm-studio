import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { startRun } from "@/app/lib/flujos";
import { publicRun } from "@/app/lib/flujos-publico";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const { data: f } = await supabaseAdmin().from("ai_flows").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!f) return Response.json({ error: "No existe ese flujo." }, { status: 404 });
  const run = await startRun(user.id, { name: f.name, steps: f.steps, character_id: f.character_id, style_id: f.style_id, flow_id: f.id });
  if (run.status === "failed") return Response.json({ error: run.error }, { status: 400 });
  return Response.json({ run: await publicRun(run) });
}
