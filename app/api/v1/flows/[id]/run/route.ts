import { apiCaller, apiError, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { startRun } from "@/app/lib/flujos";
import { publicRun } from "@/app/lib/flujos-publico";

export const maxDuration = 120;

// POST /api/v1/flows/{id}/run — corre un flujo guardado; consulta el avance en GET /api/v1/runs/{run_id}.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  const { id } = await ctx.params;
  const { data: f } = await supabaseAdmin().from("ai_flows").select("*").eq("id", id).eq("user_id", c.userId).maybeSingle();
  if (!f) return apiError(404, "No existe ese flujo.", "not_found");
  const run = await startRun(c.userId, { name: f.name, steps: f.steps, character_id: f.character_id, style_id: f.style_id, flow_id: f.id });
  if (run.status === "failed") return apiError(400, run.error || "No se pudo correr el flujo.", "run_failed");
  return Response.json({ run: await publicRun(run) }, { status: 201 });
}
