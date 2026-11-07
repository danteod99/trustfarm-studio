"use client";

/** Cuadro de un video listo para mandar como imagen (mismo formato que una foto subida). */
export interface Fotograma {
  data: string;
  mime: "image/jpeg";
  preview: string;
}

const MAX_SIDE = 1536;
const TIMEOUT_MS = 20_000;

/**
 * Saca un cuadro del video en el navegador. `en = "final"` toma el último cuadro (para que la
 * siguiente escena arranque justo donde terminó esta); un número toma ese segundo.
 * El video se carga aparte con CORS para poder leer los píxeles sin tocar el reproductor visible.
 */
export function capturarFotograma(url: string, en: "final" | number = "final"): Promise<Fotograma> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    const fin = (err?: Error, out?: Fotograma) => {
      clearTimeout(t);
      v.removeAttribute("src");
      v.load();
      if (err) reject(err);
      else resolve(out!);
    };
    const t = setTimeout(() => fin(new Error("El video tardó demasiado en cargar.")), TIMEOUT_MS);

    v.onerror = () => fin(new Error("No se pudo abrir el video."));
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      // Un poco antes del final: el último cuadro exacto a veces no se decodifica.
      const objetivo = en === "final" ? Math.max(0, d - 0.08) : Math.min(Math.max(0, en), Math.max(0, d - 0.08));
      v.currentTime = objetivo;
    };
    v.onseeked = () => {
      try {
        const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        const preview = c.toDataURL("image/jpeg", 0.92);
        fin(undefined, { data: preview.split(",")[1], mime: "image/jpeg", preview });
      } catch {
        fin(new Error("El navegador no dejó leer el cuadro del video."));
      }
    };
    v.src = url;
  });
}
