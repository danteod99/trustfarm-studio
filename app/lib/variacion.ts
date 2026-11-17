// Variaciones de video de Perfil de TikTok / bucles: «Pantalla real» (laptop/TV) y «Marco o fondo» (solo ffmpeg).
// Lista blanca compartida por la API, los bucles y la interfaz. Sin dependencias: se prueba con node --test.

export type Variacion = "pantalla_real" | "marco";
export type EstiloMarco = "blur" | "color" | "marco" | "mixto";

export type Dispositivo = "laptop" | "tv" | "movil" | "tablet" | "monitor";
/** Lista blanca de options.pantalla (trustclip: DISPOSITIVOS). Sin valor = cualquier dispositivo («mixto»). */
export const DISPOSITIVOS: readonly Dispositivo[] = ["laptop", "tv", "movil", "tablet", "monitor"];
/** Dispositivos que no existían cuando se creó tool_loops (08): para crear un bucle con ellos hace falta supabase/09. */
export const DISPOSITIVOS_NUEVOS: readonly Dispositivo[] = ["movil", "tablet", "monitor"];
export const DISPOSITIVO_TEXTO: Record<Dispositivo, string> = { laptop: "laptop", tv: "TV", movil: "celular", tablet: "tablet", monitor: "monitor" };
export const esDispositivo = (v: unknown): v is Dispositivo => typeof v === "string" && (DISPOSITIVOS as readonly string[]).includes(v);

export const ESTILOS_MARCO: readonly EstiloMarco[] = ["blur", "color", "marco", "mixto"];

export const ESTILOS_MARCO_TEXTO: Record<EstiloMarco, { titulo: string; texto: string }> = {
  blur: { titulo: "Fondo desenfocado", texto: "El mismo video, ampliado y desenfocado de fondo; el original va centrado." },
  color: { titulo: "Fondo de color", texto: "Fondo de color liso, video con esquinas redondeadas y sombra suave." },
  marco: { titulo: "Marco con borde", texto: "Borde blanco (o negro) alrededor del video sobre un fondo liso." },
  mixto: { titulo: "Variado", texto: "Cada video usa un estilo distinto, repartidos en orden." },
};

export const esEstiloMarco = (v: unknown): v is EstiloMarco => typeof v === "string" && (ESTILOS_MARCO as readonly string[]).includes(v);

export interface VariacionElegida {
  variacion: Variacion | null;
  pantalla: Dispositivo | null;
  /** Solo con variacion = "marco". Un estilo ausente o inválido cae en «mixto». */
  estilo: EstiloMarco | null;
}

/** Normaliza variacion/pantalla/estilo que manda el navegador: cada campo solo se conserva si su variación lo usa. */
export function normalizarVariacion(b: Record<string, unknown>): VariacionElegida {
  const variacion: Variacion | null = b.variacion === "pantalla_real" ? "pantalla_real" : b.variacion === "marco" ? "marco" : null;
  return {
    variacion,
    pantalla: variacion === "pantalla_real" && esDispositivo(b.pantalla) ? b.pantalla : null,
    estilo: variacion === "marco" ? (esEstiloMarco(b.estilo) ? b.estilo : "mixto") : null,
  };
}

export const textoVariacion = (variacion: string | null | undefined, estilo?: string | null, pantalla?: string | null): string =>
  variacion === "pantalla_real" ? `pantalla real${esDispositivo(pantalla) ? ` (${DISPOSITIVO_TEXTO[pantalla]})` : ""}`
    : variacion === "marco" ? `marco${estilo && esEstiloMarco(estilo) ? ` (${ESTILOS_MARCO_TEXTO[estilo].titulo.toLowerCase()})` : ""}`
    : "";

/** «TV · sala» a partir del id de plantilla de trustclip («tv_sala», «movil_negro»…). */
export function etiquetaPlantilla(id: string): string {
  const [tipo, ...resto] = id.split("_");
  const nombre = esDispositivo(tipo) ? DISPOSITIVO_TEXTO[tipo] : tipo;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}${resto.length ? ` · ${resto.join(" ")}` : ""}`;
}
