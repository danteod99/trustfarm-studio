import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { validateSteps } from "@/app/lib/flujos-validar";
import { advanceActiveRuns, type FlowRun } from "@/app/lib/flujos";
import { publicRun } from "@/app/lib/flujos-publico";

export const maxDuration = 120;

// Flujos del usuario + sus últimas corridas (de paso, avanza las que siguen en curso).
export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const db = supabaseAdmin();
  await advanceActiveRuns(10, user.id);
  const [{ data: flows }, { data: runs }] = await Promise.all([
    db.from("ai_flows").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    db.from("ai_flow_runs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);
  return Response.json({ flows: flows ?? [], runs: await Promise.all(((runs ?? []) as FlowRun[]).map(publicRun)) });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const b = await req.json().catch(() => ({}));
  const v = validateSteps(b.steps);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from("ai_flows")
    .insert({
      user_id: user.id,
      name: String(b.name ?? "").trim().slice(0, 80) || "Mi flujo",
      steps: v.steps,
      character_id: b.character_id || null,
      style_id: b.style_id || null,
    })
    .select()
    .single();
  if (error) return Response.json({ error: "Los flujos aún no están activados." }, { status: 503 });
  return Response.json({ flow: data });
}
