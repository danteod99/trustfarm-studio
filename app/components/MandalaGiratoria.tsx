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

/** Estrella poligonal de n puntas (rellena o solo contorno). */
function estrella(c: CanvasRenderingContext2D, n: number, rIn: number, rOut: number, relleno: boolean, ancho = 1) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const r = i % 2 ? rIn : rOut;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  if (relleno) c.fill();
  else {
    c.lineWidth = ancho;
    c.stroke();
  }
}
/** Espinas con largos distintos según un patrón (rompe la forma de círculo). */
function espinasPatron(c: CanvasRenderingContext2D, n: number, r1: number, extra: number, patron: number[], ab: number, giro = 0) {
  for (let i = 0; i < n; i++) {
    const r2 = r1 + extra * patron[i % patron.length];
    c.save();
    c.rotate((i / n) * TAU);
    espinas(c, 1, r1, r2, ab, giro);
    c.restore();
  }
}
/** Brazo espinoso: una lanza larga con púas que salen hacia afuera a ambos lados, como rama de espino. */
function brazos(c: CanvasRenderingContext2D, n: number, r1: number, r2: number, ab: number, pua: number, desfase = 0) {
  cadaUno(n, (a0) => {
    c.save();
    c.rotate(a0 + desfase);
    espinas(c, 1, r1, r2, ab);
    // Púas: de la base a la punta, cada vez más chicas, alternando lado.
    for (let k = 0; k < 5; k++) {
      const t = 0.18 + k * 0.15;
      const r = r1 + (r2 - r1) * t;
      const largo = pua * (1 - t * 0.8);
      for (const lado of [-1, 1]) {
        c.save();
        c.translate(r, 0);
        c.rotate(lado * 0.75);
        c.beginPath();
        c.moveTo(0, -largo * 0.12);
        c.quadraticCurveTo(largo * 0.5, -largo * 0.02 * lado, largo, 0);
        c.quadraticCurveTo(largo * 0.5, largo * 0.02 * lado, 0, largo * 0.12);
        c.closePath();
        c.fill();
        c.restore();
      }
    }
    c.restore();
  });
}

const ANILLOS: Anillo[] = [
  // Núcleo: estrella sólida de 8 puntas con agujas entre medio.
  {
    vpm: 2.4,
    alpha: 0.9,
    dibujar: (c, R) => {
      estrella(c, 8, R * 0.035, R * 0.13, true);
      espinas(c, 8, R * 0.04, R * 0.19, 0.05, 0, Math.PI / 8);
    },
  },
  // Octograma: dos cuadrados cruzados, solo contorno.
  {
    vpm: -1.5,
    alpha: 0.6,
    dibujar: (c, R) => {
      estrella(c, 8, R * 0.17, R * 0.27, false, 1.6);
      estrella(c, 8, R * 0.2, R * 0.24, false, 0.8);
    },
  },
  // Corona de espinas de largos dispares.
  {
    vpm: 1,
    alpha: 0.55,
    dibujar: (c, R) => {
      espinasPatron(c, 24, R * 0.25, R * 0.26, [1, 0.35, 0.6, 0.35, 0.8, 0.35], 0.045);
    },
  },
  // Garras curvas.
  {
    vpm: 0.7,
    alpha: 0.4,
    dibujar: (c, R) => {
      espinas(c, 12, R * 0.3, R * 0.52, 0.05, 0.42, Math.PI / 12);
    },
  },
  // Silueta épica: 4 brazos enormes y 4 medianos, todos con púas (forma de rosa de los vientos).
  {
    vpm: -0.35,
    alpha: 0.7,
    dibujar: (c, R) => {
      brazos(c, 4, R * 0.12, R * 0.99, 0.045, R * 0.13);
      brazos(c, 4, R * 0.12, R * 0.68, 0.04, R * 0.09, Math.PI / 4);
    },
  },
  // Estrella fantasma de 12 puntas muy tenue detrás de todo.
  {
    vpm: 0.2,
    alpha: 0.22,
    dibujar: (c, R) => {
      estrella(c, 12, R * 0.42, R * 0.86, false, 1.2);
      espinasPatron(c, 12, R * 0.6, R * 0.32, [1, 0.5], 0.03, 0);
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
