// Clipeo en vivo (/editar/en-vivo): lógica pura compartida por el navegador, las rutas y las pruebas.
// El navegador graba la pestaña de la transmisión en segmentos cortos, manda el audio cada
// AUDIO_SEG_S a transcribir (Whisper) y cada MOMENTOS_CADA_S le pide a Claude los mejores momentos
// de los últimos VENTANA_S. Los clips se arman en el navegador juntando segmentos de video.

/** Duración de cada segmento de video grabado (cada uno empieza con un fotograma clave). */
export const VIDEO_SEG_S = 5;
/** Duración de cada trozo de audio que se manda a transcribir. */
export const AUDIO_SEG_S = 15;
/** Cada cuánto se buscan momentos nuevos. */
export const MOMENTOS_CADA_S = 60;
/** Cuánta transcripción reciente se le pasa a Claude. */
export const VENTANA_S = 300;
/** Cuánto video se guarda en memoria para poder cortar clips. */
export const BUFFER_S = 20 * 60;
/** Bloque cobrado: cada BLOQUE_S de transmisión cuesta EN_VIVO_CREDITOS. */
export const BLOQUE_S = 600;
export const EN_VIVO_CREDITOS = 2;
export const CLIP_MIN_S = 15;
export const CLIP_MAX_S = 90;

export interface Segmento { start: number; end: number; text: string }
export interface Momento {
  inicio: number; fin: number; titulo: string; gancho: string; puntaje: number; motivo: string;
}

/** Bloque de cobro al que pertenece el segundo `t` de la transmisión. */
export function bloqueDe(t: number): number {
  return Math.max(0, Math.floor((Number.isFinite(t) ? t : 0) / BLOQUE_S));
}

/** Referencia única del cobro de un bloque (ai_ledger.ref es único → nunca se cobra dos veces). */
export function refBloque(userId: string, sesion: string, bloque: number): string {
  return `vivo:${userId}:${sesion}:${bloque}`;
}

const SESION_RE = /^[a-z0-9-]{8,64}$/i;
export function sesionValida(s: unknown): s is string {
  return typeof s === "string" && SESION_RE.test(s);
}

