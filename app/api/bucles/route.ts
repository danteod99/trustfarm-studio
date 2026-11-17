import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { crearBucle } from "@/app/lib/bucles";
import type { Tool } from "@/app/lib/bucles-core";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TOOLS: Tool[] = ["multiclip", "perfil"];

// GET /api/bucles?tool=multiclip|perfil: mis bucles con el conteo de entregas por estado y las últimas vueltas.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const tool = new URL(req.url).searchParams.get("tool");
  const db = supabaseAdmin();
  let q = db.from("tool_loops").select("*").eq("owner", user.id).order("created_at", { ascending: false });
  if (tool && TOOLS.includes(tool as Tool)) q = q.eq("tool", tool);
  const { data: loops, error } = await q;
  // Migración sin aplicar todavía: la UI muestra "no disponible" en vez de romperse.
  if (error) return Response.json({ loops: [], disponible: false });
  const ids = (loops ?? []).map((l) => l.id);
  const conteo: Record<string, Record<string, number>> = {};
  const ultimas: Record<string, unknown[]> = {};
  if (ids.length) {
    const { data: ents } = await db.from("tool_deliveries").select("loop_id, status").in("loop_id", ids).limit(5000);
    for (const e of ents ?? []) {
      (conteo[e.loop_id] ??= {})[e.status] = (conteo[e.loop_id][e.status] ?? 0) + 1;
    }
    const { data: runs } = await db.from("tool_runs").select("loop_id, status, source_ref, error, created_at, finished_at").in("loop_id", ids).order("created_at", { ascending: false }).limit(60);
    for (const r of runs ?? []) {
      const arr = (ultimas[r.loop_id] ??= []);
      if (arr.length < 3) arr.push(r);
    }
  }
  return Response.json({
    disponible: true,
    loops: (loops ?? []).map((l) => ({ ...l, entregas: conteo[l.id] ?? {}, ultimas_vueltas: ultimas[l.id] ?? [] })),
  });
}

// POST: crea un bucle. { tool, name?, url | usuario, days, hora, minuto, daily_cap, max_per_run, variacion?, pantalla?, ... }
export async function POST(req: Request) {
  const user = await getUser();
  if (!user?.email) return UNAUTHORIZED();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!TOOLS.includes(b.tool as Tool)) return Response.json({ error: "Herramienta no válida." }, { status: 400 });
  const r = await crearBucle(user.id, user.email, { tool: b.tool as Tool, body: b });
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ loop: r.loop });
}
