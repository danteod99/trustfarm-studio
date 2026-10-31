import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { isAdminEmail } from "@/app/lib/auth";
import { load, refreshGeneration, startGeneration, type Generation } from "@/app/lib/generations";
import { nextRunAt } from "@/app/lib/automatizacion";
import type { FlowStep } from "@/app/lib/flujos-validar";

// Motor de flujos y loops. Cada paso es una generación normal (cobra, reembolsa si falla, usa el
// servidor de casa o RunPod). Una corrida avanza cuando su generación actual termina: lo hacen el
// navegador (al mirar /flujos), la API y el tick de la Mac mini (/api/cron/tick cada 2 min).

export interface FlowRun {
  id: string;
  user_id: string;
  flow_id: string | null;
  loop_id: string | null;
  name: string;
  steps: FlowStep[];
  character_id: string | null;
  style_id: string | null;
  status: "running" | "done" | "failed";
  step: number;
  generations: string[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loop {
  id: string;
  user_id: string;
  name: string;
  flow_id: string | null;
  step: FlowStep | null;
  per_run: number;
  hour: number;
  days: number[];
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_error: string | null;
}

const db = () => supabaseAdmin();

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await db().auth.admin.getUserById(userId);
  return isAdminEmail(data.user?.email);
}

async function patchRun(id: string, patch: Partial<FlowRun>) {
  await db().from("ai_flow_runs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

/**
 * Lanza el paso `run.step`. 429 (ya hay 3 generaciones en curso) no es un fallo: la corrida espera y
 * el siguiente tick lo reintenta. Cualquier otro error (sin saldo, modelo apagado…) la marca fallida.
 */
async function launchStep(run: FlowRun): Promise<FlowRun> {
  const s = run.steps[run.step];
  const res = await startGeneration(run.user_id, await isAdminUser(run.user_id), {
    model: s.model,
    prompt: s.prompt,
    aspect: s.aspect,
    duration: s.duration,
    resolution: s.resolution,
    motion: s.motion,
    characterId: run.character_id ?? undefined,
    styleId: run.style_id ?? undefined,
    fromGeneration: s.input === "previous" ? run.generations[run.step - 1] : undefined,
  });
  if (!res.ok) {
    if (res.status === 429) return run;
    const failed = { ...run, status: "failed" as const, error: `${s.title}: ${res.error}` };
    await patchRun(run.id, { status: failed.status, error: failed.error });
    return failed;
  }
  const generations = [...run.generations, res.generation.id];
  await patchRun(run.id, { generations });
  return { ...run, generations };
}

export async function startRun(
  userId: string,
  flow: { name: string; steps: FlowStep[]; character_id?: string | null; style_id?: string | null; flow_id?: string | null },
  loopId: string | null = null
): Promise<FlowRun> {
  const { data, error } = await db()
    .from("ai_flow_runs")
    .insert({
      user_id: userId,
      flow_id: flow.flow_id ?? null,
      loop_id: loopId,
      name: flow.name,
      steps: flow.steps,
      character_id: flow.character_id ?? null,
      style_id: flow.style_id ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`no se pudo crear la corrida: ${error?.message}`);
  return launchStep(data as FlowRun);
}

/** Avanza una corrida: si su generación actual terminó, lanza el paso siguiente (o la cierra). */
export async function advanceRun(run: FlowRun): Promise<FlowRun> {
  if (run.status !== "running") return run;
  const genId = run.generations[run.step];
  if (!genId) return launchStep(run); // estaba esperando turno (429)
  const gen: Generation = await refreshGeneration(await load(genId));
  if (gen.status === "failed") {
    const error = `${run.steps[run.step].title}: ${gen.error || "la generación falló"}`;
    await patchRun(run.id, { status: "failed", error });
    return { ...run, status: "failed", error };
  }
  if (gen.status !== "done") return run;
  if (run.step + 1 >= run.steps.length) {
    await patchRun(run.id, { status: "done" });
    return { ...run, status: "done" };
  }
  const next = { ...run, step: run.step + 1 };
  await patchRun(run.id, { step: next.step });
  return launchStep(next);
}

export async function advanceActiveRuns(limit = 30, userId?: string): Promise<number> {
  let q = db().from("ai_flow_runs").select("*").eq("status", "running").order("updated_at", { ascending: true }).limit(limit);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  for (const r of (data ?? []) as FlowRun[]) {
    try {
      await advanceRun(r);
    } catch (e) {
      console.error(`[flujos] corrida ${r.id}:`, e);
    }
  }
  return data?.length ?? 0;
}

/** Corre los loops que ya tocan. Cada loop se reclama de forma atómica (dos ticks no lo duplican). */
export async function runDueLoops(now = new Date()): Promise<number> {
  const { data } = await db().from("ai_loops").select("*").eq("active", true).lte("next_run_at", now.toISOString()).limit(20);
  let ran = 0;
  for (const loop of (data ?? []) as Loop[]) {
    const next = nextRunAt(loop.hour, loop.days, now).toISOString();
    const { data: claimed } = await db()
      .from("ai_loops")
      .update({ next_run_at: next, last_run_at: now.toISOString() })
      .eq("id", loop.id)
      .eq("next_run_at", loop.next_run_at)
      .select("id");
    if (!claimed?.length) continue;

    let flow: { name: string; steps: FlowStep[]; character_id: string | null; style_id: string | null; flow_id: string | null } | null = null;
    if (loop.flow_id) {
      const { data: f } = await db().from("ai_flows").select("*").eq("id", loop.flow_id).maybeSingle();
      if (f) flow = { name: f.name, steps: f.steps, character_id: f.character_id, style_id: f.style_id, flow_id: f.id };
    } else if (loop.step) {
      flow = { name: loop.name, steps: [loop.step], character_id: null, style_id: null, flow_id: null };
    }
    if (!flow) {
      await db().from("ai_loops").update({ active: false, last_error: "El flujo ya no existe." }).eq("id", loop.id);
      continue;
    }
    let lastError: string | null = null;
    for (let i = 0; i < loop.per_run; i++) {
      try {
        const run = await startRun(loop.user_id, flow, loop.id);
        if (run.status === "failed") lastError = run.error;
      } catch (e) {
        lastError = String(e);
      }
    }
    await db().from("ai_loops").update({ last_error: lastError }).eq("id", loop.id);
    ran++;
  }
  return ran;
}
