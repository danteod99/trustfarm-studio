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
} as const;

/** Límite diario de videos en Multiclipping (los admins no tienen límite). */
export const CLIPS_LIMITE_DIARIO = 5;
