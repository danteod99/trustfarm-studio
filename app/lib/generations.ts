import { supabaseAdmin, MEDIA_BUCKET } from "@/app/lib/supabase/admin";
import { addCredits, chargeCredits } from "@/app/lib/credits";
import {
  MAX_ACTIVE_JOBS,
  MAX_PROMPT,
  creditCost,
  getModel,
  validOptions,
  type Aspect,
  type ModelDef,
  type Resolution,
} from "@/app/lib/catalog";
import * as gemini from "@/app/lib/providers/gemini";
import * as fal from "@/app/lib/providers/fal";
import * as runpod from "@/app/lib/providers/runpod";
import { ProviderError, type InputImage, type PollResult } from "@/app/lib/providers/gemini";
import { getPreset, presetPrefix, storageImage } from "@/app/lib/presets";
import { getMotion } from "@/app/lib/templates";

export interface Generation {
  id: string;
  user_id: string;
  kind: "image" | "video";
  model: string;
  prompt: string;
  params: { aspect: Aspect; duration?: number; resolution?: Resolution; withImage?: boolean };
  status: "queued" | "running" | "finalizing" | "done" | "failed";
  cost_credits: number;
  charged: boolean;
  provider_ref: any;
  output_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const ACTIVE = ["queued", "running", "finalizing"];
/** Si un trabajo no terminó en este tiempo se da por perdido y se reembolsa. */
const JOB_TIMEOUT_MS = 30 * 60 * 1000;
/** Un "finalizing" más viejo que esto quedó colgado (la función murió a medio guardar). */
const FINALIZE_STALE_MS = 5 * 60 * 1000;
/** Un trabajo local en cola con el servidor apagado se reembolsa pasado este tiempo. */
const LOCAL_QUEUE_MAX_MS = 10 * 60 * 1000;
/** El servidor local manda señal de vida cada 30 s. */
const WORKER_HEARTBEAT_MS = 90 * 1000;
/** Con esta cantidad de trabajos esperando en el servidor de casa, los nuevos van a RunPod. */
const LOCAL_MAX_QUEUE = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];

export interface StartInput {
  model: string;
  prompt: string;
  aspect: Aspect;
  duration?: number;
  resolution?: Resolution;
  image?: InputImage;
  /** Imagen ya generada por el usuario que se usa como entrada ("Animar"). */
  fromGeneration?: string;
  characterId?: string;
  styleId?: string;
  motion?: string;
}

export type StartResult = { ok: true; generation: Generation } | { ok: false; error: string; status: number };

