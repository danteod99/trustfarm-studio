"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Copy, Sparkles } from "lucide-react";

// Demo visual «1 video → 100 versiones». Es una ilustración: cada miniatura usa la misma imagen
// base con otro filtro de color, encuadre y gancho, como hace Modo Granja con el video real.

const BASE = { src: "/showcase/ltx-granja.jpg", video: "/showcase/ltx-granja.mp4" };

const GANCHOS = [
  "Mientras duermes, esto publica",
  "40 celulares, 0 empleados",
  "Nadie te muestra esto de TikTok",
  "POV: tu contenido se hace solo",
  "Esto hay detrás de los virales",
  "1 caja, 100 cuentas",
  "¿Sabías que esto existe?",
  "Así se ve una granja de noche",
  "No es magia, es una granja",
  "El negocio que nadie ve",
  "Mira lo que pasa a las 3 a. m.",
  "Esto reemplazó a mi community",
  "¿Cuántas cuentas manejas tú?",
  "Lo que usan las agencias",
  "Te explico en 10 segundos",
  "Guarda este video",
  "Tu competencia ya hace esto",
  "Nivel: 100 cuentas al día",
  "Así trabaja mientras comes",
  "De 1 video a 100",
  "Esto cambió mis números",
  "Pocos saben cómo funciona",
  "La caja que nunca descansa",
  "¿Real o IA? Comenta",
];

const NOMBRES = ["lima.tech", "granja.pe", "ventas.ya", "ofertas.hoy", "mundo.ia", "tips.diarios", "virales.pe", "cuenta"];

/** Pseudoaleatorio fijo por índice: misma variación en servidor y navegador. */
function rnd(i: number, k: number) {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const TILES = Array.from({ length: 24 }, (_, i) => {
  const hue = Math.round((rnd(i, 1) - 0.5) * 80);
  const sat = (0.8 + rnd(i, 2) * 0.55).toFixed(2);
  const bri = (0.85 + rnd(i, 3) * 0.3).toFixed(2);
  const zoom = (1 + rnd(i, 4) * 0.18).toFixed(2);
  const x = Math.round((rnd(i, 5) - 0.5) * 10);
  const vel = Math.round((rnd(i, 6) - 0.5) * 6);
  return {
    handle: `@${NOMBRES[i % NOMBRES.length]}${String(i + 1).padStart(2, "0")}`,
    filter: `hue-rotate(${hue}deg) saturate(${sat}) brightness(${bri})`,
    transform: `scale(${zoom}) translateX(${x}%)`,
    vel: `${vel >= 0 ? "+" : ""}${vel} % vel.`,
  };
});

export default function MultiplicarDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [count, setCount] = useState(1);
  const [tick, setTick] = useState(0);

  // Arranca cuando entra en pantalla.
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setOn(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Contador 1 → 100 y luego los ganchos van rotando.
  useEffect(() => {
    if (!on) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(100);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 2600);
      setCount(Math.max(1, Math.round(1 + 99 * (1 - Math.pow(1 - p, 3)))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const iv = setInterval(() => setTick((n) => n + 1), 3200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
    };
  }, [on]);

  return (
    <div ref={ref} className="grid items-center gap-8 lg:grid-cols-[260px_auto_1fr]">
      <style>{`@keyframes tfFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
      {/* Video base */}
      <div className="mx-auto w-40 lg:w-full">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-mute">1 video base</p>
        <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-brand/50 shadow-2xl shadow-brand/20">
          <video src={BASE.video} poster={BASE.src} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
            Generado con IA
          </span>
        </div>
      </div>

      {/* Flecha + contador */}
      <div className="flex flex-row items-center justify-center gap-3 lg:flex-col">
        <span className="grid h-11 w-11 place-items-center rounded-full border border-brand/40 bg-brand/15 text-brand-2">
          <Copy size={18} />
        </span>
        <div className="text-center">
          <p className="font-mono text-4xl font-extrabold tabular-nums text-brand-2 sm:text-5xl">{count}</p>
          <p className="text-xs text-mute">versiones únicas</p>
        </div>
      </div>

      {/* Versiones */}
      <div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
          {TILES.map((t, i) => {
            const gancho = GANCHOS[(i + tick * 5) % GANCHOS.length];
            return (
              <div
                key={i}
                className={`relative aspect-[9/16] overflow-hidden rounded-lg border border-line bg-panel transition-all duration-500 ${
                  i >= 12 ? "hidden sm:block" : ""
                } ${on ? "scale-100 opacity-100" : "scale-90 opacity-0"}`}
                style={{ transitionDelay: on ? `${i * 70}ms` : "0ms" }}
              >
                <Image
                  src={BASE.src}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 30vw, 120px"
                  className="object-cover"
                  style={{ filter: t.filter, transform: t.transform }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                <p
                  key={gancho}
                  className="absolute inset-x-1 top-[18%] motion-safe:animate-[tfFadeIn_.6s_ease] rounded bg-white px-1 py-0.5 text-center text-[8px] font-bold leading-tight text-black sm:text-[9px]"
                >
                  {gancho}
                </p>
                <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 text-[8px] text-white/90 sm:text-[9px]">
                  <span className="truncate font-medium">{t.handle}</span>
                  <span className="hidden shrink-0 text-brand-2 xl:inline">{t.vel}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-mute">
          <Sparkles size={13} className="text-brand-2" />
          Cada versión: otro gancho escrito por IA, otro color, otro encuadre, otra velocidad. Ninguna es igual a otra.
        </p>
      </div>
    </div>
  );
}