/** mm:ss (o h:mm:ss) de un segundo de la transmisión. */
export function reloj(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Pasa los segmentos de Whisper (relativos al trozo) al tiempo de la transmisión. */
export function desplazar(segs: Segmento[], offset: number): Segmento[] {
  return segs
    .map((s) => ({ start: round1(s.start + offset), end: round1(s.end + offset), text: (s.text || "").trim() }))
    .filter((s) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Transcripción de [desde, hasta] con marcas de tiempo, lista para el prompt. */
export function textoVentana(segs: Segmento[], desde: number, hasta: number): string {
  return segs
    .filter((s) => s.end > desde && s.start < hasta)
    .map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`)
    .join("\n");
}

// Frases que Whisper inventa en silencio, música o ruido.
const ALUCINACIONES = [
  /^(thank you|thanks for watching|you)[.!]?$/i,
  /gracias por (ver|mirar)/i,
  /suscr[ií]bete|dale like|activa la campanita/i,
  /subt[ií]tulos? (realizados|hechos|por)/i,
  /amara\.org/i,
  /^\W*$/,
];
export function esAlucinacion(texto: string): boolean {
  const t = texto.trim();
  return ALUCINACIONES.some((r) => r.test(t));
}

/** Picos de volumen dentro de [desde, hasta], como texto para el prompt. */
export function textoPicos(picos: number[], desde: number, hasta: number): string {
  const p = picos.filter((t) => t >= desde && t <= hasta).map((t) => t.toFixed(1));
  return p.length ? p.join(", ") : "ninguno";
}

/**
 * Detector de picos de volumen (risas, gritos, aplausos): compara el volumen de los últimos
 * ~0,5 s con el promedio lento de la transmisión. Se alimenta con un valor RMS cada ~100 ms.
 */
export class DetectorPicos {
  private base = 0;
  private corto = 0;
  private sobre = 0;
  private ultimo = -Infinity;
  readonly picos: number[] = [];
  private readonly factor: number;
  private readonly minSostenido: number;
  private readonly separacion: number;
  constructor(factor = 2.2, minSostenido = 4, separacion = 8) {
    this.factor = factor;
    this.minSostenido = minSostenido;
    this.separacion = separacion;
  }
  /** Devuelve true si en `t` empieza un pico nuevo. */
  medir(t: number, rms: number): boolean {
    if (!Number.isFinite(rms)) return false;
    this.base = this.base === 0 ? rms : this.base * 0.995 + rms * 0.005;
    this.corto = this.corto * 0.6 + rms * 0.4;
    const alto = this.base > 0.004 && this.corto > this.base * this.factor && this.corto > 0.03;
    this.sobre = alto ? this.sobre + 1 : 0;
    if (this.sobre === this.minSostenido && t - this.ultimo >= this.separacion) {
      this.ultimo = t;
      this.picos.push(Math.round(t * 10) / 10);
      return true;
    }
    return false;
  }
}

/** Fracción del momento `a` que se solapa con `b`. */
export function solape(a: { inicio: number; fin: number }, b: { inicio: number; fin: number }): number {
  const inter = Math.min(a.fin, b.fin) - Math.max(a.inicio, b.inicio);
  const dur = Math.min(a.fin - a.inicio, b.fin - b.inicio);
  return inter > 0 && dur > 0 ? inter / dur : 0;
}

/**
 * Valida lo que devolvió la IA: tiempos dentro de la ventana, duración entre CLIP_MIN_S y
 * CLIP_MAX_S (recorta o descarta), puntaje mínimo y sin repetir momentos ya clipeados.
 */
export function filtrarMomentos(
  crudos: unknown[],
  ventana: { desde: number; hasta: number },
  previos: { inicio: number; fin: number }[],
  puntajeMin = 6,
): Momento[] {
  const out: Momento[] = [];
  for (const c of crudos) {
    if (!c || typeof c !== "object") continue;
    const r = c as Record<string, unknown>;
    let inicio = Number(r.inicio);
    let fin = Number(r.fin);
    const puntaje = Math.round(Number(r.puntaje));
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || !Number.isFinite(puntaje)) continue;
    if (puntaje < puntajeMin) continue;
    if (fin < inicio) [inicio, fin] = [fin, inicio];
    inicio = Math.max(ventana.desde, inicio);
    fin = Math.min(ventana.hasta, fin);
    if (fin - inicio > CLIP_MAX_S) fin = inicio + CLIP_MAX_S;
    if (fin - inicio < CLIP_MIN_S) continue;
    const m: Momento = {
      inicio: round1(inicio), fin: round1(fin),
      titulo: String(r.titulo || "Momento").slice(0, 80),
      gancho: String(r.gancho || "").slice(0, 120),
      puntaje: Math.min(10, puntaje),
      motivo: String(r.motivo || "").slice(0, 200),
    };
    if ([...previos, ...out].some((p) => solape(m, p) > 0.4)) continue;
    out.push(m);
  }
  return out.sort((a, b) => a.inicio - b.inicio);
}

/** Índices de los segmentos de video (de VIDEO_SEG_S c/u, guardados con su inicio) que cubren [inicio, fin]. */
export function segmentosPara<T extends { t0: number; t1: number }>(segs: T[], inicio: number, fin: number): T[] {
  return segs.filter((s) => s.t1 > inicio && s.t0 < fin).sort((a, b) => a.t0 - b.t0);
}

/** Nombre de archivo seguro para un clip. */
export function nombreClip(n: number, titulo: string, ext: string): string {
  const base = titulo
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 40) || "clip";
  return `${String(n).padStart(2, "0")}-${base}.${ext}`;
}

export type TipoVivo = "podcast" | "stream" | "otro";
export const TIPOS_VIVO: Record<TipoVivo, { label: string; pista: string }> = {
  podcast: {
    label: "Podcast / entrevista",
    pista: "Es un PODCAST o entrevista: busca opiniones fuertes, anécdotas con remate, datos sorprendentes, consejos accionables, desacuerdos entre los invitados y frases citables. Que el clip incluya la pregunta si hace falta para entender la respuesta.",
  },
  stream: {
    label: "Stream / gameplay",
    pista: "Es un STREAM (gameplay, IRL, reacción): busca reacciones fuertes, gritos, risas, jugadas épicas o fallas graciosas, momentos con el chat y frases de impacto.",
  },
  otro: { label: "Otro (clase, noticia, evento)", pista: "Busca las ideas más claras y llamativas que se entiendan solas." },
};

export function tipoValido(t: unknown): TipoVivo {
  return t === "stream" || t === "otro" ? t : "podcast";
}

export type Plataforma = "youtube" | "twitch" | "kick";
export interface Embed { plataforma: Plataforma; src: string }

/**
 * Convierte el link de la transmisión en la URL del reproductor embebido.
 * `host` es el dominio de la página (Twitch exige `parent`). null si no se puede embeber.
 */
export function embedDeLink(link: string, host: string): Embed | null {
  let u: URL;
  try { u = new URL(link.trim()); } catch { return null; }
  const h = u.hostname.replace(/^(www|m)\./, "");
  if (h === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return ytId(id) ? { plataforma: "youtube", src: yt(id) } : null;
  }
  if (h === "youtube.com" || h === "music.youtube.com") {
    const parts = u.pathname.split("/").filter(Boolean);
    let id = u.searchParams.get("v") || "";
    if (!id && ["live", "embed", "shorts"].includes(parts[0])) id = parts[1] || "";
    if (ytId(id)) return { plataforma: "youtube", src: yt(id) };
    // youtube.com/@canal/live o /channel/UC…/live → en vivo del canal
    if (parts[0] === "channel" && /^UC[\w-]{22}$/.test(parts[1] || "")) {
      return { plataforma: "youtube", src: `https://www.youtube.com/embed/live_stream?channel=${parts[1]}&autoplay=1` };
    }
    return null;
  }
  if (h === "twitch.tv") {
    const canal = u.pathname.split("/").filter(Boolean)[0] || "";
    if (!/^\w{3,25}$/.test(canal)) return null;
    return { plataforma: "twitch", src: `https://player.twitch.tv/?channel=${canal}&parent=${encodeURIComponent(host)}&autoplay=true&muted=false` };
  }
  if (h === "kick.com") {
    const canal = u.pathname.split("/").filter(Boolean)[0] || "";
    if (!/^[\w-]{2,30}$/.test(canal)) return null;
    return { plataforma: "kick", src: `https://player.kick.com/${canal}?autoplay=true&muted=false` };
  }
  return null;
}
const ytId = (id: string) => /^[\w-]{11}$/.test(id);
const yt = (id: string) => `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1`;

export const MOMENTOS_PROMPT = `Eres editor de clips virales. Estás viendo una TRANSMISIÓN EN VIVO y te paso la transcripción de los últimos minutos con tiempos en segundos [inicio–fin]:

<transcripcion>
{TRANSCRIPT}
</transcripcion>

Picos de volumen detectados en el audio (posibles RISAS, gritos, aplausos o reacciones), en segundos: {PICOS}

Momentos ya clipeados (no los repitas): {PREVIOS}

{TIPO}

Elige los MEJORES MOMENTOS para clips cortos de TikTok/Reels/Shorts. PRIORIDAD 1: lo DIVERTIDO (chistes, risas, reacciones exageradas, momentos absurdos o incómodos, bromas entre ellos); si hay un pico de volumen, revisa qué se dijo justo antes: suele ser el remate de un chiste o una reacción, y ese momento vale clipearlo. También sirven frases de impacto, revelaciones, consejos concretos, polémica e historias con remate. Cada momento debe:
- durar entre ${CLIP_MIN_S} y ${CLIP_MAX_S} segundos y entenderse solo (empieza al inicio de una idea, termina cuando se cierra),
- NO terminar en los últimos 10 segundos de la transcripción si la idea parece seguir (se clipea en la siguiente ronda).
Puntaje 1–10 de qué tan bueno es para un clip: 8–10 muy divertido o impactante, 6–7 interesante o gracioso, 1–5 relleno. Título corto en español, gancho = frase para poner arriba del clip. Si no hay nada bueno, devuelve la lista vacía.`;

export const MOMENTOS_SCHEMA = {
  type: "object" as const,
  properties: {
    momentos: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          inicio: { type: "number" as const, description: "segundo de inicio" },
          fin: { type: "number" as const, description: "segundo de fin" },
          titulo: { type: "string" as const },
          gancho: { type: "string" as const },
          puntaje: { type: "integer" as const },
          motivo: { type: "string" as const },
        },
        required: ["inicio", "fin", "titulo", "gancho", "puntaje", "motivo"],
        additionalProperties: false,
      },
    },
  },
  required: ["momentos"],
  additionalProperties: false,
};