export async function startGeneration(userId: string, free: boolean, input: StartInput): Promise<StartResult> {
  const model = getModel(input.model);
  // Los modelos en prueba (adminOnly) solo los usan los admins, que son los que generan gratis.
  if (!model || (model.adminOnly && !free)) return { ok: false, error: "Modelo no válido.", status: 400 };

  const prompt = (input.prompt || "").trim();
  if (prompt.length < 3) return { ok: false, error: "Escribe una descripción.", status: 400 };
  if (prompt.length > MAX_PROMPT) return { ok: false, error: `Máximo ${MAX_PROMPT} caracteres.`, status: 400 };

  const opts = { aspect: input.aspect, duration: input.duration, resolution: input.resolution };
  const invalid = validOptions(model, opts);
  if (invalid) return { ok: false, error: invalid, status: 400 };

  let image = input.image;
  if (image) {
    if (!model.acceptsImage) return { ok: false, error: "Este modelo no acepta imagen de referencia.", status: 400 };
    if (!IMAGE_MIMES.includes(image.mime)) return { ok: false, error: "La imagen debe ser JPG, PNG o WEBP.", status: 400 };
    if (Buffer.byteLength(image.data, "base64") > MAX_IMAGE_BYTES) {
      return { ok: false, error: "La imagen pesa más de 5 MB.", status: 400 };
    }
  } else {
    image = undefined;
  }

  const db = supabaseAdmin();

  if (input.fromGeneration && !image) {
    if (!model.acceptsImage) return { ok: false, error: "Este modelo no acepta imagen de entrada.", status: 400 };
    const { data: src } = await db
      .from("ai_generations")
      .select("output_path, kind, status")
      .eq("id", input.fromGeneration)
      .eq("user_id", userId)
      .maybeSingle();
    const loaded = src?.kind === "image" && src.status === "done" && src.output_path ? await storageImage(src.output_path) : null;
    if (!loaded) return { ok: false, error: "No se encontró la imagen a animar.", status: 400 };
    image = loaded;
  }

  // Personaje y estilo guardados: se anteponen al prompt. La foto del personaje solo se
  // manda a los modelos de imagen; en video la imagen es el primer cuadro, no una referencia.
  const style = input.styleId ? await getPreset(userId, input.styleId) : null;
  const character = input.characterId ? await getPreset(userId, input.characterId) : null;
  if ((input.styleId && !style) || (input.characterId && !character)) {
    return { ok: false, error: "Ese personaje o estilo ya no existe.", status: 400 };
  }
  let characterImage = false;
  if (character?.image_path && !image && model.kind === "image" && model.acceptsImage) {
    image = (await storageImage(character.image_path)) ?? undefined;
    characterImage = !!image;
  }
  const motion = model.kind === "video" ? getMotion(input.motion) : undefined;
  const finalPrompt = presetPrefix(style, character, characterImage) + prompt + (motion ? `\n${motion.text}` : "");
  const { count } = await db
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE);
  if ((count ?? 0) >= MAX_ACTIVE_JOBS) {
    return { ok: false, error: `Tienes ${MAX_ACTIVE_JOBS} generaciones en curso. Espera a que termine una.`, status: 429 };
  }

  // Dónde se genera: servidor de casa (gratis) → RunPod (desborde o modelos grandes) → fal.
  // Si no hay dónde, se avisa antes de cobrar.
  const route = await pickRoute(model);
  if (!route) {
    return { ok: false, error: `${model.name} no está disponible en este momento. Usa otro modelo.`, status: 503 };
  }

  const cost = free ? 0 : creditCost(model, opts);
  const { data: row, error: insErr } = await db
    .from("ai_generations")
    .insert({
      user_id: userId,
      kind: model.kind,
      model: model.id,
      prompt: finalPrompt,
      params: { ...opts, withImage: !!image },
      cost_credits: cost,
    })
    .select()
    .single();
  if (insErr || !row) {
    console.error("[gen] insert:", insErr?.message);
    return { ok: false, error: "No se pudo crear la generación.", status: 500 };
  }

  if (cost > 0) {
    const charge = await chargeCredits(userId, cost, `gen:${model.id}`, `gen:${row.id}`);
    if (!charge.ok) {
      await db.from("ai_generations").delete().eq("id", row.id);
      return { ok: false, error: charge.error, status: charge.insufficient ? 402 : 500 };
    }
    await db.from("ai_generations").update({ charged: true }).eq("id", row.id);
  }

  if (route === "local" || route === "runpod") {
    try {
      // El worker (en casa o en RunPod) toma el trabajo de Supabase; la imagen de entrada va al bucket.
      let inputPath: string | undefined;
      if (image) {
        inputPath = `inputs/${userId}/${row.id}.jpg`;
        const { error } = await db.storage
          .from(MEDIA_BUCKET)
          .upload(inputPath, Buffer.from(image.data, "base64"), { contentType: image.mime, upsert: true });
        if (error) throw new Error(`storage: ${error.message}`);
      }
      const params = { ...opts, withImage: !!image, inputPath };
      if (route === "local") {
        // Solo es reclamable (ai_claim_job) cuando provider_ref.local = true, que se marca después de cobrar.
        await update(row.id, { params, provider_ref: { local: true } });
      } else {
        await update(row.id, { params, provider_ref: { runpod: true } });
        const runpodId = await runpod.submit(row.id);
        await update(row.id, { provider_ref: { runpod: true, runpod_id: runpodId } });
      }
    } catch (e) {
      await failGeneration(row.id, publicError(e));
    }
    return { ok: true, generation: await load(row.id) };
  }

  try {
    if (model.provider === "gemini-image") {
      const out = await gemini.generateImage(model.providerModel, finalPrompt, opts.aspect, image);
      const path = await saveOutput(userId, row.id, out.bytes, out.mime);
      await update(row.id, { status: "done", output_path: path });
    } else if (model.provider === "veo") {
      const operation = await gemini.startVeo(
        model.providerModel,
        finalPrompt,
        { aspect: opts.aspect, resolution: opts.resolution!, duration: opts.duration! },
        image
      );
      await update(row.id, { status: "running", provider_ref: { operation } });
    } else {
      const dataUri = image ? `data:${image.mime};base64,${image.data}` : undefined;
      const endpoint = image && model.providerModelImage ? model.providerModelImage : model.providerModel;
      const falInput =
        model.kind === "image"
          ? fal.qwenInput(finalPrompt, opts.aspect)
          : fal.wanInput(finalPrompt, opts.aspect, opts.resolution!, dataUri);
      const ref = await fal.submit(endpoint, falInput);
      await update(row.id, { status: "running", provider_ref: ref });
    }
  } catch (e) {
    await failGeneration(row.id, publicError(e));
  }

  return { ok: true, generation: await load(row.id) };
}

