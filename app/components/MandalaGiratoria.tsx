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

/** Dientes de sierra rellenos (banda tribal) entre r1 y r2. */
function dientes(c: CanvasRenderingContext2D, n: number, r1: number, r2: number) {
  const ab = Math.PI / n;
  cadaUno(n, (a) => {
    c.beginPath();
    c.moveTo(Math.cos(a - ab) * r1, Math.sin(a - ab) * r1);
    c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    c.lineTo(Math.cos(a + ab) * r1, Math.sin(a + ab) * r1);
    c.closePath();
    c.fill();
  });
}
/** Cuchillas curvas rellenas, como tatuaje tribal: base ancha en r1, punta curvada en r2. */
function cuchillas(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number, giro: number) {
  cadaUno(n, (a) => {
    const p = (ang: number, r: number) => [Math.cos(ang) * r, Math.sin(ang) * r] as const;
    const [x1, y1] = p(a - ab, r1);
    const [x2, y2] = p(a + ab, r1);
    const [xt, yt] = p(a + giro, r2);
    const [c1x, c1y] = p(a - ab * 0.2, (r1 + r2) / 2);
    const [c2x, c2y] = p(a + ab * 1.6 + giro * 0.5, (r1 + r2) / 2);
    c.beginPath();
    c.moveTo(x1, y1);
    c.quadraticCurveTo(c1x, c1y, xt, yt);
    c.quadraticCurveTo(c2x, c2y, x2, y2);
    c.closePath();
    c.fill();
  });
}
/** Chevrones gruesos apuntando hacia afuera. */
function chevrones(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number) {
  cadaUno(n, (a) => {
    c.beginPath();
    c.moveTo(Math.cos(a - ab) * r1, Math.sin(a - ab) * r1);
    c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    c.lineTo(Math.cos(a + ab) * r1, Math.sin(a + ab) * r1);
    c.stroke();
  });
}
/** Grupos de tres puntos. */
function trios(c: CanvasRenderingContext2D, n: number, r: number, tam: number) {
  cadaUno(n, (a) => {
    for (const d of [-1, 0, 1]) {
      c.beginPath();
      c.arc(Math.cos(a + d * 0.045) * r, Math.sin(a + d * 0.045) * r, d ? tam * 0.7 : tam, 0, TAU);
      c.fill();
    }
  });
}
/** Rombos rellenos. */
function rombosLlenos(c: CanvasRenderingContext2D, n: number, r: number, tam: number) {
  cadaUno(n, (a) => {
    c.save();
    c.rotate(a);
    c.translate(r, 0);
    c.beginPath();
    c.moveTo(-tam, 0);
    c.lineTo(0, -tam * 0.55);
    c.lineTo(tam, 0);
    c.lineTo(0, tam * 0.55);
    c.closePath();
    c.fill();
    c.restore();
  });
}

const ANILLOS: Anillo[] = [
  // Centro: sol sólido con cuchillas curvas.
  {
    vpm: 3,
    alpha: 1,
    dibujar: (c, R) => {
      c.beginPath();
      c.arc(0, 0, R * 0.045, 0, TAU);
      c.fill();
      cuchillas(c, 8, R * 0.06, R * 0.16, 0.28, 0.35);
    },
  },
  {
    vpm: -2,
    alpha: 0.9,
    dibujar: (c, R) => {
      circulo(c, R * 0.18, 3);
      dientes(c, 24, R * 0.19, R * 0.235);
      trios(c, 12, R * 0.26, R * 0.012);
    },
  },
  {
    vpm: 1.4,
    alpha: 0.8,
    dibujar: (c, R) => {
      c.lineWidth = 3.2;
      chevrones(c, 20, R * 0.29, R * 0.34, 0.12);
      chevrones(c, 20, R * 0.31, R * 0.36, 0.12);
      circulo(c, R * 0.385, 4);
    },
  },
  {
    vpm: -1,
    alpha: 0.7,
    dibujar: (c, R) => {
      dientes(c, 36, R * 0.395, R * 0.44);
      cuchillas(c, 12, R * 0.47, R * 0.62, 0.16, 0.22);
      puntos(c, 12, R * 0.47, R * 0.012, Math.PI / 12);
    },
  },
  {
    vpm: 0.7,
    alpha: 0.6,
    dibujar: (c, R) => {
      circulo(c, R * 0.645, 3.5);
      circulo(c, R * 0.665, 1.2);
      rombosLlenos(c, 16, R * 0.7, R * 0.035);
      trios(c, 16, R * 0.7, R * 0.009);
    },
  },
  {
    vpm: -0.45,
    alpha: 0.45,
    dibujar: (c, R) => {
      circulo(c, R * 0.74, 2.5);
      cuchillas(c, 24, R * 0.75, R * 0.93, 0.08, -0.1);
      puntos(c, 24, R * 0.96, R * 0.01, Math.PI / 24);
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
        c.shadowBlur = 6;
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
