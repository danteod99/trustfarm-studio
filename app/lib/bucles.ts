import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { isAdminEmail } from "@/app/lib/auth";
import { addCredits, chargeCredits } from "@/app/lib/credits";
import { CLIPS_BUCKET, trustclipOrigin, type CobroClip } from "@/app/lib/clips";
import { EDITAR_PRECIOS } from "@/app/lib/editar";
import { limpiarUsuario, PERFIL_MAX_VIDEOS } from "@/app/lib/perfil";
import { nextRunAt } from "@/app/lib/automatizacion";
import {
  MAX_BUCLES_POR_CUENTA, costoTrabajo, ejecutarVuelta, migracionMarcoPendiente, opcionesMarco, recogerRun, requiereMigracion09, runColgada, runKeyPerfil, validarConfig,
  type Candidato, type DepsRecoger, type DepsVuelta, type JobParaRecoger, type Tool, type ToolLoop, type ToolRun,
} from "@/app/lib/bucles-core";
import { channelIdDeHtml, clasificarYouTube, parseFeed, urlFeed, urlVideo, type VideoFeed } from "@/app/lib/youtube-feed";

// Bucles de herramienta: cableado a Supabase de la lógica de bucles-core.ts. Cada vuelta crea un clip_jobs normal
// (lo procesa trustclip: Railway para clips, la Mac mini para perfil); cuando termina, el tick copia los clips a
// `deliveries/` del bucket `clips` y crea las filas de tool_deliveries que recoge TrustFarm Desktop.

const db = () => supabaseAdmin();
export const PRECIOS_BUCLE = {
  clips: EDITAR_PRECIOS.clips, clipsVariacion: EDITAR_PRECIOS.clipsVariacion,
  perfil: EDITAR_PRECIOS.perfil, perfilVariacion: EDITAR_PRECIOS.perfilVariacion,
};
const UA = "Mozilla/5.0 (compatible; TrustFarmStudio/1.0)";

async function esAdmin(userId: string): Promise<boolean> {
  const { data } = await db().auth.admin.getUserById(userId);
  return isAdminEmail(data.user?.email);
}

// ───────── YouTube ─────────

async function fetchTexto(url: string, ms = 15000): Promise<string> {
  const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" }, signal: AbortSignal.timeout(ms), redirect: "follow" });
  if (!r.ok) throw new Error(`YouTube respondió ${r.status}`);
  return r.text();
}

/** Convierte el link que pegó el usuario en los datos fijos del bucle (video único, canal o lista) + los videos actuales. */
export async function resolverFuenteYouTube(url: string): Promise<{ params: Record<string, unknown>; actuales: VideoFeed[]; nombre: string }> {
  const f = clasificarYouTube(url);
  if (!f) throw new Error("Link no válido: usa un link de YouTube (video, canal o lista).");
  if (f.kind === "video") return { params: { kind: "video", url: urlVideo(f.videoId), video_id: f.videoId }, actuales: [], nombre: `Video ${f.videoId}` };
  let feed: { channelId: string } | { playlistId: string };
  if (f.kind === "channel") feed = { channelId: f.channelId };
  else if (f.kind === "playlist") feed = { playlistId: f.playlistId };
  else {
    const id = channelIdDeHtml(await fetchTexto(f.url));
    if (!id) throw new Error("No se pudo encontrar ese canal. Prueba con el link /channel/UC… o con un video del canal.");
    feed = { channelId: id };
  }
  const xml = await fetchTexto(urlFeed(feed));
  const actuales = parseFeed(xml);
  const nombre = /<title>([\s\S]*?)<\/title>/.exec(xml)?.[1]?.trim().slice(0, 60) || "Canal de YouTube";
  return { params: { kind: "channel", url: f.kind === "handle" ? f.url : url.trim().slice(0, 300), ...feed }, actuales, nombre };
}

async function videosDelFeed(params: Record<string, unknown>): Promise<VideoFeed[]> {
  const feed = typeof params.channel_id === "string" ? { channelId: params.channel_id } : typeof params.channelId === "string" ? { channelId: params.channelId } : { playlistId: String(params.playlistId) };
  return parseFeed(await fetchTexto(urlFeed(feed)));
}

