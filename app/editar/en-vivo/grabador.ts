"use client";

// Grabador del Clipeo en vivo. Del stream capturado salen dos cosas en paralelo:
//   - video en segmentos de VIDEO_SEG_S (cada MediaRecorder nuevo empieza con fotograma clave,
//     así un clip = unir segmentos con -c copy, sin recodificar);
//   - audio en trozos de AUDIO_SEG_S para transcribir.
// Para no perder nada al rotar, el grabador nuevo arranca antes de detener el viejo.

import { AUDIO_SEG_S, BUFFER_S, VIDEO_SEG_S } from "@/app/lib/en-vivo";
import { execLogged, loadEngine, readBlob, safeDelete, writeInput } from "@/app/lib/video";

/**
 * Reloj que no se frena: los setInterval de una pestaña tapada o en segundo plano Chrome los
 * retrasa (hasta 1 por minuto), y la grabación necesita rotar cada pocos segundos. Los timers
 * de un Worker no sufren ese freno.
 */
export function crearTicker(ms: number, fn: () => void): () => void {
  try {
    const src = `setInterval(() => postMessage(0), ${Math.max(20, ms)});`;
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const w = new Worker(url);
    w.onmessage = () => fn();
    return () => { w.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}

export interface SegVideo { t0: number; t1: number; blob: Blob }
export interface TrozoAudio { t0: number; t1: number; blob: Blob }

const VIDEO_MIMES = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm"];
const AUDIO_MIMES = ["audio/webm;codecs=opus", "audio/webm"];

function elegir(mimes: string[]): string {
  return mimes.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
}

export class Grabador {
  readonly videoMime = elegir(VIDEO_MIMES);
  private readonly audioMime = elegir(AUDIO_MIMES);
  private readonly inicio = performance.now();
  private segs: SegVideo[] = [];
  private vRec: MediaRecorder | null = null;
  private aRec: MediaRecorder | null = null;
  private vT0 = 0;
  private aT0 = 0;
  private paradas: (() => void)[] = [];
  private detenido = false;
  private pendientes = 0;
  private alVaciar: (() => void)[] = [];

  constructor(private stream: MediaStream, private onAudio: (t: TrozoAudio) => void) {}

  /** Segundos desde que empezó la grabación. */
  ahora(): number {
    return (performance.now() - this.inicio) / 1000;
  }

  iniciar() {
    if (!this.videoMime) throw new Error("Tu navegador no puede grabar video. Usa Chrome o Edge en computadora.");
    this.vRec = this.nuevoVideo();
    this.paradas.push(crearTicker(VIDEO_SEG_S * 1000, () => this.rotarVideo()));
    if (this.stream.getAudioTracks().length) {
      this.aRec = this.nuevoAudio();
      this.paradas.push(crearTicker(AUDIO_SEG_S * 1000, () => this.rotarAudio()));
    }
  }

  /** Detiene todo y espera a que lleguen los últimos segmentos. */
  async detener() {
    if (this.detenido) return;
    this.detenido = true;
    this.paradas.forEach((f) => f());
    const t = this.ahora();
    this.cerrar(this.vRec, "v", this.vT0, t);
    this.cerrar(this.aRec, "a", this.aT0, t);
    this.vRec = this.aRec = null;
    await this.vaciar();
  }

  /** Espera a que los grabadores en rotación entreguen sus datos. */
  vaciar(): Promise<void> {
    return this.pendientes ? new Promise((r) => this.alVaciar.push(r)) : Promise.resolve();
  }

  /** Segmentos de video guardados (los más viejos que BUFFER_S se descartan). */
  segmentos(): SegVideo[] {
    return this.segs;
  }

  /** Fin del último segmento de video ya cerrado. */
  hastaGrabado(): number {
    return this.segs.length ? this.segs[this.segs.length - 1].t1 : 0;
  }

  private rotarVideo() {
    if (this.detenido) return;
    const viejo = this.vRec;
    const t = this.ahora();
    const t0 = this.vT0;
    this.vRec = this.nuevoVideo();
    this.cerrar(viejo, "v", t0, t);
  }

  private rotarAudio() {
    if (this.detenido) return;
    const viejo = this.aRec;
    const t = this.ahora();
    const t0 = this.aT0;
    this.aRec = this.nuevoAudio();
    this.cerrar(viejo, "a", t0, t);
  }

  private nuevoVideo(): MediaRecorder {
    this.vT0 = this.ahora();
    const r = new MediaRecorder(this.stream, { mimeType: this.videoMime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
    r.start();
    return r;
  }

  private nuevoAudio(): MediaRecorder {
    this.aT0 = this.ahora();
    const solo = new MediaStream(this.stream.getAudioTracks());
    const r = new MediaRecorder(solo, { mimeType: this.audioMime, audioBitsPerSecond: 32_000 });
    r.start();
    return r;
  }

  private cerrar(r: MediaRecorder | null, tipo: "v" | "a", t0: number, t1: number) {
    if (!r || r.state === "inactive") return;
    const partes: Blob[] = [];
    this.pendientes++;
    r.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    r.onstop = () => {
      const blob = new Blob(partes, { type: r.mimeType });
      if (blob.size) {
        if (tipo === "v") {
          this.segs.push({ t0, t1, blob });
          const limite = t1 - BUFFER_S;
          while (this.segs.length && this.segs[0].t1 < limite) this.segs.shift();
        } else {
          this.onAudio({ t0, t1, blob });
        }
      }
      if (--this.pendientes === 0) this.alVaciar.splice(0).forEach((f) => f());
    };
    try { r.stop(); } catch { r.onstop?.(new Event("stop")); }
  }
}

// ffmpeg.wasm es una sola instancia: los trabajos van en fila.
let fila: Promise<unknown> = Promise.resolve();
function enFila<T>(fn: () => Promise<T>): Promise<T> {
  const p = fila.then(fn, fn);
  fila = p.catch(() => {});
  return p;
}

/** Une segmentos (con -c copy, al instante) en un solo WebM. */
export function unirSegmentos(segs: SegVideo[]): Promise<Blob> {
  return enFila(async () => {
    if (!segs.length) throw new Error("ese tramo ya no está grabado");
    const { ffmpeg } = await loadEngine();
    const nombres = segs.map((_, i) => `vs${i}.webm`);
    try {
      for (let i = 0; i < segs.length; i++) await writeInput(ffmpeg, nombres[i], segs[i].blob);
      await writeInput(ffmpeg, "lista.txt", nombres.map((n) => `file '${n}'`).join("\n"));
      const { code, logs } = await execLogged(ffmpeg, ["-f", "concat", "-safe", "0", "-i", "lista.txt", "-c", "copy", "-y", "clip.webm"]);
      if (code !== 0) throw new Error(`no se pudo unir el clip (${logs.slice(-2).join(" ")})`);
      return await readBlob(ffmpeg, "clip.webm", "video/webm");
    } finally {
      await safeDelete(ffmpeg, ...nombres, "lista.txt", "clip.webm");
    }
  });
}

/**
 * Pasa un clip a MP4 (H.264/AAC) recortando exacto [desde, desde+dur] dentro del clip.
 * `vertical` recorta al centro en 9:16 (1080×1920 máx.) para TikTok/Reels/Shorts.
 */
export function aMp4(clip: Blob, desde: number, dur: number, vertical: boolean): Promise<Blob> {
  return enFila(async () => {
    const { ffmpeg } = await loadEngine();
    try {
      await writeInput(ffmpeg, "in.webm", clip);
      const vf = vertical
        ? "crop='min(iw,ih*9/16)':ih,scale=-2:'min(1920,ih)',setsar=1"
        : "scale=-2:'min(1080,ih)',setsar=1";
      const { code, logs } = await execLogged(ffmpeg, [
        "-ss", desde.toFixed(2), "-i", "in.webm", "-t", dur.toFixed(2),
        "-vf", vf, "-r", "30",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "21", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-y", "out.mp4",
      ]);
      if (code !== 0) throw new Error(`no se pudo convertir a MP4 (${logs.slice(-2).join(" ")})`);
      return await readBlob(ffmpeg, "out.mp4", "video/mp4");
    } finally {
      await safeDelete(ffmpeg, "in.webm", "out.mp4");
    }
  });
}
