import Anthropic from "@anthropic-ai/sdk";
import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { cobrar } from "@/app/lib/editar-cobro";
import { EDITAR_PRECIOS } from "@/app/lib/editar";

// Retomas y falsos comienzos del editor de cortos (portado de TrustMind):
//   1) detector determinista de repeticiones inmediatas (gratis, siempre)
//   2) Claude sobre la transcripción numerada (retomas más separadas, falsos comienzos,
//      autocorrecciones) + condensado opcional de ideas redundantes.
// Devuelve rangos de TIEMPO a eliminar; el navegador corta con ffmpeg.wasm.
// Retomas + condensado, cada uno con hasta 2 intentos de 100 s: el reembolso tiene que alcanzar a correr.
export const maxDuration = 300;

interface Word { word: string; start: number; end: number }
interface IdxCut { desde: number; hasta: number; motivo?: string }

const norm = (w: string) =>
  w.toLowerCase().replace(/[.,;:!¡¿?"'…—-]/g, "").trim();

// Repeticiones inmediatas: words[i..i+n) == words[i+n..i+2n) → corta el 1º bloque.
function detectImmediateRepeats(words: Word[], maxN = 8, minN = 2): IdxCut[] {
  const toks = words.map((w) => norm(w.word));
  const cuts: IdxCut[] = [];
  let i = 0;
  while (i < words.length) {
    let best = 0;
    for (let n = maxN; n >= minN; n--) {
      if (i + 2 * n > words.length) continue;
      const a = toks.slice(i, i + n);
      const b = toks.slice(i + n, i + 2 * n);
      if (a.every(Boolean) && a.join("") === b.join("")) { best = n; break; }
    }
    if (best) {
      cuts.push({ desde: i, hasta: i + best - 1, motivo: `repetición inmediata de ${best} palabra(s)` });
      i += best;
    } else i++;
  }
  return cuts;
}

const RETAKE_SCHEMA = {
  type: "object" as const,
  properties: {
    cortes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          desde: { type: "integer" as const, description: "índice de la primera palabra a quitar" },
          hasta: { type: "integer" as const, description: "índice de la última palabra a quitar (inclusive)" },
          motivo: { type: "string" as const },
        },
        required: ["desde", "hasta", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["cortes"],
  additionalProperties: false,
};

async function claudeCuts(words: Word[], prompt: string, anthropic: Anthropic): Promise<IdxCut[]> {
  const numbered = words.map((w, i) => `[${i}]${w.word}`).join(" ");
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: RETAKE_SCHEMA } },
    messages: [{ role: "user", content: prompt.replace("{TRANSCRIPT}", numbered) }],
  });
  const block = resp.content.find((b) => b.type === "text");
  if (resp.stop_reason === "refusal" || !block) throw new Error(`retomas sin respuesta (${resp.stop_reason})`);
  const cortes = JSON.parse(block.text).cortes;
  if (!Array.isArray(cortes)) throw new Error("retomas: JSON sin cortes");
  return cortes as IdxCut[];
}

const RETAKE_PROMPT = `Eres editor de video. Transcripción de un video donde una persona habla SIN GUION: se traba, repite frases, hace falsos comienzos. Cada palabra con su ÍNDICE:

<transcripcion>
{TRANSCRIPT}
</transcripcion>

Marca los tramos de palabras a ELIMINAR para que quede una toma LIMPIA:
- RETOMAS: repite la misma idea porque se trabó → deja SOLO la ÚLTIMA versión, elimina las anteriores.
- FALSOS COMIENZOS: arranca una frase, se corta y la reformula.
- AUTOCORRECCIONES y muletillas de arranque ("eh", "espera", "no, mejor así").
- TARTAMUDEOS / palabras repetidas pegadas.
NO elimines contenido que solo se dice una vez ni la última versión buena. Cada corte = rango de índices [desde,hasta] inclusive, sin solaparse.`;

const CONDENSE_PROMPT = `Eres editor de contenido de videos cortos virales. Transcripción con ÍNDICES por palabra:

<transcripcion>
{TRANSCRIPT}
</transcripcion>

Los tartamudeos/retomas YA se quitan en otro proceso, NO los marques. Trabaja a nivel de IDEAS:
elimina tramos donde se REPITE un punto ya explicado antes con otras palabras, se DIVAGA/tangente,
o se SOBRE-EXPLICA. Cada corte = varias palabras (frase/idea completa). CONSERVA el gancho inicial,
el CTA final, la lógica y los datos concretos. Sé conservador: si no hay redundancia clara, cortes vacío.`;

function indicesToTime(cuts: IdxCut[], words: Word[]) {
  const n = words.length;
  const ranges: { start: number; end: number; motivo: string }[] = [];
  for (const c of cuts) {
    let a = Math.max(0, Math.min(Math.round(c.desde), n - 1));
    let b = Math.max(0, Math.min(Math.round(c.hasta), n - 1));
    if (b < a) [a, b] = [b, a];
    ranges.push({
      start: words[a].start,
      end: b + 1 < n ? words[b + 1].start : words[b].end,
      motivo: c.motivo || "",
    });
  }
  return ranges;
}

function mergeRanges(ranges: { start: number; end: number }[]) {
  const clean = ranges.filter((r) => r.end - r.start > 0.1).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of clean) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 0.08) last.end = Math.max(last.end, r.end);
    else merged.push({ start: r.start, end: r.end });
  }
  return merged;
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const body = (await req.json().catch(() => ({}))) as { words?: Word[]; condense?: boolean };
  const words = Array.isArray(body.words)
    ? body.words.filter((w) => w && typeof w.word === "string" && Number.isFinite(w.start) && Number.isFinite(w.end)).slice(0, 12000)
    : [];
  if (words.length < 4) return Response.json({ cuts: [], removed: 0, cost: 0 });

  const basicos = detectImmediateRepeats(words);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // Sin IA configurada: solo cortes básicos y sin cobro.
    const cuts = mergeRanges(indicesToTime(basicos, words));
    return Response.json({ cuts, removed: cuts.reduce((a, c) => a + (c.end - c.start), 0), cost: 0, warning: "La IA de retomas no está activa: se usaron cortes básicos (sin cobro)." });
  }

  const cobro = await cobrar(user, EDITAR_PRECIOS.retomas, "editar:retomas");
  if (cobro instanceof Response) return cobro;

  const anthropic = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 100_000 });
  let idx: IdxCut[] = basicos;
  let warning: string | null = null;
  let cost = cobro.amount;
  try {
    idx = idx.concat(await claudeCuts(words, RETAKE_PROMPT, anthropic));
    if (body.condense) {
      try { idx = idx.concat(await claudeCuts(words, CONDENSE_PROMPT, anthropic)); } catch { /* opcional */ }
    }
  } catch (e) {
    console.error("[editar/retomas] claude", e);
    await cobro.refund("retomas con IA fallaron");
    cost = 0;
    warning = "La IA de retomas no respondió: se usaron cortes básicos y te devolvimos los créditos.";
  }
  const cuts = mergeRanges(indicesToTime(idx, words));
  return Response.json({ cuts, removed: cuts.reduce((a, c) => a + (c.end - c.start), 0), cost, warning });
}
