import Anthropic from "@anthropic-ai/sdk";

// Vercel mata la función al llegar a maxDuration y ahí el reembolso ya no corre. Por eso cada ruta
// que cobra antes de llamar a una IA corta todas sus llamadas con un solo tope, con margen de sobra
// para devolver los créditos: sumar timeouts por llamada no alcanza (reintentos, varias rondas).
const MARGEN_REEMBOLSO_MS = 30_000;

export function topeAbort(maxDurationSeg: number, margenMs = MARGEN_REEMBOLSO_MS): AbortSignal {
  return AbortSignal.timeout(maxDurationSeg * 1000 - margenMs);
}

/** messages.create de Claude (2 intentos de hasta 100 s) que además respeta el tope de la ruta. */
export function claudeConTope(apiKey: string, tope: AbortSignal) {
  const anthropic = new Anthropic({ apiKey, maxRetries: 1, timeout: 100_000 });
  return (params: Anthropic.MessageCreateParamsNonStreaming) => anthropic.messages.create(params, { signal: tope });
}
