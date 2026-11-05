import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { topeAbort } from "@/app/lib/claude-tope";
import { cobrar } from "@/app/lib/editar-cobro";
import { EDITAR_PRECIOS, MAX_AUDIO_BYTES } from "@/app/lib/editar";

// Transcripción (Groq Whisper) con tiempos por palabra para subtítulos y retomas de /editar.
// El navegador extrae el audio (mono 16 kHz) y lo manda aquí; el video nunca se sube.
export const maxDuration = 300;

interface WhisperWord { word: string; start: number; end: number }
interface WhisperSegment { start: number; end: number; text: string }

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return Response.json({ error: "La transcripción todavía no está activa. Escríbenos por WhatsApp." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "Falta el audio." }, { status: 400 });
  // Vercel corta el body en 4.5 MB; el navegador manda MP3 mono de 24 kbps (≈ 23 minutos).
  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "El video es muy largo para transcribir (máx. unos 20 minutos). Usa uno más corto." }, { status: 413 });
  }

  const cobro = await cobrar(user, EDITAR_PRECIOS.transcripcion, "editar:transcripcion");
  if (cobro instanceof Response) return cobro;

  try {
    const groqForm = new FormData();
    groqForm.append("file", audio, audio.name || "audio.mp3");
    groqForm.append("model", "whisper-large-v3-turbo");
    groqForm.append("response_format", "verbose_json");
    groqForm.append("timestamp_granularities[]", "word");
    groqForm.append("timestamp_granularities[]", "segment");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: groqForm,
      signal: topeAbort(maxDuration), // si Groq se cuelga, el catch alcanza a reembolsar
    });
    if (!res.ok) {
      console.error("[editar/transcribir] groq", res.status, (await res.text().catch(() => "")).slice(0, 300));
      await cobro.refund("transcripción falló");
      return Response.json({ error: "No se pudo transcribir. Te devolvimos los créditos." }, { status: 502 });
    }
    const tr = (await res.json()) as { duration?: number; segments?: WhisperSegment[]; words?: WhisperWord[] };
    const segments = (tr.segments || [])
      .map((s) => ({ start: Math.round(s.start * 10) / 10, end: Math.round(s.end * 10) / 10, text: (s.text || "").trim() }))
      .filter((s) => s.text);
    const words = (tr.words || []).map((w) => ({ word: (w.word || "").trim(), start: w.start, end: w.end })).filter((w) => w.word);
    return Response.json({ words, segments, duration: tr.duration || 0, cost: cobro.amount });
  } catch (e) {
    console.error("[editar/transcribir]", e);
    await cobro.refund("transcripción falló");
    return Response.json({ error: "No se pudo transcribir. Te devolvimos los créditos." }, { status: 500 });
  }
}
