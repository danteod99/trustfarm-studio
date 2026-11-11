import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { topeAbort } from "@/app/lib/claude-tope";
import { bloqueDe, desplazar, sesionValida } from "@/app/lib/en-vivo";
import { cobrarBloque } from "@/app/lib/en-vivo-cobro";

// Clipeo en vivo: transcribe un trozo de ~30 s de audio de la transmisión (Groq Whisper) y devuelve
// los segmentos ya pasados al tiempo de la transmisión. Cobra por bloque de 10 minutos.
export const maxDuration = 60;

const MAX_TROZO = 1_500_000;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return Response.json({ error: "La transcripción todavía no está activa. Escríbenos por WhatsApp." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const sesion = form?.get("sesion");
  const t0 = Number(form?.get("t0"));
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "Falta el audio." }, { status: 400 });
  if (audio.size > MAX_TROZO) return Response.json({ error: "Trozo de audio demasiado grande." }, { status: 413 });
  if (!sesionValida(sesion) || !Number.isFinite(t0) || t0 < 0) return Response.json({ error: "Sesión no válida." }, { status: 400 });

  const cobro = await cobrarBloque(user, sesion, bloqueDe(t0));
  if (!cobro.ok) return cobro.res;

  try {
    const groqForm = new FormData();
    groqForm.append("file", audio, audio.name || "audio.webm");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("response_format", "verbose_json");
    groqForm.append("timestamp_granularities[]", "segment");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
      signal: topeAbort(maxDuration, 10_000),
    });
    if (!res.ok) {
      console.error("[en-vivo/transcribir] groq", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return Response.json({ error: "No se pudo transcribir este tramo.", segments: [], cost: cobro.cobrado }, { status: 502 });
    }
    const tr = (await res.json()) as { segments?: { start: number; end: number; text: string; no_speech_prob?: number }[] };
    // Whisper inventa frases en silencio o música ("Gracias por ver"): se descartan los de no_speech alto.
    const segs = (tr.segments || []).filter((s) => (s.no_speech_prob ?? 0) < 0.6);
    return Response.json({ segments: desplazar(segs, t0), cost: cobro.cobrado });
  } catch (e) {
    console.error("[en-vivo/transcribir]", e);
    return Response.json({ error: "No se pudo transcribir este tramo.", segments: [], cost: cobro.cobrado }, { status: 500 });
  }
}