// ───────── Crear / validar ─────────

export interface NuevoBucle { tool: Tool; body: Record<string, unknown> }

export async function crearBucle(userId: string, email: string, { tool, body }: NuevoBucle): Promise<{ ok: true; loop: ToolLoop } | { ok: false; error: string; status: number }> {
  if (!trustclipOrigin()) return { ok: false, error: "Esta herramienta todavía no está activa. Escríbenos por WhatsApp.", status: 503 };
  const admin = isAdminEmail(email);
  const cfg = validarConfig(tool, body, admin);
  if (!cfg.ok) return { ok: false, error: cfg.error, status: 400 };
  const { count } = await db().from("tool_loops").select("id", { count: "exact", head: true }).eq("owner", userId);
  if ((count ?? 0) >= MAX_BUCLES_POR_CUENTA) return { ok: false, error: `Máximo ${MAX_BUCLES_POR_CUENTA} bucles por cuenta. Borra uno para crear otro.`, status: 400 };

  let params: Record<string, unknown>;
  let cursor: Record<string, unknown> = {};
  let nombre = cfg.value.name;
  if (tool === "perfil") {
    const handle = limpiarUsuario(body.usuario);
    if (!handle) return { ok: false, error: "Escribe un usuario de TikTok válido (por ejemplo @tucuenta).", status: 400 };
    const max = Math.min(PERFIL_MAX_VIDEOS, Math.max(1, Math.round(Number(body.max_videos) || 3)));
    params = { handle, max_videos: max };
    nombre ||= `Perfil @${handle}`;
    // La primera vuelta baja los últimos `max_videos` del perfil; las siguientes solo los que no estén en cursor.seen.
  } else {
    const url = typeof body.url === "string" ? body.url.trim() : "";
    try {
      const f = await resolverFuenteYouTube(url);
      params = {
        ...f.params,
        clips: Math.min(15, Math.max(1, Math.round(Number(body.clips) || 5))),
        preset: body.preset === "short" ? "short" : "standard",
        subs: body.subs !== false, titulo: body.titulo !== false, framing: body.framing === "fit" ? "fit" : "auto",
      };
      nombre ||= f.nombre;
      // «Desde ahora»: los videos que el canal ya tiene se marcan como vistos; solo se procesan los que suba después.
      // Con desde_ahora=false (o un video suelto) se empieza por los más recientes.
      if (f.params.kind === "channel" && body.desde_ahora !== false) cursor = { seen: f.actuales.map((v) => v.id), baseline: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer ese link.", status: 400 };
    }
  }
  const v = cfg.value;
  // `estilo` es columna de supabase/09: solo se manda con «marco», así los bucles sin marco no dependen de la migración.
  const { data, error } = await db()
    .from("tool_loops")
    .insert({
      owner: userId, site: "studio", tool, name: nombre, params, variacion: v.variacion, pantalla: v.pantalla,
      ...(v.variacion === "marco" ? { estilo: v.estilo } : {}),
      days: v.days, hora: v.hora, minuto: v.minuto, daily_cap: v.daily_cap, max_per_run: v.max_per_run, cursor,
      next_run_at: nextRunAt(v.hora, v.days, new Date(), v.minuto).toISOString(),
    })
    .select("*")
    .single();
  if (error || !data) {
    if (requiereMigracion09(v) && migracionMarcoPendiente(error)) {
      const que = v.variacion === "marco" ? "La variación «Marco o fondo»" : "Ese dispositivo (celular, tablet o monitor)";
      return { ok: false, error: `${que} todavía no está disponible en bucles. Usa laptop o TV, o vuelve pronto.`, status: 503 };
    }
    return { ok: false, error: "No se pudo crear el bucle.", status: 500 };
  }
  return { ok: true, loop: data as ToolLoop };
}

// ───────── Vuelta ─────────

function depsVuelta(): DepsVuelta {
  return {
    async contarHoy(loopId, dia) {
      const { count } = await db().from("tool_runs").select("id", { count: "exact", head: true })
        .eq("loop_id", loopId).eq("lima_day", dia).not("status", "in", "(failed,empty)");
      return count ?? 0;
    },
    async candidatos(loop, dia, limite): Promise<Candidato[]> {
      if (loop.tool === "perfil") {
        const h = String(loop.params.handle);
        return [{ runKey: runKeyPerfil(dia, loop.hora, loop.minuto), sourceRef: `@${h}`, nombre: `@${h}` }];
      }
      const seen = new Set(loop.cursor.seen ?? []);
      let ids: Array<{ id: string; title: string }>;
      if (loop.params.kind === "video") ids = [{ id: String(loop.params.video_id), title: "" }];
      else ids = await videosDelFeed(loop.params);
      const nuevos = ids.filter((v) => !seen.has(v.id));
      if (nuevos.length === 0) return [];
      const { data } = await db().from("tool_runs").select("run_key").eq("loop_id", loop.id).in("run_key", nuevos.map((v) => v.id));
      const usados = new Set((data ?? []).map((r: { run_key: string }) => r.run_key));
      return nuevos.filter((v) => !usados.has(v.id)).slice(0, limite).map((v) => ({ runKey: v.id, sourceRef: v.id, nombre: v.title || v.id }));
    },
    async reservarRun(loop, c, dia, credits, ref) {
      const { data, error } = await db().from("tool_runs")
        .insert({ loop_id: loop.id, owner: loop.owner, run_key: c.runKey, source_ref: c.sourceRef, lima_day: dia, credits, cobro_ref: ref })
        .select("*").single();
      if (data) return { run: data as ToolRun, nueva: true };
      if (error?.code === "23505") {
        const { data: ex } = await db().from("tool_runs").select("*").eq("loop_id", loop.id).eq("run_key", c.runKey).single();
        if (ex) return { run: ex as ToolRun, nueva: false };
      }
      throw new Error(`no se pudo reservar la vuelta: ${error?.message}`);
    },
    async liberarRun(runId) {
      await db().from("tool_runs").delete().eq("id", runId);
    },
    async yaCobrado(owner, ref) {
      const { count } = await db().from("ai_ledger").select("id", { count: "exact", head: true }).eq("user_id", owner).eq("ref", ref).lt("delta", 0);
      return (count ?? 0) > 0;
    },
    async cobrar(owner, credits, ref) {
      const r = await chargeCredits(owner, credits, "bucle", ref);
      return r.ok ? { ok: true } : { ok: false, sinSaldo: !!r.insufficient, error: r.error };
    },
    async encolar(loop, c, ref, credits) {
      const origin = trustclipOrigin();
      if (!origin) throw new Error("trustclip no está configurado (TRUSTCLIP_ORIGIN)");
      const { data: u } = await db().auth.admin.getUserById(loop.owner);
      const email = u.user?.email?.toLowerCase();
      if (!email) throw new Error("la cuenta del bucle ya no existe");
      const cobro: CobroClip = { creditos: credits, ref, user_id: loop.owner };
      const comun = {
        origen: "trustfarm", cobro, loop_id: loop.id, variacion: loop.variacion,
        ...(loop.variacion === "pantalla_real" && loop.pantalla ? { pantalla: loop.pantalla } : {}),
        // Perfil: options.estilo (texto). Multiclip: options.estilo ya es el dict de subtítulos/logo, así que va en marco_estilo.
        ...(loop.variacion === "marco" ? opcionesMarco(loop) : {}),
      };
      if (loop.tool === "perfil") {
        const { data: job, error } = await db().from("clip_jobs").insert({
          user_email: email, user_id: loop.owner, nombre: `@${loop.params.handle}`, status: "pendiente", progress: "En cola",
          options: { tipo: "perfil", handle: loop.params.handle, max_videos: loop.params.max_videos ?? 3, exclude_ids: (loop.cursor.seen ?? []).slice(-200), ...comun },
        }).select("id").single();
        if (error || !job) throw new Error(`clip_jobs: ${error?.message}`);
        return { jobId: job.id };
      }
      const preset = loop.params.preset === "short" ? "short" : "standard";
      const token = randomBytes(24).toString("hex");
      const { data: job, error } = await db().from("clip_jobs").insert({
        user_email: email, user_id: loop.owner, nombre: c.nombre.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 60) || "video", status: "subiendo", upload_token: token,
        options: {
          clips: loop.params.clips ?? 5, subs: loop.params.subs !== false, title: loop.params.titulo !== false,
          framing: loop.params.framing === "fit" ? "fit" : "auto", preset, min_duration: preset === "short" ? 15 : 25,
          max_duration: preset === "short" ? 60 : 90, byok: false, ...comun,
        },
      }).select("id").single();
      if (error || !job) throw new Error(`clip_jobs: ${error?.message}`);
      // El servidor hace lo que haría el navegador: avisar a trustclip que baje el video del link.
      const r = await fetch(`${origin}/ingest/${job.id}`, {
        method: "POST", headers: { "content-type": "application/json", "x-upload-token": token },
        body: JSON.stringify({ url: urlVideo(c.sourceRef) }), signal: AbortSignal.timeout(20000),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (!r.ok) {
        await db().from("clip_jobs").delete().eq("id", job.id);
        throw new Error(`trustclip rechazó el link (${r.status})`);
      }
      return { jobId: job.id };
    },
    async reembolsar(owner, credits, ref, motivo) {
      await addCredits(owner, credits, "refund", `refund:${ref}`, { motivo });
    },
    async marcarRun(runId, patch) {
      await db().from("tool_runs").update(patch).eq("id", runId);
    },
    async guardarBucle(loopId, patch) {
      await db().from("tool_loops").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", loopId);
    },
  };
}

/** Reclama (FOR UPDATE SKIP LOCKED) y corre los bucles que ya tocan. Devuelve cuántos corrió. */
export async function runDueToolLoops(now = new Date()): Promise<number> {
  const { data, error } = await db().rpc("tool_claim_due_loops", { p_limit: 10 });
  if (error) {
    // La tabla/función aún no existe (migración sin correr): el tick sigue con lo demás.
    if (!/tool_claim_due_loops|schema cache|does not exist/i.test(error.message)) console.error("[bucles] reclamo:", error.message);
    return 0;
  }
  let ran = 0;
  const deps = depsVuelta();
  for (const loop of (data ?? []) as ToolLoop[]) {
    try {
      const admin = await esAdmin(loop.owner);
      const costo = costoTrabajo(loop.tool, loop.variacion, PRECIOS_BUCLE, admin);
      await ejecutarVuelta(loop, deps, now, costo);
      ran++;
    } catch (e) {
      // El reclamo vence solo a los 10 min y la vuelta es idempotente: se reintenta sin duplicar cobros.
      console.error(`[bucles] bucle ${loop.id}:`, e);
    }
  }
  return ran;
}

// ───────── Recoger resultados ─────────

function depsRecoger(): DepsRecoger {
  return {
    async refsExistentes(loopId, refs) {
      if (!refs.length) return new Set();
      const { data } = await db().from("tool_deliveries").select("source_ref").eq("loop_id", loopId).in("source_ref", refs);
      return new Set((data ?? []).map((r: { source_ref: string }) => r.source_ref));
    },
    async copiar(desde, hacia) {
      const { error } = await db().storage.from(CLIPS_BUCKET).copy(desde, hacia);
      if (error && !/already exists|Duplicate/i.test(error.message)) throw new Error(`copiar ${desde}: ${error.message}`);
    },
    async subirTexto(path, texto) {
      const { error } = await db().storage.from(CLIPS_BUCKET).upload(path, new Blob([texto], { type: "text/plain; charset=utf-8" }), { upsert: true, contentType: "text/plain; charset=utf-8" });
      if (error) throw new Error(`subir ${path}: ${error.message}`);
    },
    async insertarEntrega(e) {
      const { error } = await db().from("tool_deliveries").insert(e);
      if (error?.code === "23505") return false;
      if (error) throw new Error(`entrega: ${error.message}`);
      return true;
    },
    async reembolsar(owner, credits, ref, motivo) {
      await addCredits(owner, credits, "refund", `refund:${ref}`, { motivo });
    },
    async marcarRun(runId, patch) {
      await db().from("tool_runs").update(patch).eq("id", runId);
    },
    async guardarBucle(loopId, patch) {
      await db().from("tool_loops").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", loopId);
    },
  };
}

/** Cierra las vueltas en curso cuyo trabajo ya terminó; limpia vueltas que murieron antes de encolar. */
export async function collectToolRuns(limit = 30, now = new Date()): Promise<number> {
  const { data: runs, error } = await db().from("tool_runs").select("*").in("status", ["creating", "running"]).order("created_at").limit(limit);
  if (error) return 0;
  const deps = depsRecoger();
  const dv = depsVuelta();
  let cerradas = 0;
  for (const run of (runs ?? []) as Array<ToolRun & { created_at: string }>) {
    try {
      if (run.status === "creating") {
        // Murió entre reservar y encolar. Pasados 15 min se libera (y se reembolsa si llegó a cobrar) para reintentar.
        if (now.getTime() - new Date(run.created_at).getTime() > 15 * 60_000) {
          if (run.credits > 0 && run.cobro_ref && (await dv.yaCobrado(run.owner, run.cobro_ref))) await dv.reembolsar(run.owner, run.credits, run.cobro_ref, "bucle: vuelta interrumpida");
          await dv.liberarRun(run.id);
          cerradas++;
        }
        continue;
      }
      const { data: loop } = await db().from("tool_loops").select("*").eq("id", run.loop_id).maybeSingle(); // fresco: varias vueltas del mismo bucle en un tick
      if (!loop) continue;
      const { data: job } = run.job_id
        ? await db().from("clip_jobs").select("id, status, error, result, expired").eq("id", run.job_id).maybeSingle()
        : { data: null };
      let j = job as JobParaRecoger | null;
      if (j && j.status !== "listo" && j.status !== "error" && runColgada(run, now)) j = { ...j, status: "error", error: "El trabajo no terminó a tiempo." };
      if (await recogerRun(loop as ToolLoop, run, j, deps, now)) cerradas++;
    } catch (e) {
      console.error(`[bucles] recoger ${run.id}:`, e);
    }
  }
  return cerradas;
}

/** Entregas sin recoger tras 7 días: se marcan expired y se borran sus archivos. */
export async function expirarEntregas(now = new Date()): Promise<number> {
  const { data } = await db().from("tool_deliveries").select("id, storage_path, caption_path")
    .in("status", ["pending_pickup", "picked"]).lt("expires_at", now.toISOString()).limit(100);
  const rows = (data ?? []) as Array<{ id: string; storage_path: string; caption_path: string | null }>;
  if (!rows.length) return 0;
  await db().storage.from(CLIPS_BUCKET).remove(rows.flatMap((r) => [r.storage_path, r.caption_path].filter((p): p is string => !!p)));
  await db().from("tool_deliveries").update({ status: "expired" }).in("id", rows.map((r) => r.id));
  return rows.length;
}

/** Entregas ya recogidas hace más de 3 días: se borra el archivo de la nube (el desktop ya lo tiene) y se marca purged_at. */
export async function limpiarEntregadas(now = new Date()): Promise<number> {
  const corte = new Date(now.getTime() - 3 * 86400_000).toISOString();
  const { data } = await db().from("tool_deliveries").select("id, storage_path, caption_path").eq("status", "delivered").is("purged_at", null).lt("delivered_at", corte).limit(100);
  const rows = (data ?? []) as Array<{ id: string; storage_path: string; caption_path: string | null }>;
  if (!rows.length) return 0;
  await db().storage.from(CLIPS_BUCKET).remove(rows.flatMap((r) => [r.storage_path, r.caption_path].filter((p): p is string => !!p)));
  await db().from("tool_deliveries").update({ purged_at: now.toISOString() }).in("id", rows.map((r) => r.id));
  return rows.length;
}

/** Lo que llama /api/cron/tick: nunca lanza (si falta la migración devuelve ceros). */
export async function tickBucles(now = new Date()) {
  const out = { vueltas: 0, cerradas: 0, expiradas: 0, purgadas: 0 };
  try {
    out.vueltas = await runDueToolLoops(now);
    out.cerradas = await collectToolRuns(30, now);
    out.expiradas = await expirarEntregas(now);
    out.purgadas = await limpiarEntregadas(now);
  } catch (e) {
    console.error("[bucles] tick:", e);
  }
  return out;
}
