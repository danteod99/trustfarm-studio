"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Link2, Loader2, MonitorUp, Play, Radio, Scissors, Smartphone, Sparkles, Square, Trophy, Zap } from "lucide-react";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import { downloadBlobUrl } from "@/app/lib/video";
import { buildZip } from "@/app/granja/zip";
import {
  AUDIO_SEG_S, DetectorPicos, EN_VIVO_CREDITOS, MOMENTOS_CADA_S, TIPOS_VIVO, VIDEO_SEG_S, embedDeLink, nombreClip, reloj, segmentosPara,
  type Momento, type Segmento, type TipoVivo,
} from "@/app/lib/en-vivo";
import { Grabador, aMp4, crearTicker, unirSegmentos, type TrozoAudio } from "./grabador";

type Fase = "inicio" | "grabando" | "cerrando" | "terminado";
type Modo = "aqui" | "pestana";

interface Clip {
  id: number;
  m: Momento & { manual?: boolean };
  estado: "esperando" | "armando" | "listo" | "error";
  blob?: Blob;
  url?: string;
  /** Segundo dentro del WebM donde empieza el momento (los segmentos agregan hasta VIDEO_SEG_S antes). */
  offset?: number;
  error?: string;
  convirtiendo?: "mp4" | "vertical";
}

const EXIGENCIAS = [
  { v: 8, label: "Pocos y muy buenos" },
  { v: 6, label: "Normal" },
  { v: 5, label: "Más clips" },
];

const IDIOMAS = [
  { v: "es", label: "Español" },
  { v: "en", label: "Inglés" },
  { v: "pt", label: "Portugués" },
  { v: "auto", label: "Detectar solo" },
];

interface Revision { hasta: number; nuevos: number; mejor: { titulo: string; puntaje: number } | null; error?: boolean }

function linkWeb(s: string): boolean {
  try { return /^https?:$/.test(new URL(s.trim()).protocol); } catch { return false; }
}

// Region Capture (Chrome/Edge): recorta la captura de esta pestaña al reproductor.
type CropTargetCtor = { fromElement(el: Element): Promise<unknown> };

