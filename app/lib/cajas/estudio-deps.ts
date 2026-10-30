// Dependencias reales del Estudio para la caja (Supabase y el motor de generación de Studio).
// Perezosas: se construyen dentro de la petición para que `next build` no falle si faltan variables.
import { supabaseAdmin } from "../supabase/admin";
import { getBalance } from "../credits";
import { MODELS, available, creditCost, getModel, validOptions, type Capacity, type ModelDef } from "../catalog";
import { isAdminEmail } from "../auth";
import { onlineModels, publicGeneration, refreshGeneration, signedUrls, startGeneration, type Generation } from "../generations";
import { runpodConfigured } from "../providers/runpod";
import { depsReales } from "./deps";
import { TOPE_DIARIO_POR_DEFECTO } from "./estudio-tope";
import type { EstudioDeps, GenPublica, ModeloPublico } from "./estudio-servicio";

async function capacidad(): Promise<Capacity> {
  return { online: await onlineModels(), fal: !!process.env.FAL_KEY, runpod: runpodConfigured() };
}

function publico(m: ModelDef): ModeloPublico {
  const aspect = m.aspects[0];
  const opciones: ModeloPublico["opciones"] = [];
  if (m.kind === "image") {
    opciones.push({ costo: creditCost(m, { aspect }) });
  } else {
    for (const d of m.durations ?? []) {
      for (const r of m.resolutions ?? []) {
        if (validOptions(m, { aspect, duration: d, resolution: r }) === null) {
          opciones.push({ duracion: d, resolucion: r, costo: creditCost(m, { aspect, duration: d, resolution: r }) });
        }
      }
    }
  }
  return { id: m.id, kind: m.kind, nombre: m.name, descripcion: m.tagline, formatos: [...m.aspects], opciones };
}

/** Pasa las generaciones en curso por el avance del proveedor y les pone su URL firmada. */
async function aPublicas(gens: Generation[]): Promise<GenPublica[]> {
  const avanzadas = await Promise.all(gens.map((g) => (g.status === "done" || g.status === "failed" ? g : refreshGeneration(g))));
  const urls = await signedUrls(avanzadas);
  return avanzadas.map((g) => publicGeneration(g, urls[g.id]) as GenPublica);
}

export function estudioDepsReales(): EstudioDeps | null {
  const servicio = depsReales();
  if (!servicio) return null;
  const db = () => supabaseAdmin();
  return {
    servicio,
    esAdmin: isAdminEmail,
    store: {
      async gastoHoy(cajaId, desdeIso) {
        const { data, error } = await db().rpc("caja_gasto_hoy", { p_caja: cajaId, p_desde: desdeIso });
        if (error) throw new Error("No se pudo leer el gasto de la caja.");
        return Number(data) || 0;
      },
      async tomarCandado(cajaId) {
        // 150 s: lo que dura la ruta generar (maxDuration 120 s) más un margen
        const { data, error } = await db().rpc("caja_candado_tomar", { p_caja: cajaId, p_segundos: 150 });
        if (error) throw new Error("No se pudo reservar la generación.");
        return data === true;
      },
      async soltarCandado(cajaId) {
        const { error } = await db().rpc("caja_candado_soltar", { p_caja: cajaId });
        if (error) console.error("[estudio] no se pudo soltar el candado:", error.message); // caduca solo
      },
      async topeDe(cajaId) {
        const { data, error } = await db().from("cajas").select("tope_diario").eq("id", cajaId).maybeSingle();
        if (error) throw new Error("No se pudo leer el tope de la caja.");
        return data?.tope_diario ?? TOPE_DIARIO_POR_DEFECTO;
      },
    },
    motor: {
      balance: getBalance,
      async modelos(esAdmin) {
        const cap = await capacidad();
        return MODELS.filter((m) => (esAdmin || !m.adminOnly) && available(m, cap)).map(publico);
      },
      costo({ model, aspect, duration, resolution }, esAdmin) {
        const m = getModel(model);
        if (!m || (m.adminOnly && !esAdmin)) return null;
        const opts = { aspect: aspect as never, duration, resolution: resolution as never };
        return validOptions(m, opts) === null ? creditCost(m, opts) : null;
      },
      async iniciar(userId, gratis, input) {
        const r = await startGeneration(userId, gratis, input);
        if (!r.ok) return r;
        const [g] = await aPublicas([r.generation]);
        return { ok: true, generation: g };
      },
      async listar(userId, q) {
        let query = db().from("ai_generations").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(q.limit ?? 24);
        if (q.kind) query = query.eq("kind", q.kind);
        if (q.before) query = query.lt("created_at", q.before);
        const { data } = await query;
        return aPublicas((data ?? []) as Generation[]);
      },
      async obtener(userId, id) {
        const { data } = await db().from("ai_generations").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!data) return null;
        return (await aPublicas([data as Generation]))[0];
      },
    },
  };
}
