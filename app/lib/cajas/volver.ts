// A dónde vuelve la ventana de Google de la mini PC. Solo a la propia máquina: el pase no puede salir hacia otro sitio.
// Sin dependencias de servidor: también lo usa la página.

const VOLVER = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/;
const SELLO = /^[A-Za-z0-9_-]{20,100}$/;

export const volverValido = (v: unknown): v is string => typeof v === "string" && VOLVER.test(v);
export const selloValido = (s: unknown): s is string => typeof s === "string" && SELLO.test(s);

export function urlCancelar(volver: unknown, sello: string): string | null {
  return volverValido(volver) ? `${volver}/conectado?cancelado=1&sello=${encodeURIComponent(sello)}` : null;
}
