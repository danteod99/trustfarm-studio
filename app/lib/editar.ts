// Precios y cobro de las herramientas de /editar. Lo que corre 100 % en el navegador
// (variaciones, cortes, render) es gratis; solo se cobra lo que usa IA en el servidor.
// 1 crédito ≈ US$0,10. Los admins no pagan.

/** Precios en créditos (también se muestran en la UI antes de ejecutar). */
export const EDITAR_PRECIOS = {
  /** Transcripción con Whisper (subtítulos / retomas), por video. */
  transcripcion: 3,
  /** Detección de retomas y falsos comienzos con Claude, por video. */
  retomas: 5,
  /** Revisar si el video ya trae subtítulos quemados (antes de agregar otros), por video. */
  detectarSubs: 1,
  /** Multiclipping: análisis del video largo y clips en la nube, por video. */
  clips: 5,
  /** Perfil de TikTok: bajar hasta 10 videos de tu perfil (sin marca de agua), por trabajo. */
  perfil: 3,
  /** Perfil de TikTok + variación «Pantalla real laptop/TV» en cada video, por trabajo. */
  perfilVariacion: 5,
} as const;

/** Límite diario de trabajos de Perfil de TikTok (los admins no tienen límite). */
export const PERFIL_LIMITE_DIARIO = 5;

/** Límite diario de videos en Multiclipping (los admins no tienen límite). */
export const CLIPS_LIMITE_DIARIO = 5;

/** Tope del audio que se manda a transcribir: Vercel rechaza bodies de más de 4.5 MB. */
export const MAX_AUDIO_BYTES = 4_300_000;
