"use client";

import { usePathname } from "next/navigation";
import Aurora from "@/app/components/fx/Aurora";

/**
 * Fondo futurista común (aurora suave + rejilla tenue) detrás de la parte de arriba de cada página.
 * La portada y /ideas tienen su propio fondo animado, así que ahí no se dibuja.
 */
export default function PageBackdrop() {
  const path = usePathname();
  if (path === "/" || path === "/ideas") return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] overflow-hidden">
      <div className="absolute inset-0 opacity-35">
        <Aurora colorStops={["#ffffff", "#d4d4d4", "#737373"]} amplitude={0.9} blend={0.7} speed={0.4} />
      </div>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #a3a3a3 1px, transparent 1px), linear-gradient(to bottom, #a3a3a3 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
