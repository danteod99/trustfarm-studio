import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { getModel } from "@/app/lib/catalog";
import { percentil70 } from "@/app/lib/eta-progreso";
import type { Generation } from "@/app/lib/generations";

/** Cuántas generaciones terminadas recientes se miran por modelo. */
const MUESTRAS = 60;
/** Las estadísticas se recalculan como mucho cada 5 min por modelo (por instancia del servidor). */
const CACHE_MS = 5 * 60 * 1000;

interface Muestra {
  seg: number;
  duration?: number;
  resolution?: string;
}

const cache = new Map<string, { at: number; muestras: Muestra[] }>();

async function muestrasDe(model: string): Promise<Muestra[]> {
  const hit = cache.get(model);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.muestras;
  const { data } = await supabaseAdmin()
    .from("ai_generations")
    .select("created_at, updated_at, params")
    .eq("model", model)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(MUESTRAS);
  const muestras = (data ?? []).map((r: { created_at: string; updated_at: string; params: Generation["params"] | null }) => ({
    seg: (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 1000,
    duration: r.params?.duration,
    resolution: r.params?.resolution,
  }));
  cache.set(model, { at: Date.now(), muestras });
  return muestras;
}

/** Si todavía no hay historial suficiente del modelo. */
function porDefecto(g: Generation): number {
  if (g.kind === "image") return getModel(g.model)?.provider === "runpod" ? 45 : 20;
  return getModel(g.model)?.provider === "runpod" ? 180 : 120;
}

/** Segundos estimados para una generación, según lo que tardaron de verdad las últimas iguales. */
export async function estimarSegundos(g: Generation): Promise<number> {
  try {
    const muestras = await muestrasDe(g.model);
    const iguales = muestras.filter((m) => m.duration === g.params.duration && m.resolution === g.params.resolution);
    return percentil70(iguales.map((m) => m.seg)) ?? percentil70(muestras.map((m) => m.seg)) ?? porDefecto(g);
  } catch (e) {
    console.error(`[eta ${g.id}]`, e);
    return porDefecto(g);
  }
}

/** Estimación para cada generación en curso de la lista (las terminadas no la necesitan). */
export async function etasPara(gens: Generation[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    gens
      .filter((g) => g.status !== "done" && g.status !== "failed")
      .map(async (g) => {
        out[g.id] = await estimarSegundos(g);
      })
  );
  return out;
}
