import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { validateSteps } from "@/app/lib/flujos-validar";
import { limaToUtc, nextRunAt } from "@/app/lib/automatizacion";

export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { data } = await supabaseAdmin()
    .from("ai_loops")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return Response.json({ loops: data ?? [] });
}

// Programa un flujo guardado (flow_id) o una sola generación (step): se repite en días y hora de Lima,
// o con `once` corre una sola vez en `date` + `time` (hora de Lima).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const b = await req.json().catch(() => ({}));
  const db = supabaseAdmin();
  let step = null;
  if (b.flow_id) {
    const { data: f } = await db
      .from("ai_flows")
      .select("id")
      .eq("id", b.flow_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!f)
      return Response.json({ error: "No existe ese flujo." }, { status: 404 });
  } else {
    const v = validateSteps([b.step]);
    if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
    step = v.steps[0];
  }
  const once = b.once === true;
  let nextRun: Date;
  let hour = Math.min(Math.max(Math.floor(Number(b.hour ?? 9)), 0), 23);
  let minute = Math.min(Math.max(Math.floor(Number(b.minute ?? 0)), 0), 59);
  const days = (Array.isArray(b.days) ? b.days : [0, 1, 2, 3, 4, 5, 6])
    .map(Number)
    .filter((d: number) => d >= 0 && d <= 6);
  if (once) {
    const at = limaToUtc(String(b.date ?? ""), String(b.time ?? ""));
    if (!at)
      return Response.json(
        { error: "Elige una fecha y hora válidas." },
        { status: 400 },
      );
    if (at.getTime() <= Date.now() + 60_000)
      return Response.json(
        { error: "Esa fecha y hora ya pasaron." },
        { status: 400 },
      );
    if (at.getTime() > Date.now() + 90 * 86400_000)
      return Response.json(
        { error: "Se puede programar hasta 90 días adelante." },
        { status: 400 },
      );
    nextRun = at;
    [hour, minute] = String(b.time).split(":").map(Number);
  } else {
    if (days.length === 0)
      return Response.json(
        { error: "Elige al menos un día." },
        { status: 400 },
      );
    nextRun = nextRunAt(hour, days, new Date(), minute);
  }
  const perRun = Math.min(Math.max(Math.floor(Number(b.per_run ?? 1)), 1), 10);
  const { count } = await db
    .from("ai_loops")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= 20)
    return Response.json(
      { error: "Máximo 20 loops por cuenta." },
      { status: 400 },
    );
  const { data, error } = await db
    .from("ai_loops")
    .insert({
      user_id: user.id,
      name:
        String(b.name ?? "")
          .trim()
          .slice(0, 80) || "Mi loop",
      flow_id: b.flow_id || null,
      step,
      per_run: perRun,
      hour,
      days,
      next_run_at: nextRun.toISOString(),
      // Columnas de 07_programar_una_vez.sql: sin ellas solo se manda lo que ya existía.
      ...(once || minute ? { once, minute } : {}),
    })
    .select()
    .single();
  if (error)
    return Response.json(
      { error: "Las programaciones aún no están activadas." },
      { status: 503 },
    );
  return Response.json({ loop: data });
}
