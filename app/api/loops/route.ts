import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { validateSteps } from "@/app/lib/flujos-validar";
import { nextRunAt } from "@/app/lib/automatizacion";

export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { data } = await supabaseAdmin().from("ai_loops").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  return Response.json({ loops: data ?? [] });
}

// Crea un loop: repite un flujo guardado (flow_id) o una sola generación (step) en días y hora de Lima.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const b = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  let step = null;
  if (b.flow_id) {
    const { data: f } = await db.from("ai_flows").select("id").eq("id", b.flow_id).eq("user_id", user.id).maybeSingle();
    if (!f) return Response.json({ error: "No existe ese flujo." }, { status: 404 });
  } else {
    const v = validateSteps([b.step]);
    if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
    step = v.steps[0];
  }
  const hour = Math.min(Math.max(Math.floor(Number(b.hour ?? 9)), 0), 23);
  const days = (Array.isArray(b.days) ? b.days : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((d: number) => d >= 0 && d <= 6);
  const perRun = Math.min(Math.max(Math.floor(Number(b.per_run ?? 1)), 1), 10);
  const { count } = await db.from("ai_loops").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= 20) return Response.json({ error: "Máximo 20 loops por cuenta." }, { status: 400 });
  const { data, error } = await db
    .from("ai_loops")
    .insert({
      user_id: user.id,
      name: String(b.name ?? "").trim().slice(0, 80) || "Mi loop",
      flow_id: b.flow_id || null,
      step,
      per_run: perRun,
      hour,
      days,
      next_run_at: nextRunAt(hour, days).toISOString(),
    })
    .select()
    .single();
  if (error) return Response.json({ error: "Los loops aún no están activados." }, { status: 503 });
  return Response.json({ loop: data });
}