/**
 * Consulta al proveedor el estado de un trabajo en curso y, si terminó, guarda el
 * archivo. Lo llaman el navegador (polling) y el cron de respaldo; dos llamadas a la
 * vez no duplican trabajo porque el paso a "finalizing" es un reclamo atómico.
 */
export async function refreshGeneration(gen: Generation): Promise<Generation> {
  if (!ACTIVE.includes(gen.status)) return gen;

  const age = Date.now() - new Date(gen.created_at).getTime();
  if (age > JOB_TIMEOUT_MS) {
    await failGeneration(gen.id, "La generación tardó demasiado. Te devolvimos los créditos.");
    return load(gen.id);
  }

  if (gen.provider_ref?.runpod) {
    // Lo genera y guarda el worker en RunPod; aquí solo se detecta si RunPod lo dio por fallido.
    if (!gen.provider_ref.runpod_id || gen.status === "done") return gen;
    try {
      const st = await runpod.status(gen.provider_ref.runpod_id);
      if (st.state === "failed") {
        await failGeneration(gen.id, `El servidor en la nube falló. Te devolvimos los créditos. (${st.error ?? ""})`.slice(0, 300));
        return load(gen.id);
      }
      if (st.state === "done") return load(gen.id);
    } catch (e) {
      console.error(`[gen ${gen.id}] runpod:`, e);
    }
    return gen;
  }

  if (gen.provider_ref?.local) {
    // Lo procesa el servidor local; aquí solo se vigila que no quede abandonado en cola.
    if (gen.status === "queued" && age > LOCAL_QUEUE_MAX_MS && !(await workerOnline(gen.model))) {
      await failGeneration(gen.id, "El servidor de generación no está disponible. Te devolvimos los créditos.");
      return load(gen.id);
    }
    return gen;
  }
  if (gen.status === "queued") return gen;
  if (gen.status === "finalizing" && Date.now() - new Date(gen.updated_at).getTime() < FINALIZE_STALE_MS) return gen;
  if (!gen.provider_ref) return gen;

  const model = getModel(gen.model);
  if (!model) return gen;

  let result: PollResult;
  try {
    result = model.provider === "veo" ? await gemini.pollVeo(gen.provider_ref.operation) : await fal.poll(gen.provider_ref);
  } catch (e) {
    console.error(`[gen ${gen.id}] poll:`, e);
    return gen;
  }

  if (result.state === "running") return gen;
  if (result.state === "failed") {
    await failGeneration(gen.id, result.error);
    return load(gen.id);
  }

  // Reclamo atómico: solo una request guarda el archivo.
  const { data: claimed } = await supabaseAdmin()
    .from("ai_generations")
    .update({ status: "finalizing", updated_at: new Date().toISOString() })
    .eq("id", gen.id)
    .eq("status", gen.status)
    .eq("updated_at", gen.updated_at)
    .select("id");
  if (!claimed?.length) return load(gen.id);

  try {
    const file =
      model.provider === "veo"
        ? { bytes: await gemini.downloadVeo(result.uri), mime: "video/mp4" }
        : await fal.download(result.uri);
    const path = await saveOutput(gen.user_id, gen.id, file.bytes, file.mime);
    await update(gen.id, { status: "done", output_path: path, error: null });
  } catch (e) {
    console.error(`[gen ${gen.id}] guardar:`, e);
    // Vuelve a "running": la próxima consulta reintenta la descarga sin regenerar.
    await update(gen.id, { status: "running", error: publicError(e) });
  }
  return load(gen.id);
}

