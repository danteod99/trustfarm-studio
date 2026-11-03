import { apiCaller, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { publicModelId } from "@/app/lib/catalog";
import type { FlowStep } from "@/app/lib/flujos-validar";

// GET /api/v1/flows — los flujos guardados de la cuenta.
export async function GET(req: Request) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  const { data } = await supabaseAdmin().from("ai_flows").select("id, name, steps, created_at").eq("user_id", c.userId).order("created_at", { ascending: false });
  const flows = (data ?? []).map((f) => ({ ...f, steps: (f.steps as FlowStep[]).map((s) => ({ ...s, model: publicModelId(s.model) })) }));
  return Response.json({ flows });
}
