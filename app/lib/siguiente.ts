// A dónde ir después de iniciar sesión: solo dentro del propio sitio. Comprobar que empiece con "/" no basta:
// el navegador lee "/\evil.com" o "/<tab>/evil.com" como otro sitio. Sin dependencias: también lo usa la página.

const BASE = "https://sitio.invalid";

export function siguienteSeguro(next: unknown, defecto = "/estudio"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return defecto;
  try {
    const u = new URL(next, BASE);
    return u.origin === BASE ? u.pathname + u.search + u.hash : defecto;
  } catch {
    return defecto;
  }
}
