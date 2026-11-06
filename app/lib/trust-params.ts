// "Parámetros Trust": descripción común de una toma (estilo, personaje, cámara, luz, audio,
// aspecto, duración, negativos) que se traduce al prompt según el modelo elegido.
//  - Video con audio (cine-lite, cine, cine-voz): prompt estructurado por secciones, con
//    diálogo entre comillas y referencias al personaje/imagen adjunta. No tienen negative
//    prompt nativo: los negativos se escriben dentro del prompt ("Evitar: ...").
//  - Video sin audio (clip, clip-pro) e imagen económica: palabras clave separadas por comas.
//  - Imagen de alta calidad: frase natural + negativos en lenguaje llano.
// Los campos pueden llevar [corchetes] para que el usuario los complete; el estudio no deja
// generar hasta que no quede ninguno (ver pendingFields en templates.ts).
import { getModel, type Aspect } from "@/app/lib/catalog";

export interface TrustParams {
  estilo?: string;
  personaje?: string;
  /** Qué ocurre en la toma (acción, lugar). */
  escena?: string;
  camara?: string;
  luz?: string;
  audio?: { dialogo?: string; ambiente?: string; musica?: string };
  aspecto?: Aspect;
  /** Segundos (solo video). */
  duracion?: number;
  negativos?: string[];
  /** ¿Hay imagen de referencia (personaje o primer cuadro) adjunta? */
  conReferencia?: boolean;
}

/** Negativos comunes a todas las plantillas nuevas. */
export const NEGATIVOS_BASE = ["subtítulos", "texto en pantalla", "marcas de agua", "logos", "manos deformes"];

type Familia = "video-audio" | "video-clip" | "imagen-pro" | "imagen-clave";

function familia(modelId: string): Familia {
  const m = getModel(modelId);
  if (!m) return "imagen-clave";
  if (m.kind === "video") return m.acceptsImage && ["veo-lite", "veo-fast", "ltx-25"].includes(m.id) ? "video-audio" : "video-clip";
  return ["nano-banana-2", "nano-banana-pro"].includes(m.id) ? "imagen-pro" : "imagen-clave";
}

const limpia = (xs: (string | undefined)[]) => xs.filter((x): x is string => !!x && x.trim() !== "");

/** Traduce los parámetros Trust al prompt que entiende el modelo indicado (id interno). */
export function trustPrompt(p: TrustParams, modelId: string): string {
  const fam = familia(modelId);
  const neg = limpia(p.negativos ?? []);
  const a = p.audio;

  if (fam === "video-audio") {
    const partes = limpia([
      p.estilo && `Estilo: ${p.estilo}.`,
      p.personaje && `Personaje${p.conReferencia ? " (igual que la imagen de referencia)" : ""}: ${p.personaje}.`,
      p.escena && `Escena: ${p.escena}.`,
      p.camara && `Cámara: ${p.camara}.`,
      p.luz && `Luz: ${p.luz}.`,
      a?.dialogo && `Diálogo: ${a.dialogo}`,
      a?.ambiente && `Sonido ambiente: ${a.ambiente}.`,
      a?.musica && `Música: ${a.musica}.`,
      p.duracion ? `Duración: ${p.duracion} segundos, un solo plano continuo.` : undefined,
      neg.length ? `Evitar: ${neg.join(", ")}.` : undefined,
    ]);
    return partes.join(" ");
  }

  if (fam === "imagen-pro") {
    const base = limpia([
      p.estilo && `${p.estilo}.`,
      p.personaje && `${p.personaje}.`,
      p.escena && `${p.escena}.`,
      p.camara && `Plano: ${p.camara}.`,
      p.luz && `Luz: ${p.luz}.`,
    ]).join(" ");
    return neg.length ? `${base} Sin ${neg.join(", sin ")}.` : base;
  }

  // Palabras clave (clips sin audio y modelos de imagen económicos)
  const claves = limpia([p.escena, p.personaje, p.estilo, p.camara, p.luz, ...(a?.ambiente ? [a.ambiente] : [])]);
  const base = claves.length ? claves.join(", ") + "." : "";
  if (!neg.length) return base;
  return base ? `${base} Sin ${neg.join(", sin ")}.` : `Sin ${neg.join(", sin ")}.`;
}
