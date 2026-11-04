"use client";

// Utilidades de archivos de video en el navegador (sin ffmpeg).

export interface VideoInfo { w: number; h: number; dur: number }

/** Ancho, alto y duración leyendo los metadatos con un <video> (Blob/File o URL). */
export function getVideoInfo(src: Blob | string): Promise<VideoInfo> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = typeof src === "string" ? src : URL.createObjectURL(src);
    const done = (d: VideoInfo) => {
      if (typeof src !== "string") URL.revokeObjectURL(url);
      resolve(d);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done({ w: v.videoWidth || 1080, h: v.videoHeight || 1920, dur: v.duration || 0 });
    v.onerror = () => done({ w: 1080, h: 1920, dur: 0 });
    v.src = url;
  });
}

export function isVideoFile(f: File): boolean {
  return f.type.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
}

export function fmtMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/** Descarga una URL (p. ej. un video de la galería) como File, avisando el avance (0–1). */
export async function fetchAsFile(url: string, name: string, onProgress?: (ratio: number) => void): Promise<File> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`No se pudo descargar el video (${res.status})`);
  const total = parseInt(res.headers.get("content-length") || "0", 10);
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let recv = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) { parts.push(value); recv += value.length; }
    if (total) onProgress?.(recv / total);
  }
  const type = res.headers.get("content-type") || "video/mp4";
  return new File(parts as BlobPart[], name, { type });
}

/** Descarga un Blob con un nombre (dispara el diálogo/descarga del navegador). */
export function downloadBlobUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
