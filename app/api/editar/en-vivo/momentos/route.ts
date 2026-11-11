import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { claudeConTope, topeAbort } from "@/app/lib/claude-tope";
import {
  MOMENTOS_PROMPT, MOMENTOS_SCHEMA, TIPOS_VIVO, VENTANA_S, tipoValido, bloqueDe, filtrarMomentos, sesionValida, textoVentana, type Segmento,
} from "@/app/lib/en-vivo";
import { bloquePagado } from "@/app/lib/en-vivo-cobro";

// Clipeo en vivo: Claude lee los últimos minutos de transcripción y elige los mejores momentos.
// No cobra aparte: va incluido en el bloque de 10 minutos que ya pagó la transcripción.
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "La IA de momentos no está activa." }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as {
    sesion?: unknown; segments?: Segmento[]; hasta?: number; previos?: { inicio: number; fin: number; titulo?: string }[]; exigencia?: number; tipo?: unknown;
  };
  if (!sesionValida(body.sesion)) return Response.json({ error: "Sesión no válida." }, { status: 400 });
  const hasta = Number(body.hasta);
  if (!Number.isFinite(hasta) || hasta <= 0) return Response.json({ momentos: [] });
  const desde = Math.max(0, hasta - VENTANA_S);
  if (!(await bloquePagado(user, body.sesion, bloqueDe(hasta - 1)))) {
    return Response.json({ error: "Este tramo todavía no se transcribió." }, { status: 402 });
  }

  const segs = (Array.isArray(body.segments) ? body.segments : [])
    .filter((s) => s && typeof s.text === "string" && Number.isFinite(s.start) && Number.isFinite(s.end))
    .slice(-400);
  const texto = textoVentana(segs, desde, hasta);
  if (texto.length < 80) return Response.json({ momentos: [] });
  const previos = (Array.isArray(body.previos) ? body.previos : [])
    .filter((p) => p && Number.isFinite(p.inicio) && Number.isFinite(p.fin))
    .slice(-50);
  const listaPrevios = previos.filter((p) => p.fin > desde).map((p) => `[${p.inicio}–${p.fin}] ${String(p.titulo || "").slice(0, 60)}`).join("; ") || "ninguno";
  const exigencia = Math.min(9, Math.max(5, Math.round(Number(body.exigencia) || 7)));

  try {
    const crear = claudeConTope(key, topeAbort(maxDuration, 15_000));
    const resp = await crear({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      output_config: { format: { type: "json_schema", schema: MOMENTOS_SCHEMA } },
      messages: [{ role: "user", content: MOMENTOS_PROMPT.replace("{TRANSCRIPT}", texto).replace("{PREVIOS}", listaPrevios).replace("{TIPO}", TIPOS_VIVO[tipoValido(body.tipo)].pista) }],
    });
    const block = resp.content.find((b) => b.type === "text");
    if (resp.stop_reason === "refusal" || !block) return Response.json({ momentos: [] });
    const crudos = (JSON.parse(block.text) as { momentos?: unknown[] }).momentos;
    const momentos = filtrarMomentos(Array.isArray(crudos) ? crudos : [], { desde, hasta }, previos, exigencia);
    return Response.json({ momentos });
  } catch (e) {
    console.error("[en-vivo/momentos]", e);
    return Response.json({ error: "La IA no respondió en esta ronda; se reintenta en la siguiente.", momentos: [] }, { status: 502 });
  }
}
