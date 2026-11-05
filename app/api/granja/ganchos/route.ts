import Anthropic from "@anthropic-ai/sdk";
import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { addCredits } from "@/app/lib/credits";
import { cobrar } from "@/app/lib/editar-cobro";
import { GANCHOS_POR_LOTE, hooksCost, normalizeHandle, parseNetwork, type HookSlot } from "@/app/lib/granja";
import { HOOKS_SCHEMA, IDIOMAS, generateHooks, type Idioma } from "@/app/lib/granja-ganchos";

// Modo Granja: un gancho (≤ 8 palabras, va quemado arriba del video) + caption con 3–5 hashtags
// por cada video de cada cuenta. Cobro por lote: 1 crédito cada 20 ganchos (mín. 1); se devuelve
// lo que no se pudo escribir. El navegador llama en lotes de hasta 120 ganchos.
// Hasta 2 intentos de 100 s y 2 rondas: el tope tiene que alcanzar para devolver lo no escrito.
export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const body = (await req.json().catch(() => ({}))) as {
    tema?: unknown; idioma?: unknown; tono?: unknown; slots?: unknown; evitar?: unknown;
  };

  const tema = typeof body.tema === "string" ? body.tema.replace(/[<>]/g, "").trim().slice(0, 600) : "";
  if (tema.length < 3) return Response.json({ error: "Escribe el tema o idea del video." }, { status: 400 });
  const idioma: Idioma = typeof body.idioma === "string" && body.idioma in IDIOMAS ? (body.idioma as Idioma) : "es";
  const tono = typeof body.tono === "string" && body.tono.trim() ? body.tono.trim().slice(0, 40) : "curioso";

  const rawSlots = Array.isArray(body.slots) ? body.slots : [];
  if (!rawSlots.length) return Response.json({ error: "Elige al menos una cuenta." }, { status: 400 });
  if (rawSlots.length > GANCHOS_POR_LOTE) return Response.json({ error: `Máximo ${GANCHOS_POR_LOTE} ganchos por pedido.` }, { status: 400 });
  const ids = new Set<string>();
  const slots: HookSlot[] = [];
  for (const r of rawSlots) {
    const s = (r ?? {}) as Record<string, unknown>;
    const id = typeof s.id === "string" ? s.id.slice(0, 20) : "";
    const handle = normalizeHandle(String(s.handle ?? ""));
    const network = parseNetwork(String(s.network ?? ""));
    if (!id || ids.has(id) || !handle || !network) return Response.json({ error: "Lista de cuentas inválida." }, { status: 400 });
    ids.add(id);
    const personaje = typeof s.personaje === "string" ? s.personaje.replace(/[<>]/g, "").slice(0, 200) : undefined;
    slots.push({ id, handle, network, personaje });
  }
  const evitar = Array.isArray(body.evitar)
    ? body.evitar.filter((h): h is string => typeof h === "string").map((h) => h.slice(0, 80)).slice(-300)
    : [];

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "La IA de ganchos no está activa ahora. Puedes escribirlos tú." }, { status: 503 });

  const cost = hooksCost(slots.length);
  const cobro = await cobrar(user, cost, "granja:ganchos", "granja");
  if (cobro instanceof Response) return cobro;

  const anthropic = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 100_000 });
  const call = async (prompt: string) => {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      output_config: { format: { type: "json_schema", schema: HOOKS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const block = resp.content.find((b) => b.type === "text");
    if (resp.stop_reason === "refusal" || !block) throw new Error("Claude no devolvió ganchos");
    return JSON.parse(block.text) as unknown;
  };

  try {
    const { items, missing } = await generateHooks(slots, { tema, idioma, tono }, evitar, call);
    const ok = slots.length - missing.length;
    let charged = cobro.amount;
    if (!ok) {
      await cobro.refund("ganchos: ninguno válido");
      charged = 0;
    } else if (cobro.amount && hooksCost(ok) < cobro.amount) {
      const back = cobro.amount - hooksCost(ok);
      try {
        await addCredits(user.id, back, "refund", `refund:${cobro.ref}`, { motivo: `ganchos incompletos (${missing.length} sin escribir)` });
        charged = cobro.amount - back;
      } catch (e) {
        console.error("[granja/ganchos] reembolso parcial:", e);
      }
    }
    return Response.json({ items, missing, cost: charged });
  } catch (e) {
    console.error("[granja/ganchos] claude:", e);
    await cobro.refund("ganchos: claude falló");
    return Response.json({ error: "La IA no respondió. No se te cobró: intenta de nuevo." }, { status: 502 });
  }
}
