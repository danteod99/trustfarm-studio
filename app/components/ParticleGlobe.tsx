"use client";

import { useEffect, useRef } from "react";

/**
 * Globo de puntos que gira despacio (el mismo efecto del hero de trustmind.online).
 * Puntos en una esfera de Fibonacci, más brillantes los de adelante. Sin animación si el
 * usuario pidió reducir movimiento.
 */
export default function ParticleGlobe({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const N = 1100;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(t) * r, y, z: Math.sin(t) * r, s: 0.6 + ((i * 7919) % 100) / 100 };
    });
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, angle = 0.6;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.46;
      const cx = w / 2, cy = h / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle), tilt = 0.35;
      for (const p of pts) {
        const x = p.x * cos - p.z * sin;
        let z = p.x * sin + p.z * cos;
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
        z = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const depth = (z + 1) / 2; // 0 atrás · 1 adelante
        ctx.globalAlpha = 0.08 + depth * 0.75;
        ctx.fillStyle = depth > 0.55 ? "#d4d4d4" : "#ffffff";
        ctx.beginPath();
        ctx.arc(cx + x * R, cy + y * R, p.s * (0.6 + depth * 1.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function loop() {
      angle += 0.0018;
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    if (still) draw();
    else loop();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none h-full w-full ${className}`} />;
}
