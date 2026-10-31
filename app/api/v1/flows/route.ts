import { apiCaller, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// GET /api/v1/flows — los flujos guardados de la cuenta.
export async function GET(req: Request) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  const { data } = await supabaseAdmin().from("ai_flows").select("id, name, steps, created_at").eq("user_id", c.userId).order("created_at", { ascending: false });
  return Response.json({ flows: data ?? [] });
}
