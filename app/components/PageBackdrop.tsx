"use client";

import { usePathname } from "next/navigation";

/**
 * Fondo común (look "Noche Yamore"): un sol ocre difuso y rombos tenues detrás de la parte de arriba de
 * cada página interna. La portada y /ideas dibujan su propio fondo, así que ahí no se pinta.
 */
export default function PageBackdrop() {
  const path = usePathname();
  if (path === "/" || path === "/ideas") return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
      <div className="absolute -top-40 right-[8%] h-80 w-80 rounded-full bg-ocre/20 blur-3xl" />
      <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-terracota/15 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(45deg, var(--color-ocre) 1px, transparent 1px), linear-gradient(-45deg, var(--color-ocre) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
