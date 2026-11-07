"use client";

import { useEffect, useRef } from "react";

/**
 * Mandala KARIBU: anillos de pétalos, zigzags, puntas y puntos en blanco. Cada anillo gira a su
 * propio ritmo y en su propio sentido, y el conjunto "respira" muy suave. Cada anillo se dibuja una
 * sola vez en un lienzo aparte y luego solo se rota, así que va fluido. Quieta si el usuario pidió
 * reducir movimiento.
 */

type Dibujo = (c: CanvasRenderingContext2D, R: number) => void;
interface Anillo {
  dibujar: Dibujo;
  /** Vueltas por minuto (negativo = al revés). */
  vpm: number;
  alpha: number;
}

const TAU = Math.PI * 2;

function cadaUno(n: number, f: (ang: number, i: number) => void) {
  for (let i = 0; i < n; i++) f((i / n) * TAU, i);
}
function circulo(c: CanvasRenderingContext2D, r: number, ancho = 1) {
  c.lineWidth = ancho;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.stroke();
}
function puntos(c: CanvasRenderingContext2D, n: number, r: number, tam: number, desfase = 0) {
  cadaUno(n, (a) => {
    c.beginPath();
    c.arc(Math.cos(a + desfase) * r, Math.sin(a + desfase) * r, tam, 0, TAU);
    c.fill();
  });
}

/**
 * Espina tribal: base angosta en r1 y lados cóncavos que terminan en una punta muy afilada en r2.
 * Con `giro` la punta se curva como garra o anzuelo.
 */
function espinas(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number, giro = 0, desfase = 0) {
  const p = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r] as const;
  cadaUno(n, (a0) => {
    const a = a0 + desfase;
    const m = r1 + (r2 - r1) * 0.45;
    const [x1, y1] = p(a - ab, r1);
    const [x2, y2] = p(a + ab, r1);
    const [xt, yt] = p(a + giro, r2);
    const [c1x, c1y] = p(a + giro * 0.35 - ab * 0.12, m);
    const [c2x, c2y] = p(a + giro * 0.55 + ab * 0.12, m);
    c.beginPath();
    c.moveTo(x1, y1);
    c.quadraticCurveTo(c1x, c1y, xt, yt);
    c.quadraticCurveTo(c2x, c2y, x2, y2);
    c.closePath();
    c.fill();
  });
}

const ANILLOS: Anillo[] = [
  // Centro: estrella de 12 espinas alrededor de un ojo.
  {
    vpm: 2.6,
    alpha: 0.85,
    dibujar: (c, R) => {
      c.beginPath();
      c.arc(0, 0, R * 0.022, 0, TAU);
      c.fill();
      circulo(c, R * 0.038, 1);
      espinas(c, 12, R * 0.045, R * 0.15, 0.13);
      espinas(c, 12, R * 0.045, R * 0.1, 0.1, 0, Math.PI / 12);
    },
  },
  {
    vpm: -1.8,
    alpha: 0.7,
    dibujar: (c, R) => {
      circulo(c, R * 0.165, 1.1);
      espinas(c, 24, R * 0.17, R * 0.225, 0.07);
      espinas(c, 24, R * 0.16, R * 0.125, 0.06, 0, Math.PI / 24);
    },
  },
  {
    vpm: 1.2,
    alpha: 0.6,
    dibujar: (c, R) => {
      espinas(c, 16, R * 0.24, R * 0.39, 0.07, 0.32);
      espinas(c, 16, R * 0.24, R * 0.33, 0.05, -0.28, Math.PI / 16);
    },
  },
  {
    vpm: -0.9,
    alpha: 0.5,
    dibujar: (c, R) => {
      circulo(c, R * 0.41, 0.9);
      espinas(c, 48, R * 0.415, R * 0.445, 0.035);
      puntos(c, 48, R * 0.455, 0.9, Math.PI / 48);
    },
  },
  {
    vpm: 0.6,
    alpha: 0.45,
    dibujar: (c, R) => {
      espinas(c, 12, R * 0.47, R * 0.7, 0.05);
      espinas(c, 12, R * 0.49, R * 0.63, 0.06, 0.38, Math.PI / 12);
      espinas(c, 12, R * 0.49, R * 0.63, 0.06, -0.38, Math.PI / 12);
    },
  },
  {
    vpm: -0.45,
    alpha: 0.38,
    dibujar: (c, R) => {
      circulo(c, R * 0.72, 1);
      espinas(c, 36, R * 0.725, R * 0.79, 0.04);
      espinas(c, 36, R * 0.725, R * 0.755, 0.03, 0, Math.PI / 36);
    },
  },
  {
    vpm: 0.3,
    alpha: 0.28,
    dibujar: (c, R) => {
      espinas(c, 24, R * 0.8, R * 0.98, 0.035, 0.14);
      espinas(c, 48, R * 0.8, R * 0.85, 0.02, 0, Math.PI / 48);
    },
  },
];

export default function MandalaGiratoria({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, R = 0, dpr = 1, raf = 0;
    let capas: HTMLCanvasElement[] = [];
    const t0 = performance.now();

    // Cada anillo se pinta una vez (con brillo) en su propio lienzo.
    function prerender() {
      const lado = Math.ceil(R * 2.1 * dpr);
      capas = ANILLOS.map((a) => {
        const off = document.createElement("canvas");
        off.width = off.height = lado;
        const c = off.getContext("2d")!;
        c.setTransform(dpr, 0, 0, dpr, lado / 2, lado / 2);
        c.strokeStyle = "#fff";
        c.fillStyle = "#fff";
        c.lineCap = "round";
        c.lineJoin = "round";
        c.shadowColor = "rgba(255,255,255,0.8)";
        c.shadowBlur = 4;
        a.dibujar(c, R);
        return off;
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      R = Math.min(w, h) * 0.47;
      prerender();
    }

    function draw(t: number) {
      const min = (t - t0) / 60000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const respira = 1 + Math.sin((t - t0) / 2400) * 0.015;
      ANILLOS.forEach((a, i) => {
        const capa = capas[i];
        ctx.setTransform(respira, 0, 0, respira, canvas.width / 2, canvas.height / 2);
        ctx.rotate(min * a.vpm * TAU);
        ctx.globalAlpha = a.alpha;
        ctx.drawImage(capa, -capa.width / 2, -capa.height / 2);
      });
      ctx.globalAlpha = 1;
    }

    function loop(t: number) {
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    if (still) draw(t0);
    else raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