export default function EnVivo() {
  const [link, setLink] = useState("");
  const [tipo, setTipo] = useState<TipoVivo>("podcast");
  const [exigencia, setExigencia] = useState(6);
  const [idioma, setIdioma] = useState("es");
  const [revision, setRevision] = useState<Revision | null>(null);
  const [picos, setPicos] = useState<number[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [fase, setFase] = useState<Fase>("inicio");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [segs, setSegs] = useState<Segmento[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [segundos, setSegundos] = useState(0);
  const [creditos, setCreditos] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [host, setHost] = useState("");

  const playerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const grab = useRef<Grabador | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const sesion = useRef("");
  const segsRef = useRef<Segmento[]>([]);
  const clipsRef = useRef<Clip[]>([]);
  const transcritoHasta = useRef(0);
  const momentosHasta = useRef(0);
  const ultimaBusqueda = useRef(0);
  const colaAudio = useRef<Promise<void>>(Promise.resolve());
  const timers = useRef<(() => void)[]>([]);
  const detector = useRef<DetectorPicos | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  /** Pico de volumen que todavía no pasó por la IA: se busca apenas esté transcrito. */
  const picoPendiente = useRef<number | null>(null);
  const idClip = useRef(0);
  const faseRef = useRef<Fase>("inicio");

  useEffect(() => { setHost(window.location.hostname); }, []);
  useEffect(() => { faseRef.current = fase; }, [fase]);
  const embed = useMemo(() => (host ? embedDeLink(link, host) : null), [link, host]);
  // YouTube, Twitch y Kick se ven dentro de la página; cualquier otro link (TikTok, Facebook,
  // Instagram…) se abre en una ventana al lado y se graba esa ventana.
  const externo = useMemo(() => !embed && linkWeb(link), [embed, link]);
  const modo: Modo = embed ? "aqui" : "pestana";
  useEffect(() => { setAbierto(false); }, [link]);

  const abrirAlLado = () => {
    const w = Math.round(window.screen.availWidth / 2);
    const h = window.screen.availHeight;
    const v = window.open(link.trim(), "trustfarm-en-vivo", `popup,width=${w},height=${h},left=${w},top=0`);
    if (!v) { setError("Chrome bloqueó la ventana. Permite las ventanas emergentes de trustfarm.online o abre el link tú en otra ventana."); return; }
    setAbierto(true);
  };

  // Aviso al cerrar la pestaña con clips o grabación en curso.
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (faseRef.current === "grabando" || clipsRef.current.some((c) => c.estado === "listo")) e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  useEffect(() => () => {
    timers.current.forEach((f) => f());
    stream.current?.getTracks().forEach((t) => t.stop());
    void audioCtx.current?.close().catch(() => {});
  }, []);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segs]);

  const actualizarClip = (id: number, cambio: Partial<Clip>) => {
    clipsRef.current = clipsRef.current.map((c) => (c.id === id ? { ...c, ...cambio } : c));
    setClips(clipsRef.current);
  };

  const crearClip = async (m: Clip["m"]) => {
    const id = ++idClip.current;
    clipsRef.current = [...clipsRef.current, { id, m, estado: "esperando" }];
    setClips(clipsRef.current);
    const g = grab.current;
    if (!g) return;
    // Espera a que el último segmento que cubre el momento esté cerrado.
    for (let i = 0; i < 40 && g.hastaGrabado() < m.fin && faseRef.current === "grabando"; i++) {
      await new Promise((r) => setTimeout(r, 500));
    }
    await g.vaciar();
    actualizarClip(id, { estado: "armando" });
    try {
      const partes = segmentosPara(g.segmentos(), m.inicio, m.fin);
      const blob = await unirSegmentos(partes);
      actualizarClip(id, { estado: "listo", blob, url: URL.createObjectURL(blob), offset: Math.max(0, m.inicio - partes[0].t0) });
    } catch (e) {
      actualizarClip(id, { estado: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const buscarMomentos = async () => {
    const hasta = transcritoHasta.current;
    if (hasta - momentosHasta.current < 20) return;
    ultimaBusqueda.current = grab.current?.ahora() ?? 0;
    momentosHasta.current = hasta;
    setBuscando(true);
    try {
      const r = await fetch("/api/editar/en-vivo/momentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesion: sesion.current, hasta, tipo, exigencia, picos: detector.current?.picos ?? [],
          segments: segsRef.current.filter((s) => s.end > hasta - 330),
          previos: clipsRef.current.map((c) => ({ inicio: c.m.inicio, fin: c.m.fin, titulo: c.m.titulo })),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { momentos?: Momento[]; mejor?: Revision["mejor"]; error?: string };
      if (!r.ok && d.error) setAviso(d.error);
      setRevision({ hasta, nuevos: d.momentos?.length || 0, mejor: d.mejor ?? null, error: !r.ok });
      for (const m of d.momentos || []) void crearClip(m);
    } catch {
      setRevision({ hasta, nuevos: 0, mejor: null, error: true });
      setAviso("No se pudo buscar momentos en esta ronda; se reintenta en la siguiente.");
    } finally {
      setBuscando(false);
    }
  };

  const transcribir = async (t: TrozoAudio) => {
    if (!sesion.current) return;
    const form = new FormData();
    form.append("audio", new File([t.blob], "audio.webm", { type: t.blob.type || "audio/webm" }));
    form.append("sesion", sesion.current);
    form.append("t0", t.t0.toFixed(2));
    form.append("idioma", idioma === "auto" ? "" : idioma);
    form.append("previo", segsRef.current.slice(-6).map((x) => x.text).join(" "));
    try {
      const r = await fetch("/api/editar/en-vivo/transcribir", { method: "POST", body: form });
      const d = (await r.json().catch(() => ({}))) as { segments?: Segmento[]; cost?: number; error?: string; insufficient?: boolean };
      if (d.cost) setCreditos((c) => c + (d.cost || 0));
      if (r.status === 402 || r.status === 401 || r.status === 503) {
        setError(d.error || "No se pudo transcribir.");
        void terminar();
        return;
      }
      if (!r.ok) setAviso(d.error || "Un tramo no se pudo transcribir.");
      if (d.segments?.length) {
        segsRef.current = [...segsRef.current, ...d.segments].sort((a, b) => a.start - b.start);
        setSegs(segsRef.current);
      }
    } catch {
      setAviso("Se perdió la conexión en un tramo; seguimos con el siguiente.");
    }
    transcritoHasta.current = Math.max(transcritoHasta.current, t.t1);
  };

  const empezar = async () => {
    setError(null); setAviso(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("Tu navegador no permite capturar la transmisión. Usa Chrome o Edge en computadora.");
      return;
    }
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", frameRate: 30 },
        audio: { suppressLocalAudioPlayback: false } as MediaTrackConstraints,
        ...(modo === "aqui" ? { preferCurrentTab: true, selfBrowserSurface: "include" } : { selfBrowserSurface: "exclude" }),
        surfaceSwitching: "exclude",
        systemAudio: "include",
      } as unknown as DisplayMediaStreamOptions);
    } catch {
      setError("No diste permiso para capturar. Vuelve a intentar y presiona \"Permitir\" / \"Compartir\".");
      return;
    }
    if (!s.getAudioTracks().length) {
      s.getTracks().forEach((t) => t.stop());
      setError("La captura no trae sonido. Al compartir, deja activado \"Compartir audio de la pestaña\".");
      return;
    }
    const [video] = s.getVideoTracks();
    if (modo === "aqui") {
      const CT = (window as unknown as { CropTarget?: CropTargetCtor }).CropTarget;
      const cropTo = (video as unknown as { cropTo?: (t: unknown) => Promise<void> }).cropTo;
      if (CT && cropTo && playerRef.current) {
        try { await cropTo.call(video, await CT.fromElement(playerRef.current)); }
        catch { setAviso("Se está grabando la pestaña completa (no se pudo recortar al reproductor)."); }
      } else {
        setAviso("Tu navegador graba la pestaña completa. En Chrome o Edge se graba solo el reproductor.");
      }
    } else if (previewRef.current) {
      previewRef.current.srcObject = s;
      void previewRef.current.play().catch(() => {});
    }
    video.addEventListener("ended", () => { void terminar(); });

    stream.current = s;
    sesion.current = crypto.randomUUID();
    segsRef.current = []; setSegs([]);
    clipsRef.current.forEach((c) => c.url && URL.revokeObjectURL(c.url));
    clipsRef.current = []; setClips([]);
    transcritoHasta.current = momentosHasta.current = ultimaBusqueda.current = 0;
    setCreditos(0); setSegundos(0); setRevision(null); setPicos([]);
    picoPendiente.current = null;
    const det = new DetectorPicos();
    detector.current = det;
    colaAudio.current = Promise.resolve();
    const g = new Grabador(s, (t) => { colaAudio.current = colaAudio.current.then(() => transcribir(t)); });
    try { g.iniciar(); } catch (e) {
      s.getTracks().forEach((t) => t.stop());
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    grab.current = g;
    setFase("grabando"); faseRef.current = "grabando";
    // Medidor de volumen para detectar risas, gritos y aplausos.
    let medir: (() => void) | null = null;
    try {
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(an);
      const buf = new Float32Array(an.fftSize);
      medir = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const t = g.ahora();
        if (det.medir(t, Math.sqrt(sum / buf.length))) {
          setPicos([...det.picos]);
          if (picoPendiente.current === null) picoPendiente.current = t;
        }
      };
    } catch { /* sin medidor: la IA trabaja solo con el texto */ }
    timers.current = [
      crearTicker(100, () => medir?.()),
      crearTicker(1000, () => setSegundos(g.ahora())),
      crearTicker(3000, () => {
        const pico = picoPendiente.current;
        // Risas o gritos: se busca apenas esté transcrito lo que vino 8 s después del pico.
        if (pico !== null && transcritoHasta.current >= pico + 8) {
          picoPendiente.current = null;
          void buscarMomentos();
        } else if (g.ahora() - ultimaBusqueda.current >= MOMENTOS_CADA_S) void buscarMomentos();
      }),
    ];
  };

  const terminar = async () => {
    if (faseRef.current !== "grabando") return;
    setFase("cerrando"); faseRef.current = "cerrando";
    timers.current.forEach((f) => f());
    timers.current = [];
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    await grab.current?.detener();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (previewRef.current) previewRef.current.srcObject = null;
    await colaAudio.current;
    await buscarMomentos();
    setFase("terminado"); faseRef.current = "terminado";
  };

  const clipearAhora = () => {
    const g = grab.current;
    if (!g) return;
    const t = g.ahora();
    void crearClip({ inicio: Math.max(0, t - 45), fin: t, titulo: `Clip manual ${reloj(t)}`, gancho: "", puntaje: 0, motivo: "Lo marcaste tú", manual: true });
  };

  const convertir = async (c: Clip, vertical: boolean) => {
    if (!c.blob) return;
    actualizarClip(c.id, { convirtiendo: vertical ? "vertical" : "mp4" });
    try {
      const mp4 = await aMp4(c.blob, c.offset || 0, c.m.fin - c.m.inicio, vertical);
      const url = URL.createObjectURL(mp4);
      downloadBlobUrl(url, nombreClip(c.id, c.m.titulo + (vertical ? " vertical" : ""), "mp4"));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : String(e));
    } finally {
      actualizarClip(c.id, { convirtiendo: undefined });
    }
  };

  const textoTranscripcion = () => segsRef.current.map((s) => `[${reloj(s.start)}] ${s.text}`).join("\n");
  const textoMomentos = () =>
    clipsRef.current.map((c) => `#${c.id} [${reloj(c.m.inicio)}–${reloj(c.m.fin)}] ${c.m.titulo}${c.m.puntaje ? ` (${c.m.puntaje}/10)` : ""}\n   ${c.m.gancho}\n   ${c.m.motivo}`).join("\n\n");

  const bajarTexto = (texto: string, nombre: string) => {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    downloadBlobUrl(url, nombre);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const bajarTodo = async () => {
    const listos = clipsRef.current.filter((c) => c.blob);
    const zip = await buildZip([
      ...listos.map((c) => ({ path: nombreClip(c.id, c.m.titulo, "webm"), data: c.blob as Blob })),
      { path: "transcripcion.txt", data: textoTranscripcion() },
      { path: "mejores-momentos.txt", data: textoMomentos() },
    ]);
    const url = URL.createObjectURL(zip);
    downloadBlobUrl(url, `clipeo-en-vivo-${new Date().toISOString().slice(0, 10)}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const grabando = fase === "grabando";
  const listos = clips.filter((c) => c.estado === "listo").length;
  const proximaBusqueda = Math.max(0, MOMENTOS_CADA_S - (segundos - ultimaBusqueda.current));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader
        icon={<Radio size={20} />}
        title="Clipeo en vivo"
        subtitle="Pega el link de un en vivo (ideal para podcast). Mientras lo ves aquí, la IA lo transcribe en tiempo real y va cortando solos los mejores momentos."
      />
      {error && <div className="mb-4"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      {fase === "inicio" && (
        <div className="card mb-5 space-y-4 p-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold"><Link2 size={15} className="text-brand-2" /> Link de la transmisión en vivo</label>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="TikTok, YouTube, Twitch, Kick, Facebook, Instagram…" className="input mt-2" />
            {link && !embed && !externo && <p className="mt-1 text-xs text-red-400">Pega el link completo (empieza con https://).</p>}
            {embed && <p className="mt-1 text-xs text-emerald-300">Se ve aquí mismo, abajo.</p>}
            {externo && <p className="mt-1 text-xs text-sky-300">Este en vivo se abre en una ventana al lado y desde ahí se graba.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-mute">Tipo de transmisión</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoVivo)} className="input mt-1">
                {(Object.keys(TIPOS_VIVO) as TipoVivo[]).map((k) => <option key={k} value={k}>{TIPOS_VIVO[k].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-mute">Idioma</label>
              <select value={idioma} onChange={(e) => setIdioma(e.target.value)} className="input mt-1">
                {IDIOMAS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-mute">Cuántos clips</label>
              <select value={exigencia} onChange={(e) => setExigencia(Number(e.target.value))} className="input mt-1">
                {EXIGENCIAS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-mute">
            {EN_VIVO_CREDITOS} créditos cada 10 minutos de transmisión (transcripción + IA que elige momentos). Los clips se arman en tu computadora: deja esta pestaña abierta.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
          {modo === "aqui" ? (
            <div ref={playerRef} className="aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
              {embed ? (
                <iframe
                  src={embed.src}
                  title="Transmisión en vivo"
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-mute">Pega el link y la transmisión aparece aquí.</div>
              )}
            </div>
          ) : (
            <div className="relative">
              <video ref={previewRef} muted playsInline className="aspect-video w-full rounded-xl border border-line bg-black object-contain" />
              {fase === "inicio" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-mute">
                  {externo ? (
                    <>
                      <MonitorUp size={22} className="text-brand-2" />
                      <p>1) Abre el en vivo en una ventana al lado. 2) Presiona <b>Empezar a clipear</b>, elige esa ventana y deja activado <b>“Compartir audio de la pestaña”</b>.</p>
                    </>
                  ) : (
                    <p>Pega el link y la transmisión aparece aquí.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {fase === "inicio" && externo && (
              <button onClick={abrirAlLado} className={abierto ? "btn-ghost" : "btn-primary"}>
                <MonitorUp size={15} /> {abierto ? "Volver a abrir" : "1. Abrir el en vivo al lado"}
              </button>
            )}
            {fase === "inicio" && (
              <button onClick={empezar} disabled={!embed && !externo} className={externo && !abierto ? "btn-ghost" : "btn-primary"}>
                <Play size={15} /> {externo ? "2. Empezar a clipear" : "Empezar a clipear"}
              </button>
            )}
            {grabando && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-sm font-semibold text-red-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> EN VIVO {reloj(segundos)}
                </span>
                <button onClick={clipearAhora} className="btn-primary"><Scissors size={15} /> Clipear ahora</button>
                <button onClick={() => void buscarMomentos()} disabled={buscando} className="btn-ghost"><Sparkles size={15} /> Buscar momentos ya</button>
                <button onClick={() => void terminar()} className="btn-ghost"><Square size={14} /> Terminar</button>
              </>
            )}
            {fase === "cerrando" && <span className="inline-flex items-center gap-2 text-sm text-mute"><Loader2 size={15} className="animate-spin" /> Cerrando: últimos momentos…</span>}
            {fase === "terminado" && (
              <button onClick={() => { setFase("inicio"); faseRef.current = "inicio"; }} className="btn-ghost"><Radio size={14} /> Nuevo en vivo</button>
            )}
          </div>
          {modo === "aqui" && fase === "inicio" && embed && (
            <p className="text-xs text-mute">1) Dale play a la transmisión. 2) Presiona <b>Empezar a clipear</b> y luego <b>Permitir</b>. Deja el reproductor a la vista mientras graba.</p>
          )}
          {grabando && (
            <p className="text-xs text-mute">
              Transcribe cada {AUDIO_SEG_S} s · busca momentos {buscando ? "ahora…" : `en ${Math.ceil(proximaBusqueda)} s`} (y apenas detecta risas o gritos) · gastado: {creditos} créditos. “Clipear ahora” guarda los últimos 45 s.
            </p>
          )}
          {(grabando || fase === "terminado") && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1 text-amber-300"><Zap size={12} /> {picos.length} pico{picos.length === 1 ? "" : "s"} de risas/gritos{picos.length ? ` (último ${reloj(picos[picos.length - 1])})` : ""}</span>
              {revision ? (
                <span className={revision.nuevos ? "text-emerald-300" : "text-mute"}>
                  Revisado hasta {reloj(revision.hasta)}:{" "}
                  {revision.error ? "la IA no respondió, se reintenta" : revision.nuevos ? `${revision.nuevos} clip${revision.nuevos === 1 ? "" : "s"} nuevo${revision.nuevos === 1 ? "" : "s"}` : revision.mejor ? `nada para clipear (lo mejor: “${revision.mejor.titulo}” ${revision.mejor.puntaje}/10)` : "nada para clipear todavía"}
                </span>
              ) : grabando ? <span className="text-mute">La primera revisión de la IA llega en ~1 minuto.</span> : null}
            </div>
          )}
          {aviso && <p className="text-xs text-amber-300">{aviso}</p>}

          <div className="card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText size={15} className="text-brand-2" /> Transcripción en vivo
              {segs.length > 0 && (
                <button onClick={() => bajarTexto(textoTranscripcion(), "transcripcion.txt")} className="ml-auto text-xs font-normal text-mute hover:text-ink">Descargar .txt</button>
              )}
            </div>
            <div ref={transcriptRef} className="max-h-64 space-y-1 overflow-y-auto pr-1 text-sm">
              {segs.length === 0 ? (
                <p className="text-mute">{grabando ? `La primera parte aparece en unos ${AUDIO_SEG_S} s…` : "Aquí verás lo que se dice en la transmisión."}</p>
              ) : (
                segs.map((s, i) => (
                  <p key={i}><span className="mr-2 font-mono text-xs text-mute">{reloj(s.start)}</span>{s.text}</p>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-semibold">Mejores momentos</h2>
            <span className="text-xs text-mute">{listos} clip{listos === 1 ? "" : "s"}</span>
            {listos > 0 && <button onClick={() => void bajarTodo()} className="btn-ghost ml-auto !px-2.5 !py-1 text-xs"><Download size={12} /> Todo (.zip)</button>}
          </div>
          {clips.length === 0 && (
            <div className="card p-5 text-sm text-mute">
              {grabando ? `La IA revisa la transmisión cada ${MOMENTOS_CADA_S / 60} minutos y los clips aparecen aquí solos.` : "Todavía no hay clips."}
            </div>
          )}
          <div className="space-y-3">
            {[...clips].reverse().map((c) => (
              <div key={c.id} className="card overflow-hidden">
                {c.url ? (
                  <video src={c.url} controls preload="metadata" className="aspect-video w-full bg-black" onLoadedMetadata={(e) => { e.currentTarget.currentTime = c.offset || 0; }} />
                ) : (
                  <div className="flex aspect-video items-center justify-center gap-2 bg-black/40 text-xs text-mute">
                    {c.estado === "error" ? <span className="px-4 text-center text-red-300">No se pudo armar: {c.error}</span> : <><Loader2 size={14} className="animate-spin" /> {c.estado === "esperando" ? "Esperando que termine el momento…" : "Cortando el clip…"}</>}
                  </div>
                )}
                <div className="space-y-1 p-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    {c.m.puntaje > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300"><Trophy size={10} /> {c.m.puntaje}/10</span>
                    ) : (
                      <span className="rounded-md bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">Manual</span>
                    )}
                    <span className="font-mono text-mute">{reloj(c.m.inicio)}–{reloj(c.m.fin)}</span>
                    <span className="ml-auto text-mute">{Math.round(c.m.fin - c.m.inicio)} s</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug">{c.m.titulo}</p>
                  {c.m.gancho && <p className="text-xs text-brand-2">“{c.m.gancho}”</p>}
                  {c.m.motivo && !c.m.manual && <p className="text-xs text-mute">{c.m.motivo}</p>}
                  {c.estado === "listo" && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button onClick={() => void convertir(c, true)} disabled={!!c.convirtiendo} className="btn-primary !px-2.5 !py-1 text-xs">
                        {c.convirtiendo === "vertical" ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={12} />} MP4 vertical
                      </button>
                      <button onClick={() => void convertir(c, false)} disabled={!!c.convirtiendo} className="btn-ghost !px-2.5 !py-1 text-xs">
                        {c.convirtiendo === "mp4" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} MP4
                      </button>
                      <button onClick={() => c.url && downloadBlobUrl(c.url, nombreClip(c.id, c.m.titulo, "webm"))} className="btn-ghost !px-2.5 !py-1 text-xs">
                        WebM
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {fase === "terminado" && clips.length > 0 && (
            <p className="mt-3 text-xs text-mute">Descarga tus clips antes de cerrar la pestaña: se guardan solo en esta computadora. El WebM trae hasta {VIDEO_SEG_S} s de margen; el MP4 va recortado exacto.</p>
          )}
        </div>
      </div>
    </div>
  );
}
