// Ideas en base de datos: funciones puras para validar, combinar con el archivo y convertir filas.
// La base es una capa sobre app/lib/ideas.ts: una fila reemplaza a la idea del archivo con su mismo
// id, agrega ideas nuevas u oculta alguna. Sin filas (tabla vacía, sin crear o caída), quedan las del archivo.

import { getModel } from "./catalog.ts";
import { IDEA_CATEGORIES, type Idea, type Variacion } from "./ideas.ts";

export interface FilaIdea {
  id: string;
  category: string;
  title: string;
  hook: string;
  image: string | null;
  video: string | null;
  kind: Idea["kind"];
  model: string;
  aspect: Idea["aspect"];
  duration: number | null;
  resolution: Idea["resolution"] | null;
  motion: string | null;
  prompt: string;
  variaciones: Variacion[];
  fuente: string | null;
  tendencia: boolean;
  oculta: boolean;
  orden: number;
}

/** Idea tal como la ve el panel de admin. */
export type IdeaAdmin = Idea & { oculta: boolean; enBase: boolean; orden: number };

const MOVIMIENTOS = ["acercamiento", "alejamiento", "fija", "orbita", "paneo"];
const MIN_VARIACIONES = 3;
const MAX_VARIACIONES = 5;
const MAX_PROMPT = 2000;

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** Solo rutas del propio sitio (public/showcase): next/image rechaza otros dominios. */
const rutaLocal = (v: string) => /^\/[^/\\]/.test(v);
const largo = (v: string, min: number, max: number) => v.length >= min && v.length <= max;

export function validarIdea(entrada: unknown): { fila: Omit<FilaIdea, "orden" | "oculta"> } | { error: string } {
  if (!entrada || typeof entrada !== "object") return { error: "Datos de la idea inválidos." };
  const e = entrada as Record<string, unknown>;

  const id = texto(e.id);
  if (id.length > 60 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) return { error: "El id solo admite minúsculas, números y guiones (máx. 60)." };
  const category = texto(e.category);
  if (!(IDEA_CATEGORIES as readonly string[]).includes(category)) return { error: "Elige una categoría de la lista." };
  const title = texto(e.title);
  if (!largo(title, 3, 80)) return { error: "El título debe tener de 3 a 80 caracteres." };
  const hook = texto(e.hook);
  if (!largo(hook, 3, 200)) return { error: "El gancho debe tener de 3 a 200 caracteres." };
  const prompt = texto(e.prompt);
  if (!largo(prompt, 10, MAX_PROMPT)) return { error: `El prompt debe tener de 10 a ${MAX_PROMPT} caracteres.` };

  const modelo = getModel(texto(e.model));
  if (!modelo) return { error: "Ese modelo no existe." };
  if (e.kind !== modelo.kind) return { error: `Ese modelo genera ${modelo.kind === "video" ? "video" : "imagen"}.` };
  const aspect = e.aspect as Idea["aspect"];
  if (!modelo.aspects.includes(aspect)) return { error: "Ese modelo no tiene ese formato." };

  let duration: number | null = null;
  let resolution: Idea["resolution"] | null = null;
  let motion: string | null = null;
  if (modelo.kind === "video") {
    duration = Number(e.duration);
    if (!modelo.durations?.includes(duration)) return { error: "Ese modelo no tiene esa duración." };
    resolution = e.resolution as Idea["resolution"];
    if (!resolution || !modelo.resolutions?.includes(resolution)) return { error: "Ese modelo no tiene esa resolución." };
    const m = texto(e.motion);
    if (m && !MOVIMIENTOS.includes(m)) return { error: "Ese movimiento no existe." };
    motion = m || null;
  }

  const image = texto(e.image);
  const video = texto(e.video);
  if ((image && !rutaLocal(image)) || (video && !rutaLocal(video))) return { error: "Imagen y video deben ser rutas del sitio, como /showcase/ejemplo.jpg." };

  const crudas = e.variaciones ?? [];
  if (!Array.isArray(crudas)) return { error: "Variaciones inválidas." };
  if (crudas.length && (crudas.length < MIN_VARIACIONES || crudas.length > MAX_VARIACIONES)) {
    return { error: `Pon de ${MIN_VARIACIONES} a ${MAX_VARIACIONES} variaciones, o ninguna.` };
  }
  const variaciones: Variacion[] = [];
  for (const c of crudas) {
    const v = (c ?? {}) as Record<string, unknown>;
    const t = texto(v.titulo);
    const p = texto(v.prompt);
    if (!largo(t, 1, 60) || !largo(p, 10, MAX_PROMPT)) return { error: "Cada variación necesita título y un prompt de al menos 10 caracteres." };
    variaciones.push({ titulo: t, prompt: p });
  }

  const fuente = texto(e.fuente);
  if (fuente.length > 300) return { error: "La fuente admite hasta 300 caracteres." };

  return {
    fila: {
      id, category, title, hook, prompt, kind: modelo.kind, model: modelo.id, aspect, duration, resolution, motion,
      image: image || null, video: video || null, variaciones, fuente: fuente || null, tendencia: e.tendencia === true,
    },
  };
}

