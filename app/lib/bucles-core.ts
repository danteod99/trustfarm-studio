// Bucles de herramienta (lógica pura): validación, tope diario, cobro ANTES de encolar, pausas, idempotencia y
// recogida de resultados como entregas. Todo el acceso a base de datos / storage entra por `deps`, así los tests
// lo prueban con memoria y bucles.ts lo conecta a Supabase.

import { nextRunAt } from "./automatizacion.ts";
import { esEstiloMarco, normalizarVariacion, type EstiloMarco, type Variacion } from "./variacion.ts";

export type Tool = "multiclip" | "perfil";
export type EstadoBucle = "active" | "paused" | "error" | "no_credits";

export const MAX_FALLOS_SEGUIDOS = 3;
export const ENTREGA_DIAS = 7;
export const MAX_BUCLES_POR_CUENTA = 5;
export const MAX_SEEN = 300;
/** El reclamo (RPC tool_claim_due_loops) deja un arrendamiento; la vuelta real lo reemplaza al terminar. */
export const LEASE_MIN = 10;

export interface ToolLoop {
  id: string;
  owner: string;
  site: string;
  tool: Tool;
  name: string;
  params: Record<string, unknown>;
  variacion: Variacion | null;
  pantalla: "laptop" | "tv" | null;
  /** Estilo de la variación «marco». Columna de supabase/09; si aún no existe llega undefined (se trata como «mixto»). */
  estilo?: EstiloMarco | null;
  days: number[];
  hora: number;
  minuto: number;
  daily_cap: number;
  max_per_run: number;
  status: EstadoBucle;
  last_error: string | null;
  consecutive_failures: number;
  next_run_at: string;
  last_run_at: string | null;
  cursor: { seen?: string[]; baseline?: boolean } & Record<string, unknown>;
}

export interface ToolRun {
  id: string;
  loop_id: string;
  owner: string;
  run_key: string;
  source_ref: string;
  job_id: string | null;
  status: "creating" | "running" | "done" | "empty" | "failed";
  credits: number;
  cobro_ref: string | null;
}

/** Día calendario en Lima (UTC-5, sin horario de verano), YYYY-MM-DD. */
export function limaDia(now: Date): string {
  return new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
}

const clamp = (n: unknown, lo: number, hi: number, def: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
};

export interface ConfigBucle {
  name: string;
  days: number[];
  hora: number;
  minuto: number;
  daily_cap: number;
  max_per_run: number;
  variacion: Variacion | null;
  pantalla: "laptop" | "tv" | null;
  estilo: EstiloMarco | null;
}

