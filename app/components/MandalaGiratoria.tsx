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
/** Pétalo en punta (hoja) desde r1 hasta r2, con ancho angular `ab`. */
function petalos(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number, relleno = false, vena = false) {
  cadaUno(n, (a) => {
    c.save();
    c.rotate(a);
    c.beginPath();
    c.moveTo(r1, 0);
    const m = (r1 + r2) / 2;
    const w = m * Math.sin(ab);
    c.quadraticCurveTo(m, -w, r2, 0);
    c.quadraticCurveTo(m, w, r1, 0);
    if (relleno) c.fill();
    else c.stroke();
    if (vena) {
      c.beginPath();
      c.moveTo(r1 + (r2 - r1) * 0.15, 0);
      c.lineTo(r2 - (r2 - r1) * 0.15, 0);
      c.stroke();
    }
    c.restore();
  });
}
function zigzag(c: CanvasRenderingContext2D, n: number, r1: number, r2: number) {
  c.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU;
    const r = i % 2 ? r2 : r1;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.stroke();
}
function puntas(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number) {
  cadaUno(n, (a) => {
    c.beginPath();
    c.moveTo(Math.cos(a - ab) * r1, Math.sin(a - ab) * r1);
    c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    c.lineTo(Math.cos(a + ab) * r1, Math.sin(a + ab) * r1);
    c.stroke();
  });
}
function arcos(c: CanvasRenderingContext2D, n: number, r: number, tam: number) {
  cadaUno(n, (a) => {
    c.beginPath();
    c.arc(Math.cos(a) * r, Math.sin(a) * r, tam, a - Math.PI / 2, a + Math.PI / 2);
    c.stroke();
  });
}
function rombos(c: CanvasRenderingContext2D, n: number, r: number, tam: number) {
  cadaUno(n, (a) => {
    c.save();
    c.rotate(a);
    c.translate(r, 0);
    c.beginPath();
    c.moveTo(-tam, 0);
    c.lineTo(0, -tam * 0.6);
    c.lineTo(tam, 0);
    c.lineTo(0, tam * 0.6);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.arc(0, 0, tam * 0.18, 0, TAU);
    c.fill();
    c.restore();
  });
}
function rayos(c: CanvasRenderingContext2D, n: number, r1: number, r2: number) {
  cadaUno(n, (a, i) => {
    const largo = i % 2 ? r2 : r1 + (r2 - r1) * 0.6;
    c.beginPath();
    c.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    c.lineTo(Math.cos(a) * largo, Math.sin(a) * largo);
    c.stroke();
    c.beginPath();
    c.arc(Math.cos(a) * (largo + 4), Math.sin(a) * (largo + 4), i % 2 ? 1.8 : 1.1, 0, TAU);
    c.fill();
  });
}

const ANILLOS: Anillo[] = [
  // Centro: flor de 8 pétalos rellenos y un ojo.
  {
    vpm: 3,
    alpha: 1,
    dibujar: (c, R) => {
      petalos(c, 8, R * 0.015, R * 0.09, 0.5, true);
      circulo(c, R * 0.03, 1.2);
      petalos(c, 8, R * 0.05, R * 0.12, 0.35);
    },
  },
  {
    vpm: -2,
    alpha: 0.9,
    dibujar: (c, R) => {
      circulo(c, R * 0.14, 1.2);
      puntos(c, 16, R * 0.165, 1.6);
      petalos(c, 12, R * 0.19, R * 0.29, 0.32, false, true);
    },
  },
  {
    vpm: 1.4,
    alpha: 0.85,
    dibujar: (c, R) => {
      circulo(c, R * 0.31, 1);
      zigzag(c, 24, R * 0.315, R * 0.35);
      circulo(c, R * 0.355, 1);
    },
  },
  {
    vpm: -1.1,
    alpha: 0.8,
    dibujar: (c, R) => {
      puntas(c, 32, R * 0.37, R * 0.45, 0.07);
      puntos(c, 32, R * 0.39, 1.3, Math.PI / 32);
    },
  },
  {
    vpm: 0.8,
    alpha: 0.75,
    dibujar: (c, R) => {
      circulo(c, R * 0.47, 1.4);
      circulo(c, R * 0.49, 0.6);
      petalos(c, 16, R * 0.5, R * 0.64, 0.22, false, true);
      petalos(c, 16, R * 0.53, R * 0.6, 0.12);
    },
  },
  {
    vpm: -0.6,
    alpha: 0.65,
    dibujar: (c, R) => {
      arcos(c, 24, R * 0.67, R * 0.035);
      circulo(c, R * 0.705, 0.8);
      rombos(c, 12, R * 0.75, R * 0.04);
      puntos(c, 72, R * 0.79, 1, Math.PI / 72);
    },
  },
  {
    vpm: 0.4,
    alpha: 0.5,
    dibujar: (c, R) => {
      circulo(c, R * 0.82, 1);
      zigzag(c, 48, R * 0.825, R * 0.85);
      rayos(c, 48, R * 0.86, R * 0.96);
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
