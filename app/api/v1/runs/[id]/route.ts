import { apiCaller, apiError, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { advanceRun, type FlowRun } from "@/app/lib/flujos";
import { publicRun } from "@/app/lib/flujos-publico";

export const maxDuration = 120;

// GET /api/v1/runs/{id} — avance de una corrida de flujo, con el resultado de cada paso.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  const { id } = await ctx.params;
  const { data } = await supabaseAdmin().from("ai_flow_runs").select("*").eq("id", id).eq("user_id", c.userId).maybeSingle();
  if (!data) return apiError(404, "No existe esa corrida.", "not_found");
  return Response.json({ run: await publicRun(await advanceRun(data as FlowRun)) });
}
