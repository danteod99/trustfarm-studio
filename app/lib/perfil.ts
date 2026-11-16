// Perfil de TikTok (/editar/perfil): bajar los videos de un perfil público y, si se pide, componerlos
// dentro de una laptop/TV real (variación «Pantalla real»). Corre en el servicio trustclip como un
// trabajo de `clip_jobs` con options.tipo = "perfil" (ver trustclip/engine/perfil.py).

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

export type PantallaTipo = "mixto" | "laptop" | "tv";

export interface OpcionesPerfil {
  tipo: "perfil";
  handle: string;
  max_videos: number;
  variacion: "pantalla_real" | null;
  pantalla?: "laptop" | "tv";
}

/** Normaliza lo que manda el navegador. null si el usuario no es válido. */
export function opcionesPerfil(body: Record<string, unknown>): OpcionesPerfil | null {
  const handle = limpiarUsuario(body.usuario);
  if (!handle) return null;
  const max = Math.min(PERFIL_MAX_VIDEOS, Math.max(1, Math.round(Number(body.max_videos) || PERFIL_MAX_VIDEOS)));
  const variacion = body.variacion === "pantalla_real" ? "pantalla_real" : null;
  const pantalla = body.pantalla === "laptop" || body.pantalla === "tv" ? body.pantalla : undefined;
  return { tipo: "perfil", handle, max_videos: max, variacion, ...(variacion && pantalla ? { pantalla } : {}) };
}
