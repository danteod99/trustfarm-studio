// Ideas nuevas ya revisadas que salen en /ideas (06-11-2026). Las que no están aquí se quedan en el
// código sin publicar. Este archivo no importa nada: así ideas.ts lo usa sin ciclos.
export const IMAGENES_PUBLICADAS: readonly string[] = [
  "granja-miniatura", "granja-macro-cables", "maquina-cascos-miniatura", "brainrot-figurita", "mascota-miniatura",
  "selfie-cleopatra", "miniatura-lima", "producto-miniatura", "depa-maqueta", "ecom-empaquetando",
  "ecom-bolso-mercado", "navidad-producto", "gatito-travesura", "granja-afiche", "granja-revista",
  "selladora-afiche", "mascota-afiche", "ecom-envios", "black-friday-afiche",
];

/** Cada una con su ejemplo en public/showcase/idea-<id>.jpg y .mp4. */
export const VIDEOS_PUBLICADOS: readonly string[] = [
  "anime-opening", "navidad-saludo-negocio", "ecom-demo-licuadora", "ecom-prueba-ropa", "black-friday-hook",
  "anime-voz-latina", "gatito-bosteza", "granja-unboxing", "ecom-ugc-crema",
];

export const IDS_PUBLICADOS: readonly string[] = [...IMAGENES_PUBLICADAS, ...VIDEOS_PUBLICADOS];
