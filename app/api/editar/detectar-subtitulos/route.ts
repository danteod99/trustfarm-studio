import Anthropic from "@anthropic-ai/sdk";
import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { cobrar } from "@/app/lib/editar-cobro";
import { EDITAR_PRECIOS } from "@/app/lib/editar";

// ¿El video ya trae subtítulos quemados? Recibe 1–4 fotogramas (JPEG base64, mitad inferior)
// y responde para no subtitular dos veces. Si la IA no está configurada, se omite sin cobro.
export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ hasSubtitles: false, skipped: true, cost: 0 });

  const { frames } = (await req.json().catch(() => ({}))) as { frames?: unknown[] };
  const imgs = (Array.isArray(frames) ? frames : [])
    .slice(0, 4)
    .filter((f): f is string => typeof f === "string" && f.length > 100 && f.length < 1_400_000);
  if (!imgs.length) return Response.json({ error: "Faltan los fotogramas." }, { status: 400 });

  const cobro = await cobrar(user, EDITAR_PRECIOS.detectarSubs, "editar:detectar-subtitulos");
  if (cobro instanceof Response) return cobro;

  try {
    const anthropic = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 50_000 });
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: [
          ...imgs.map((data) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data } })),
          {
            type: "text" as const,
            text: "Estas imágenes son la mitad inferior de fotogramas de un mismo video. ¿En alguna se ven subtítulos o captions sobreimpresos (texto que transcribe lo que se habla, quemado en la imagen)? Ignora logos, marcas de agua, banners de noticias y texto del entorno (carteles, ropa, pantallas). Responde SOLO con JSON: {\"hasSubtitles\": true} o {\"hasSubtitles\": false}",
          },
        ],
      }],
    });
    const text = resp.content.find((b) => b.type === "text")?.text || "";
    const m = text.match(/\{[^}]*\}/);
    let hasSubtitles = false;
    if (m) { try { hasSubtitles = !!JSON.parse(m[0]).hasSubtitles; } catch { /* false */ } }
    return Response.json({ hasSubtitles, cost: cobro.amount });
  } catch (e) {
    console.error("[editar/detectar-subtitulos]", e);
    await cobro.refund("detección de subtítulos falló");
    return Response.json({ hasSubtitles: false, skipped: true, cost: 0 });
  }
}
