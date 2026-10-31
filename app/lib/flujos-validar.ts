// Validación de los pasos de un flujo (pura; la prueban los tests con node --test).
import { MAX_PROMPT, getModel, validOptions, type Aspect, type Resolution } from "./catalog.ts";

export interface FlowStep {
  title: string;
  model: string;
  aspect: Aspect;
  duration?: number;
  resolution?: Resolution;
  motion?: string;
  prompt: string;
  /** "previous": usa la imagen del paso anterior (animarla o como referencia). */
  input: "none" | "previous";
}

export const MAX_STEPS = 6;

export function validateSteps(raw: unknown): { ok: true; steps: FlowStep[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "El flujo necesita al menos un paso." };
  if (raw.length > MAX_STEPS) return { ok: false, error: `Máximo ${MAX_STEPS} pasos por flujo.` };
  const steps: FlowStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = (raw[i] ?? {}) as Record<string, unknown>;
    const n = `Paso ${i + 1}`;
    const model = getModel(String(r.model ?? ""));
    if (!model || model.adminOnly) return { ok: false, error: `${n}: modelo no válido.` };
    const step: FlowStep = {
      title: String(r.title ?? "").trim().slice(0, 60) || n,
      model: model.id,
      aspect: r.aspect as Aspect,
      prompt: String(r.prompt ?? "").trim(),
      input: r.input === "previous" ? "previous" : "none",
      ...(model.kind === "video" ? { duration: Number(r.duration), resolution: r.resolution as Resolution } : {}),
      ...(model.kind === "video" && typeof r.motion === "string" && r.motion ? { motion: r.motion } : {}),
    };
    const bad = validOptions(model, { aspect: step.aspect, duration: step.duration, resolution: step.resolution });
    if (bad) return { ok: false, error: `${n}: ${bad}` };
    if (step.prompt.length < 3) return { ok: false, error: `${n}: escribe la descripción.` };
    if (step.prompt.length > MAX_PROMPT) return { ok: false, error: `${n}: máximo ${MAX_PROMPT} caracteres.` };
    if (/\[[^\]]{1,80}\]/.test(step.prompt)) return { ok: false, error: `${n}: completa lo que está entre corchetes.` };
    if (step.input === "previous") {
      const prev = i > 0 ? getModel(steps[i - 1].model) : undefined;
      if (!prev) return { ok: false, error: `${n}: el primer paso no puede usar un resultado anterior.` };
      if (prev.kind !== "image") return { ok: false, error: `${n}: solo se puede usar el resultado de un paso de imagen.` };
      if (!model.acceptsImage) return { ok: false, error: `${n}: ${model.name} no acepta imagen de entrada.` };
    }
    steps.push(step);
  }
  return { ok: true, steps };
}
