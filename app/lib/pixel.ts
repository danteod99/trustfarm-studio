// Pixel de Meta de TrustFarm Studio (cuenta CP5). Cada evento del navegador se manda también por la
// API de conversiones (app/api/meta/studio) con el mismo eventID: Meta lo cuenta una sola vez.
// Las compras (Purchase/Subscribe) salen solo del servidor, desde el webhook de Stripe (pixel-server.ts).
// /comunidad usa su propio pixel (app/lib/comunidad.ts); por eso aquí todo va con trackSingle.

export const PIXEL_STUDIO = "2270180786884454";
export const EVENTOS_STUDIO = ["PageView", "ViewContent", "CompleteRegistration", "InitiateCheckout"] as const;
export type EventoStudio = (typeof EVENTOS_STUDIO)[number];

export interface DatosEvento {
  content_name?: string;
  value?: number;
  currency?: string;
}

function cookie(nombre: string) {
  return document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`))?.[1];
}

/** Carga fbevents.js si la página aún no lo trae e inicia el pixel del estudio (idempotente). */
export function iniciarPixelStudio() {
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
  if (!w.__pixelStudio) {
    w.__pixelStudio = true;
    w.fbq("init", PIXEL_STUDIO);
  }
}

export function eventoStudio(evento: EventoStudio, datos: DatosEvento = {}) {
  if (typeof window === "undefined") return;
  iniciarPixelStudio();
  const eventId = crypto.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fbq("trackSingle", PIXEL_STUDIO, evento, datos, { eventID: eventId });
  fetch("/api/meta/studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ evento, eventId, url: location.href, datos, fbp: cookie("_fbp"), fbc: cookie("_fbc") }),
  }).catch(() => {});
}
