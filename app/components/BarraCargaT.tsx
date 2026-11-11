"use client";

import { useEffect, useRef, useState } from "react";
import { progreso, textoRestante } from "@/app/lib/eta-progreso";

interface Props {
  /** Segundos transcurridos, medidos en el servidor al responder. */
  elapsedSec?: number;
  /** Tiempo total estimado según los trabajos reales anteriores. */
  etaSec: number;
  /** Para lectores de pantalla: "Progreso del video". */
  ariaLabel: string;
  /** Pasado el tiempo estimado, desde qué segundo se muestra `textoLento` en vez de "Ya casi listo…". */
  avisoLentitudSeg: number;
  textoLento: string;
  /** Ancho máximo de la barra (clase de Tailwind). */
  anchoClase?: string;
  /** Versión chica (listas): barra más fina, "T" más pequeña y texto menor. */
  compacta?: boolean;
}

/**
 * Barra de carga de la marca: avanza cada segundo entre consultas al servidor y la "T" va montada en la
 * punta. Se reinicia con cada respuesta nueva del servidor para no desfasarse del reloj real.
 */
export default function BarraCargaT({ elapsedSec, etaSec, ariaLabel, avisoLentitudSeg, textoLento, anchoClase = "max-w-[240px]", compacta = false }: Props) {
  const base = useRef({ elapsed: elapsedSec ?? 0, at: Date.now() });
  useEffect(() => {
    if (elapsedSec !== undefined) base.current = { elapsed: elapsedSec, at: Date.now() };
  }, [elapsedSec]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const transcurrido = base.current.elapsed + (Date.now() - base.current.at) / 1000;
  const p = progreso(transcurrido, etaSec);
  const pct = Math.round(p.fraccion * 100);

  return (
    <div className={`w-full ${anchoClase}`}>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={ariaLabel} className={`relative w-full ${compacta ? "my-1.5" : "my-3"}`}>
        <div className={`${compacta ? "h-1" : "h-2"} overflow-hidden rounded-full bg-white/10`}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* La "T" de la marca avanza montada en la punta de la barra. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/carga-t.png"
          alt=""
          width={32}
          height={32}
          className={`pointer-events-none absolute top-1/2 ${compacta ? "h-5 w-5" : "h-8 w-8"} -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)] transition-[left] duration-1000 ease-linear`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className={`tabular-nums ${compacta ? "text-[11px]" : ""}`}>
        {!p.tarde ? `${pct} % · quedan ${textoRestante(p.restante)}` : transcurrido >= avisoLentitudSeg ? textoLento : "Ya casi listo…"}
      </p>
    </div>
  );
}
