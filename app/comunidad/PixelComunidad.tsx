"use client";

import { useEffect, useRef } from "react";
import { PIXEL_COMUNIDAD, eventoComunidad } from "@/app/lib/comunidad";

/** Carga el pixel si la web no lo trae e inicia el de la comunidad, una sola vez por visita. */
export default function PixelComunidad() {
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.fbq) {
      const fbq = function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      } as ((...args: unknown[]) => void) & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      w.fbq = w._fbq = fbq;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    w.fbq("init", PIXEL_COMUNIDAD);
    eventoComunidad("PageView");
  }, []);

  return null;
}
