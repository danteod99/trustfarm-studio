"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { eventoStudio, type DatosEvento, type EventoStudio } from "@/app/lib/pixel";

/** PageView del pixel del estudio en cada cambio de página (menos /comunidad, que mide con su propio pixel). */
export default function PixelStudio() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/comunidad")) return;
    eventoStudio("PageView");
  }, [path]);
  return null;
}

/** Dispara un evento una vez al montar la página (p. ej. ViewContent en /granjas). */
export function EventoAlVer({ evento, datos }: { evento: EventoStudio; datos?: DatosEvento }) {
  useEffect(() => {
    eventoStudio(evento, datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
