// Landing de la comunidad Artificial Humans (Skool). Solo mide con su propio pixel
// y manda cada evento también por la API de conversiones (app/api/meta/evento).

export const PIXEL_COMUNIDAD = "1688292825777671";
export const SKOOL_COMUNIDAD_URL = "https://www.skool.com/artificial-humans-7653/about";
export const EVENTOS_COMUNIDAD = ["PageView", "InitiateCheckout"] as const;
export type EventoComunidad = (typeof EVENTOS_COMUNIDAD)[number];

function cookie(nombre: string) {
  return document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`))?.[1];
}

/** El mismo eventId en navegador y servidor hace que Meta cuente el evento una sola vez. */
export function eventoComunidad(evento: EventoComunidad) {
  const eventId = crypto.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbq = (window as any).fbq;
  if (typeof fbq === "function") {
    fbq("trackSingle", PIXEL_COMUNIDAD, evento, { content_name: "Artificial Humans" }, { eventID: eventId });
  }
  fetch("/api/meta/evento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ evento, eventId, url: location.href, fbp: cookie("_fbp"), fbc: cookie("_fbc") }),
  }).catch(() => {});
}