export function ideaAFila(i: Idea, orden: number, oculta = false): FilaIdea {
  return {
    id: i.id, category: i.category, title: i.title, hook: i.hook, image: i.image ?? null, video: i.video ?? null,
    kind: i.kind, model: i.model, aspect: i.aspect, duration: i.duration ?? null, resolution: i.resolution ?? null,
    motion: i.motion ?? null, prompt: i.prompt, variaciones: i.variaciones ?? [], fuente: i.fuente ?? null,
    tendencia: i.tendencia ?? false, oculta, orden,
  };
}

function filaAIdea(f: FilaIdea): Idea {
  return {
    id: f.id, category: f.category, title: f.title, hook: f.hook, kind: f.kind, model: f.model, aspect: f.aspect, prompt: f.prompt,
    ...(f.image ? { image: f.image } : {}),
    ...(f.video ? { video: f.video } : {}),
    ...(f.duration ? { duration: f.duration } : {}),
    ...(f.resolution ? { resolution: f.resolution } : {}),
    ...(f.motion ? { motion: f.motion } : {}),
    ...(f.variaciones?.length ? { variaciones: f.variaciones } : {}),
    ...(f.fuente ? { fuente: f.fuente } : {}),
    ...(f.tendencia ? { tendencia: true } : {}),
  };
}

/** La fuente es interna (de qué tendencia salió la idea): no se manda al navegador del cliente. */
export function ideaPublica(i: Idea): Idea {
  const { fuente: _fuente, ...resto } = i;
  return resto;
}

export function combinarIdeas(archivo: Idea[], filas: FilaIdea[]): { publicas: Idea[]; todas: IdeaAdmin[] } {
  const enBase = new Map(filas.map((f) => [f.id, f]));
  const todas: IdeaAdmin[] = filas.map((f) => ({ ...filaAIdea(f), oculta: f.oculta, enBase: true, orden: f.orden }));
  archivo.forEach((i, k) => {
    if (!enBase.has(i.id)) todas.push({ ...i, oculta: false, enBase: false, orden: k + 1 });
  });
  todas.sort((a, b) => Number(!!b.tendencia) - Number(!!a.tendencia) || a.orden - b.orden);
  const publicas = todas.filter((i) => !i.oculta).map(({ oculta: _o, enBase: _e, orden: _n, ...i }) => ideaPublica(i));
  return { publicas, todas };
}

/** /estudio?idea=<id>&v=<n>: el prompt de esa variación, o el principal si no existe. */
export function promptDeVariacion(idea: Idea, v: string | null): string {
  if (!v || !/^\d+$/.test(v)) return idea.prompt;
  return idea.variaciones?.[Number(v)]?.prompt ?? idea.prompt;
}

/** Formulario de admin: una variación por línea, "título | prompt". */
export function parseVariaciones(textoLineas: string): Variacion[] {
  return textoLineas.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const k = l.indexOf("|");
    return k < 0 ? { titulo: "", prompt: l } : { titulo: l.slice(0, k).trim(), prompt: l.slice(k + 1).trim() };
  });
}

export function variacionesATexto(v: Variacion[] = []): string {
  return v.map((x) => `${x.titulo} | ${x.prompt}`).join("\n");
}