/** Marca el trabajo como fallido y devuelve los créditos (una sola vez). */
export async function failGeneration(id: string, error: string): Promise<void> {
  const { data } = await supabaseAdmin()
    .from("ai_generations")
    .update({ status: "failed", error, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ACTIVE)
    .select("user_id, cost_credits, charged");
  const row = data?.[0];
  if (row?.charged && row.cost_credits > 0) {
    try {
      await addCredits(row.user_id, row.cost_credits, "refund", `refund:${id}`);
    } catch (e) {
      console.error(`[gen ${id}] reembolso falló:`, e);
    }
  }
}

type Route = "local" | "runpod" | "fal" | "google";

async function pickRoute(model: ModelDef): Promise<Route | null> {
  if (model.provider === "gemini-image" || model.provider === "veo") return "google";
  if (model.provider === "runpod") return runpod.runpodConfigured() ? "runpod" : null;
  if (model.localCapable && (await workerOnline(model.id))) {
    if (!model.cloud || !runpod.runpodConfigured() || (await localQueue(model.id)) < LOCAL_MAX_QUEUE) return "local";
  }
  if (model.cloud && runpod.runpodConfigured()) return "runpod";
  if (model.provider === "fal" && process.env.FAL_KEY) return "fal";
  return null;
}

/** Trabajos de este modelo esperando turno en el servidor de casa. */
async function localQueue(modelId: string): Promise<number> {
  const { count } = await supabaseAdmin()
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("model", modelId)
    .eq("status", "queued")
    .eq("provider_ref->>local", "true");
  return count ?? 0;
}

/** Modelos que algún servidor local encendido puede generar ahora. */
export async function onlineModels(): Promise<string[]> {
  const since = new Date(Date.now() - WORKER_HEARTBEAT_MS).toISOString();
  const { data } = await supabaseAdmin().from("ai_workers").select("models").gte("last_seen", since);
  return Array.from(new Set((data ?? []).flatMap((w) => (w.models as string[]) ?? [])));
}

/** ¿Hay un servidor local encendido que sepa generar este modelo? */
export async function workerOnline(modelId: string): Promise<boolean> {
  const since = new Date(Date.now() - WORKER_HEARTBEAT_MS).toISOString();
  const { count } = await supabaseAdmin()
    .from("ai_workers")
    .select("id", { count: "exact", head: true })
    .contains("models", [modelId])
    .gte("last_seen", since);
  return (count ?? 0) > 0;
}

export async function load(id: string): Promise<Generation> {
  const { data } = await supabaseAdmin().from("ai_generations").select("*").eq("id", id).single();
  return data as Generation;
}

export async function signedUrls(gens: Generation[]): Promise<Record<string, string>> {
  const paths = gens.filter((g) => g.output_path).map((g) => g.output_path!) as string[];
  if (!paths.length) return {};
  const { data } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
  const byPath: Record<string, string> = {};
  for (const s of data ?? []) if (s.path && s.signedUrl) byPath[s.path] = s.signedUrl;
  const out: Record<string, string> = {};
  for (const g of gens) if (g.output_path && byPath[g.output_path]) out[g.id] = byPath[g.output_path];
  return out;
}

/** Lo que ve el usuario de una generación (sin referencias internas del proveedor). */
export function publicGeneration(g: Generation, url?: string) {
  return {
    id: g.id,
    kind: g.kind,
    model: g.model,
    prompt: g.prompt,
    params: g.params,
    status: g.status === "finalizing" || g.status === "queued" ? "running" : g.status,
    cost: g.cost_credits,
    error: g.status === "failed" ? g.error : null,
    url: url ?? null,
    createdAt: g.created_at,
  };
}

async function saveOutput(userId: string, id: string, bytes: Buffer, mime: string): Promise<string> {
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
  const path = `${userId}/${id}.${ext}`;
  const { error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`storage: ${error.message}`);
  return path;
}

async function update(id: string, patch: Record<string, unknown>) {
  await supabaseAdmin()
    .from("ai_generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

function publicError(e: unknown): string {
  if (e instanceof ProviderError) return e.message;
  console.error("[gen] error:", e);
  return "Error del proveedor de IA. Te devolvimos los créditos.";
}