/** Normaliza lo que manda el navegador (horario, topes, variación). Perfil siempre corre 1 trabajo por vuelta. */
export function validarConfig(tool: Tool, b: Record<string, unknown>, admin = false): { ok: true; value: ConfigBucle } | { ok: false; error: string } {
  const days = [...new Set((Array.isArray(b.days) ? b.days : [0, 1, 2, 3, 4, 5, 6]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (days.length === 0) return { ok: false, error: "Elige al menos un día." };
  const capMax = admin ? 10 : 5;
  const { variacion, pantalla, estilo } = normalizarVariacion(b);
  const name = String(b.name ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80);
  return {
    ok: true,
    value: {
      name,
      days,
      hora: clamp(b.hora, 0, 23, 9),
      minuto: clamp(b.minuto, 0, 59, 0),
      daily_cap: clamp(b.daily_cap, 1, capMax, 2),
      max_per_run: tool === "perfil" ? 1 : clamp(b.max_per_run, 1, 5, 1),
      variacion,
      pantalla,
      estilo,
    },
  };
}

/** El insert con variacion 'marco' falló porque supabase/09 aún no está aplicado (falta la columna `estilo` o el CHECK lo rechaza). */
export function migracionMarcoPendiente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const m = error.message ?? "";
  return error.code === "23514" || error.code === "42703" || error.code === "PGRST204" || /estilo|tool_loops_variacion/i.test(m);
}

export function opcionesMarco(loop: Pick<ToolLoop, "tool" | "estilo">): Record<string, string> {
  const estilo = esEstiloMarco(loop.estilo) ? loop.estilo : "mixto";
  return loop.tool === "perfil" ? { estilo } : { marco_estilo: estilo };
}

export interface PreciosBucle { clips: number; clipsVariacion: number; perfil: number; perfilVariacion: number }

/** Créditos por trabajo (los admins no pagan, igual que en las pantallas manuales). */
export function costoTrabajo(tool: Tool, variacion: string | null, p: PreciosBucle, admin: boolean): number {
  if (admin) return 0;
  if (tool === "perfil") return variacion ? p.perfilVariacion : p.perfil;
  return variacion ? p.clipsVariacion : p.clips;
}

export const refCobro = (loopId: string, runKey: string) => `loop:${loopId}:${runKey}`;

/** Clave de la vuelta de perfil: el horario programado de ese día (una vuelta por horario, aunque se reintente). */
export const runKeyPerfil = (day: string, hora: number, minuto: number) =>
  `${day}@${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;

export interface Candidato { runKey: string; sourceRef: string; nombre: string }

export interface DepsVuelta {
  contarHoy(loopId: string, dia: string): Promise<number>;
  /** Trabajos que tocaría lanzar (ya sin los vistos), máximo `limite`. Puede lanzar error (feed caído). */
  candidatos(loop: ToolLoop, dia: string, limite: number): Promise<Candidato[]>;
  /** Inserta la vuelta. Si ya existía (índice único) devuelve la fila existente con `nueva: false`. */
  reservarRun(loop: ToolLoop, c: Candidato, dia: string, credits: number, ref: string): Promise<{ run: ToolRun; nueva: boolean }>;
  liberarRun(runId: string): Promise<void>;
  yaCobrado(owner: string, ref: string): Promise<boolean>;
  cobrar(owner: string, credits: number, ref: string): Promise<{ ok: true } | { ok: false; sinSaldo: boolean; error: string }>;
  /** Crea el trabajo en clip_jobs (con options.cobro y options.loop_id) y lo deja en cola. Lanza error si falla. */
  encolar(loop: ToolLoop, c: Candidato, ref: string, credits: number): Promise<{ jobId: string }>;
  reembolsar(owner: string, credits: number, ref: string, motivo: string): Promise<void>;
  marcarRun(runId: string, patch: Partial<Pick<ToolRun, "status" | "job_id">> & { error?: string | null; finished_at?: string }): Promise<void>;
  guardarBucle(loopId: string, patch: Partial<Pick<ToolLoop, "status" | "last_error" | "consecutive_failures" | "next_run_at" | "last_run_at" | "cursor">>): Promise<void>;
}

export interface ResumenVuelta {
  lanzados: number;
  fallos: number;
  motivo: "ok" | "tope_diario" | "sin_novedades" | "sin_saldo" | "error_fuente" | "pausado_por_fallos" | "video_unico";
}

/**
 * Una vuelta de un bucle ya reclamado. Orden por trabajo: reservar la vuelta (índice único = idempotencia) →
 * cobrar (salvo que el libro ya tenga ese ref) → encolar; si encolar falla se reembolsa. Sin saldo: se libera la
 * reserva (el video no queda "gastado"), el bucle pasa a no_credits y se corta. 3 fallos seguidos → error.
 */
export async function ejecutarVuelta(loop: ToolLoop, deps: DepsVuelta, now: Date, costo: number): Promise<ResumenVuelta> {
  const dia = limaDia(now);
  const proxima = nextRunAt(loop.hora, loop.days, now, loop.minuto).toISOString();
  const base = { next_run_at: proxima, last_run_at: now.toISOString() };

  const hoy = await deps.contarHoy(loop.id, dia);
  const restante = loop.daily_cap - hoy;
  if (restante <= 0) {
    await deps.guardarBucle(loop.id, { ...base, last_error: null });
    return { lanzados: 0, fallos: 0, motivo: "tope_diario" };
  }

  let cands: Candidato[];
  try {
    cands = await deps.candidatos(loop, dia, Math.min(loop.max_per_run, restante));
  } catch (e) {
    const fallos = loop.consecutive_failures + 1;
    const pausa = fallos >= MAX_FALLOS_SEGUIDOS;
    await deps.guardarBucle(loop.id, {
      ...base, consecutive_failures: fallos, last_error: `No se pudo leer la fuente: ${String((e as Error)?.message ?? e).slice(0, 200)}`,
      ...(pausa ? { status: "error" as const } : {}),
    });
    return { lanzados: 0, fallos: 1, motivo: pausa ? "pausado_por_fallos" : "error_fuente" };
  }
  cands = cands.slice(0, Math.min(loop.max_per_run, restante));
  if (cands.length === 0) {
    await deps.guardarBucle(loop.id, { ...base, last_error: null });
    return { lanzados: 0, fallos: 0, motivo: "sin_novedades" };
  }

  let lanzados = 0;
  let fallos = 0;
  let sinSaldo = false;
  let ultimoError: string | null = null;
  for (const c of cands) {
    const ref = refCobro(loop.id, c.runKey);
    const { run, nueva } = await deps.reservarRun(loop, c, dia, costo, ref);
    // Ya existía y avanzó más allá de "creating": esta vuelta ya se hizo (reintento tras un reclamo vencido).
    if (!nueva && run.status !== "creating") continue;
    try {
      if (costo > 0 && !(await deps.yaCobrado(loop.owner, ref))) {
        const r = await deps.cobrar(loop.owner, costo, ref);
        if (!r.ok) {
          await deps.liberarRun(run.id);
          if (r.sinSaldo) {
            sinSaldo = true;
            ultimoError = `Sin créditos: cada trabajo cuesta ${costo}. Recarga y reanuda el bucle.`;
            break;
          }
          fallos++;
          ultimoError = r.error;
          continue;
        }
      }
    } catch (e) {
      await deps.liberarRun(run.id);
      fallos++;
      ultimoError = `Cobro: ${String((e as Error)?.message ?? e).slice(0, 160)}`;
      continue;
    }
    try {
      const { jobId } = await deps.encolar(loop, c, ref, costo);
      await deps.marcarRun(run.id, { status: "running", job_id: jobId });
      lanzados++;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 200);
      if (costo > 0) await deps.reembolsar(loop.owner, costo, ref, `bucle: no se pudo encolar (${msg})`).catch(() => {});
      await deps.marcarRun(run.id, { status: "failed", error: msg, finished_at: now.toISOString() });
      fallos++;
      ultimoError = `No se pudo crear el trabajo: ${msg}`;
    }
  }

  const total = loop.consecutive_failures + fallos;
  const pausaPorFallos = fallos > 0 && total >= MAX_FALLOS_SEGUIDOS;
  let status: EstadoBucle = loop.status;
  let motivo: ResumenVuelta["motivo"] = "ok";
  if (sinSaldo) {
    status = "no_credits";
    motivo = "sin_saldo";
  } else if (pausaPorFallos) {
    status = "error";
    motivo = "pausado_por_fallos";
  } else if (lanzados > 0 && loop.params.kind === "video") {
    // Un link de video suelto no tiene "siguiente": se procesa una vez y el bucle queda en pausa.
    status = "paused";
    ultimoError = "Link de un solo video: ya se procesó. Usa el link de un canal para que se repita con videos nuevos.";
    motivo = "video_unico";
  }
  await deps.guardarBucle(loop.id, {
    ...base,
    status,
    last_error: ultimoError,
    consecutive_failures: fallos > 0 ? total : loop.consecutive_failures,
  });
  return { lanzados, fallos, motivo };
}

// ───────── Recogida de resultados ─────────

export interface ClipJobResult {
  index: number; file: string; srt?: string | null; titulo?: string; hook?: string; caption?: string; tiktok_id?: string;
}
export interface JobParaRecoger { id: string; status: string; error: string | null; result: { clips?: ClipJobResult[] } | null; expired?: boolean }

export interface DepsRecoger {
  refsExistentes(loopId: string, refs: string[]): Promise<Set<string>>;
  copiar(desde: string, hacia: string): Promise<void>;
  subirTexto(path: string, texto: string): Promise<void>;
  /** Inserta; false si el índice único (loop_id, source_ref) ya la tenía. */
  insertarEntrega(e: EntregaNueva): Promise<boolean>;
  reembolsar(owner: string, credits: number, ref: string, motivo: string): Promise<void>;
  marcarRun(runId: string, patch: { status: ToolRun["status"]; error?: string | null; finished_at: string }): Promise<void>;
  guardarBucle(loopId: string, patch: Partial<Pick<ToolLoop, "status" | "last_error" | "consecutive_failures" | "cursor">>): Promise<void>;
}

export interface EntregaNueva {
  loop_id: string; owner: string; run_id: string; source_ref: string; titulo: string; caption: string;
  storage_path: string; caption_path: string; expires_at: string;
}

const limpiaNombre = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60);

export function captionDe(c: ClipJobResult): string {
  if (c.caption?.trim()) return c.caption.trim();
  return [c.titulo?.trim(), c.hook?.trim()].filter(Boolean).join("\n");
}

/** Qué fuente (para no repetir) corresponde a cada clip del resultado. */
export function sourceRefDeClip(tool: Tool, run: ToolRun, c: ClipJobResult): string {
  return tool === "perfil" ? (c.tiktok_id || `${run.run_key}#${c.index}`) : `${run.source_ref}#${c.index}`;
}

function agregarVistos(cursor: ToolLoop["cursor"], ids: string[]): ToolLoop["cursor"] {
  const seen = [...new Set([...(cursor.seen ?? []), ...ids])].slice(-MAX_SEEN);
  return { ...cursor, seen, baseline: true };
}

/**
 * Cierra una vuelta cuyo trabajo ya terminó (listo/error) o desapareció. Devuelve false si el trabajo sigue en curso.
 * - listo con clips nuevos → entregas (copia a deliveries/ con .txt) y fallos seguidos a 0.
 * - listo sin nada nuevo (todo repetido o vacío) → reembolso completo, vuelta `empty`, NO cuenta como fallo.
 * - error / trabajo borrado → reembolso, vuelta `failed`, +1 fallo seguido (3 → bucle en error).
 */
export async function recogerRun(
  loop: ToolLoop, run: ToolRun, job: JobParaRecoger | null, deps: DepsRecoger, now: Date,
): Promise<boolean> {
  const fin = now.toISOString();
  const reembolso = async (motivo: string) => {
    if (run.credits > 0 && run.cobro_ref) await deps.reembolsar(run.owner, run.credits, run.cobro_ref, motivo).catch(() => {});
  };
  const fallar = async (msg: string) => {
    await reembolso(msg);
    await deps.marcarRun(run.id, { status: "failed", error: msg, finished_at: fin });
    const fallos = loop.consecutive_failures + 1;
    await deps.guardarBucle(loop.id, {
      consecutive_failures: fallos, last_error: msg,
      cursor: loop.tool === "multiclip" ? agregarVistos(loop.cursor, [run.source_ref]) : loop.cursor, // no reintentar a diario el mismo video roto
      ...(fallos >= MAX_FALLOS_SEGUIDOS && loop.status === "active" ? { status: "error" as const } : {}),
    });
    return true;
  };

  if (!job) return fallar("El trabajo ya no existe.");
  if (job.status === "error") return fallar(job.error || "El trabajo falló.");
  if (job.status !== "listo") return false;
  if (job.expired) return fallar("El trabajo expiró antes de recogerse.");

  const clips = job.result?.clips ?? [];
  const items = clips.map((c) => ({ c, ref: sourceRefDeClip(loop.tool, run, c) }));
  const existentes = await deps.refsExistentes(loop.id, items.map((i) => i.ref));
  const nuevos = items.filter((i) => !existentes.has(i.ref));

  const vistos = loop.tool === "perfil" ? items.map((i) => i.ref) : [run.source_ref];
  if (nuevos.length === 0) {
    await reembolso("bucle: sin videos nuevos");
    await deps.marcarRun(run.id, { status: "empty", error: null, finished_at: fin });
    await deps.guardarBucle(loop.id, { last_error: null, cursor: agregarVistos(loop.cursor, vistos) });
    return true;
  }

  const expires = new Date(now.getTime() + ENTREGA_DIAS * 86400_000).toISOString();
  let hechas = 0;
  let ultimoError: string | null = null;
  for (const { c, ref } of nuevos) {
    const base = `deliveries/${loop.owner}/${loop.id}/${limpiaNombre(ref)}`;
    const videoPath = `${base}.mp4`;
    const txtPath = `${base}.txt`;
    try {
      await deps.copiar(c.file, videoPath);
      await deps.subirTexto(txtPath, captionDe(c));
      const ok = await deps.insertarEntrega({
        loop_id: loop.id, owner: loop.owner, run_id: run.id, source_ref: ref,
        titulo: (c.titulo || "").slice(0, 200), caption: captionDe(c).slice(0, 2200),
        storage_path: videoPath, caption_path: txtPath, expires_at: expires,
      });
      if (ok) hechas++;
    } catch (e) {
      ultimoError = String((e as Error)?.message ?? e).slice(0, 200);
    }
  }
  if (hechas === 0) return fallar(`No se pudieron preparar las entregas${ultimoError ? `: ${ultimoError}` : ""}`);
  await deps.marcarRun(run.id, { status: "done", error: null, finished_at: fin });
  await deps.guardarBucle(loop.id, { consecutive_failures: 0, last_error: null, cursor: agregarVistos(loop.cursor, vistos) });
  return true;
}

/** Cuánto esperar antes de dar por colgada una vuelta (trabajo que nunca terminó). */
export const RUN_COLGADA_HORAS = 8;
export const runColgada = (run: { created_at: string }, now: Date) => now.getTime() - new Date(run.created_at).getTime() > RUN_COLGADA_HORAS * 3600_000;
