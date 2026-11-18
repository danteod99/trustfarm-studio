// Perfil de TikTok (/editar/perfil): bajar los videos de un perfil público y, si se pide, componerlos
// dentro de una laptop/TV real (variación «Pantalla real»). Corre en el servicio trustclip como un
// trabajo de `clip_jobs` con options.tipo = "perfil" (ver trustclip/engine/perfil.py).

import { normalizarVariacion, normalizarVersiones, videosPermitidos, type Dispositivo, type EstiloMarco, type Variacion } from "./variacion.ts";

export const PERFIL_MAX_VIDEOS = 10;
const MAX_HANDLE = 48;

/** Usuario de TikTok sin arroba (acepta @usuario o el link del perfil). Solo letras, números, punto y guion bajo; null si no es válido. */
export function limpiarUsuario(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let t = raw.trim();
  const m = t.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([^/?#\s]+)/i);
  if (m) t = m[1];
  t = t.replace(/^@+/, "");
  return t.length > 0 && t.length <= MAX_HANDLE && /^[A-Za-z0-9._]+$/.test(t) ? t : null;
}

export type OrdenPerfil = "recientes" | "virales";
export const PERFIL_MAX_SALTAR = 30;

export const normalizarOrden = (raw: unknown): OrdenPerfil => (raw === "virales" ? "virales" : "recientes");
/** Puestos a saltar (0–30). trustclip: options.saltar. */
export function normalizarSaltar(raw: unknown): number {
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.min(PERFIL_MAX_SALTAR, Math.max(0, n)) : 0;
}

const ord = (n: number) => `${n}.º`;
/** Texto claro de qué se baja: «Los 3 más virales», «Del 2.º al 4.º más viral», «Los 5 más recientes, saltando los 2 primeros». */
export function textoSeleccion(orden: unknown, saltar: unknown, cantidad: number): string {
  const o = normalizarOrden(orden);
  const s = normalizarSaltar(saltar);
  const n = Math.max(1, Math.floor(Number(cantidad)) || 1);
  if (o === "virales") {
    if (s === 0) return n === 1 ? "El más viral" : `Los ${n} más virales`;
    return n === 1 ? `El ${ord(s + 1)} más viral` : `Del ${ord(s + 1)} al ${ord(s + n)} más viral`;
  }
  if (s === 0) return n === 1 ? "El más reciente" : `Los ${n} más recientes`;
  return `${n === 1 ? "1 video" : `${n} videos`} reciente${n === 1 ? "" : "s"}, saltando ${s === 1 ? "el primero" : `los ${s} primeros`}`;
}

/** Detalle de un video ya bajado: «Puesto 2 · 1,2 M vistas» (solo si el trabajo fue por vistas o hay vistas). */
export function textoPuesto(c: { views?: number | null; puesto?: number | null; orden?: string | null }): string | null {
  const v = typeof c.views === "number" ? c.views : null;
  const partes: string[] = [];
  if (c.orden === "virales" && c.puesto) partes.push(`Puesto ${c.puesto} más viral`);
  if (v !== null) partes.push(`${vistasCorto(v)} vistas`);
  return partes.length ? partes.join(" · ") : null;
}

export function vistasCorto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "").replace(".", ",")} M`;
  if (n >= 10_000) return `${Math.round(n / 1000)} mil`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "").replace(".", ",")} mil`;
  return String(n);
}

export type PantallaTipo = "mixto" | Dispositivo;

export interface OpcionesPerfil {
  tipo: "perfil";
  handle: string;
  max_videos: number;
  /** "virales" = por vistas (trustclip rankea los últimos 100). Ausente = más recientes. */
  orden?: OrdenPerfil;
  /** Puestos a saltar antes de bajar (ausente = 0). */
  saltar?: number;
  variacion: Variacion | null;
  pantalla?: Dispositivo;
  /** Solo con variacion = "marco" (trustclip: options.estilo). */
  estilo?: EstiloMarco;
  /** Versiones únicas por video (2–5; ausente = 1). trustclip: options.versiones. */
  versiones?: number;
}

/** Normaliza lo que manda el navegador. null si el usuario no es válido. */
export function opcionesPerfil(body: Record<string, unknown>): OpcionesPerfil | null {
  const handle = limpiarUsuario(body.usuario);
  if (!handle) return null;
  const versiones = normalizarVersiones(body.versiones);
  const max = videosPermitidos(Math.min(PERFIL_MAX_VIDEOS, Math.max(1, Math.round(Number(body.max_videos) || PERFIL_MAX_VIDEOS))), versiones);
  const { variacion, pantalla, estilo } = normalizarVariacion(body);
  const orden = normalizarOrden(body.orden);
  const saltar = normalizarSaltar(body.saltar);
  return { tipo: "perfil", handle, max_videos: max, ...(orden === "virales" ? { orden } : {}), ...(saltar > 0 ? { saltar } : {}), variacion, ...(pantalla ? { pantalla } : {}), ...(estilo ? { estilo } : {}), ...(versiones > 1 ? { versiones } : {}) };
}
