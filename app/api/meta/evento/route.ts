import { NextResponse } from "next/server";
import { EVENTOS_COMUNIDAD, PIXEL_COMUNIDAD, type EventoComunidad } from "@/app/lib/comunidad";

const texto = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);

// API de conversiones: copia en el servidor de los eventos del pixel de la comunidad.
export async function POST(request: Request) {
  const token = process.env.META_CAPI_TOKEN;
  const cuerpo = await request.json().catch(() => null);
  const evento = texto(cuerpo?.evento, 32) as EventoComunidad | undefined;
  const eventId = texto(cuerpo?.eventId, 64);
  const url = texto(cuerpo?.url, 2048);
  if (!evento || !EVENTOS_COMUNIDAD.includes(evento) || !eventId || !url) {
    return NextResponse.json({ error: "Evento no válido" }, { status: 400 });
  }
  // Sin token la landing sigue midiendo con el pixel del navegador.
  if (!token) return new NextResponse(null, { status: 204 });

  const respuesta = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_COMUNIDAD}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
      data: [
        {
          event_name: evento,
          event_id: eventId,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: url,
          custom_data: { content_name: "Artificial Humans" },
          user_data: {
            client_ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
            client_user_agent: request.headers.get("user-agent") ?? undefined,
            fbp: texto(cuerpo?.fbp, 256),
            fbc: texto(cuerpo?.fbc, 512),
          },
        },
      ],
    }),
  });
  if (!respuesta.ok) console.error("API de conversiones:", respuesta.status, await respuesta.text());
  return new NextResponse(null, { status: 204 });
}
