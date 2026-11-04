// Ganchos y captions por cuenta para Modo Granja. Arma el prompt y orquesta las llamadas a Claude
// (inyectadas como `call`, así se prueba sin red en tests/granja.test.ts). Sin imports de servidor.

import { MAX_HOOK_WORDS, NETWORK_LABEL, validateHooks, type HookItem, type HookSlot } from "./granja.ts";

export const IDIOMAS = { es: "español latino (Perú)", en: "inglés", pt: "portugués de Brasil" } as const;
export type Idioma = keyof typeof IDIOMAS;

export const TONOS = ["curioso", "divertido", "directo", "emocional", "polémico suave", "educativo"] as const;

export interface HooksOptions { tema: string; idioma: Idioma; tono: string }

/** Ganchos por llamada a Claude (dos llamadas en paralelo por lote de 120). */
export const SLOTS_POR_LLAMADA = 60;

export const HOOKS_SCHEMA = {
  type: "object" as const,
  properties: {
    videos: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          gancho: { type: "string" as const },
          caption: { type: "string" as const },
        },
        required: ["id", "gancho", "caption"],
        additionalProperties: false,
      },
    },
  },
  required: ["videos"],
  additionalProperties: false,
};

export function buildHooksPrompt(slots: HookSlot[], opts: HooksOptions, avoid: string[]): string {
  const lista = slots
    .map((s) => `- id "${s.id}" → @${s.handle} (${NETWORK_LABEL[s.network]})${s.personaje ? ` · personaje: ${s.personaje}` : ""}`)
    .join("\n");
  const evitar = avoid.length ? `\nNO repitas ni parafrasees de cerca estos ganchos ya usados:\n${avoid.slice(-300).map((h) => `- ${h}`).join("\n")}\n` : "";
  return `Eres guionista de videos cortos virales (TikTok, Reels, Shorts). El mismo video base se publicará en muchas cuentas distintas; cada publicación necesita su PROPIO gancho y caption para no verse repetida.

Tema o idea del video: <tema>${opts.tema}</tema>
Idioma: ${IDIOMAS[opts.idioma]}. Tono: ${opts.tono}.

Escribe exactamente un elemento por cada id de esta lista (mismo id):
${lista}
${evitar}
Reglas:
- "gancho": texto corto que va quemado ARRIBA del video. Máximo ${MAX_HOOK_WORDS} palabras, sin hashtags, sin emojis, sin comillas. Que despierte curiosidad en el primer segundo.
- TODOS los ganchos distintos entre sí: cambia el ángulo (pregunta, dato curioso, contraste, error común, "nadie te dice", reto, opinión), no solo una palabra.
- "caption": 1–2 frases naturales para la descripción del post + entre 3 y 5 hashtags al final, relevantes al tema y a la red. Varía los hashtags entre cuentas.
- Si la cuenta tiene personaje, adapta la voz a ese personaje.
- PROHIBIDO: prometer ingresos o resultados ("gana $X", "dinero fácil", "garantizado", "hazte rico"), cifras de dinero, claims médicos o falsos, decir que algo es oficial si no lo es, y mencionar que es contenido repetido o automatizado.
- Nada ofensivo ni engañoso. No inventes datos concretos que no estén en el tema.

Responde solo con el JSON pedido.`;
}

export interface HooksResult { items: Record<string, HookItem>; missing: string[] }

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Pide los ganchos a Claude por partes, valida y reintenta una vez los que falten.
 * `call(prompt)` devuelve el JSON ya parseado (o lanza). Si todas las llamadas fallan, lanza.
 */
export async function generateHooks(
  slots: HookSlot[],
  opts: HooksOptions,
  avoid: string[],
  call: (prompt: string) => Promise<unknown>
): Promise<HooksResult> {
  const items: Record<string, HookItem> = {};
  const used = [...avoid];
  let anyOk = false;
  let lastErr: unknown = null;

  const round = async (todo: HookSlot[]) => {
    const parts = chunk(todo, SLOTS_POR_LLAMADA);
    const avoidNow = [...used];
    const results = await Promise.allSettled(parts.map((p) => call(buildHooksPrompt(p, opts, avoidNow))));
    results.forEach((r, k) => {
      if (r.status === "rejected") { lastErr = r.reason; return; }
      anyOk = true;
      const v = validateHooks(r.value, parts[k], used);
      for (const [id, it] of Object.entries(v.items)) { items[id] = it; used.push(it.hook); }
    });
  };

  await round(slots);
  const missing1 = slots.filter((s) => !items[s.id]);
  if (missing1.length) await round(missing1);
  if (!anyOk) throw lastErr instanceof Error ? lastErr : new Error("Claude no respondió");
  return { items, missing: slots.filter((s) => !items[s.id]).map((s) => s.id) };
}
