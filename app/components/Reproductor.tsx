"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";

interface Props {
  src: string;
  /** Acceso al <video> real (p. ej. para llamar a play() desde afuera). */
  ref?: Ref<HTMLVideoElement | null>;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  onEnded?: () => void;
  className?: string;
}

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

/** Reproductor con el estilo de la marca: reemplaza los controles nativos del navegador. */
export default function Reproductor({ src, ref, autoPlay, loop, muted: mutedInicial, onEnded, className = "" }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => video.current as HTMLVideoElement, []);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(!!mutedInicial);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [visible, setVisible] = useState(true);
  const [arrastrando, setArrastrando] = useState(false);
  const ocultar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Los controles se esconden solos mientras reproduce y reaparecen al mover el mouse o tocar.
  function mostrarControles() {
    setVisible(true);
    if (ocultar.current) clearTimeout(ocultar.current);
    ocultar.current = setTimeout(() => {
      if (video.current && !video.current.paused) setVisible(false);
    }, 2200);
  }
  useEffect(() => () => void (ocultar.current && clearTimeout(ocultar.current)), []);

  function alternar() {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    mostrarControles();
  }

  function saltar(clientX: number) {
    const v = video.current;
    const r = barra.current?.getBoundingClientRect();
    if (!v || !r || !dur) return;
    v.currentTime = Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * dur;
    setT(v.currentTime);
  }

  function pantallaCompleta() {
    const el = caja.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen();
    // iPhone: solo el <video> puede ir a pantalla completa.
    else (video.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void })?.webkitEnterFullscreen?.();
  }

  const pct = dur ? (t / dur) * 100 : 0;
  const mostrar = visible || !playing;

  return (
    <div
      ref={caja}
      onMouseMove={mostrarControles}
      onMouseLeave={() => playing && setVisible(false)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "k") {
          e.preventDefault();
          alternar();
        }
      }}
      tabIndex={0}
      className={`group/rep relative h-full w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),rgba(255,255,255,0.06)_45%,#05070c_80%)] outline-none ${className}`}
    >
      <video
        ref={video}
        src={src}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        onClick={alternar}
        onPlay={() => {
          setPlaying(true);
          mostrarControles();
        }}
        onPause={() => {
          setPlaying(false);
          setVisible(true);
        }}
        onTimeUpdate={(e) => !arrastrando && setT(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onDurationChange={(e) => setDur(e.currentTarget.duration)}
        onEnded={onEnded}
        className="relative h-full w-full cursor-pointer object-contain"
      />

      {/* Botón central */}
      {!playing && (
        <button
          onClick={alternar}
          aria-label="Reproducir"
          className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-black shadow-[0_0_30px_rgba(255,255,255,0.55)] ring-4 ring-white/10 transition hover:scale-105 active:scale-95"
        >
          <Play size={26} className="ml-1" fill="currentColor" />
        </button>
      )}

      {/* Barra inferior */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-300 ${
          mostrar ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          ref={barra}
          role="slider"
          aria-label="Avance del video"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(t)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setArrastrando(true);
            saltar(e.clientX);
          }}
          onPointerMove={(e) => arrastrando && saltar(e.clientX)}
          onPointerUp={() => setArrastrando(false)}
          onKeyDown={(e) => {
            const v = video.current;
            if (!v) return;
            if (e.key === "ArrowRight") v.currentTime = Math.min(dur, v.currentTime + 1);
            if (e.key === "ArrowLeft") v.currentTime = Math.max(0, v.currentTime - 1);
          }}
          className="group/barra relative mb-2 flex h-4 cursor-pointer touch-none items-center"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover/barra:h-1.5">
            <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${pct}%` }} />
          </div>
          <span
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-transform group-hover/barra:scale-125"
            style={{ left: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-2 text-white">
          <button onClick={alternar} aria-label={playing ? "Pausar" : "Reproducir"} className="rounded-full p-1.5 hover:bg-white/15">
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <span className="text-xs tabular-nums text-white/85">
            {fmt(t)} / {fmt(dur)}
          </span>
          <span className="flex-1" />
          <button
            onClick={() => {
              setMuted((m) => !m);
              mostrarControles();
            }}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
            className="rounded-full p-1.5 hover:bg-white/15"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <button onClick={pantallaCompleta} aria-label="Pantalla completa" className="rounded-full p-1.5 hover:bg-white/15">
            <Maximize size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
