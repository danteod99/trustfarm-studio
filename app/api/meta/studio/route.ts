import { NextResponse } from "next/server";
import { getUser } from "@/app/lib/auth";
import { EVENTOS_STUDIO, type EventoStudio } from "@/app/lib/pixel";
import { enviarEventoStudio } from "@/app/lib/pixel-server";

const texto = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : undefined);

// Copia en el servidor de los eventos del pixel de TrustFarm Studio (mismo eventID que el navegador).
export async function POST(request: Request) {
  const cuerpo = await request.json().catch(() => null);
  const evento = texto(cuerpo?.evento, 32) as EventoStudio | undefined;
  const eventId = texto(cuerpo?.eventId, 64);
  const url = texto(cuerpo?.url, 2048);
  if (!evento || !EVENTOS_STUDIO.includes(evento) || !eventId || !url) {
    return NextResponse.json({ error: "Evento no válido" }, { status: 400 });
  }
  const d = (cuerpo?.datos ?? {}) as Record<string, unknown>;
  const customData: Record<string, unknown> = {};
  if (texto(d.content_name, 80)) customData.content_name = d.content_name;
  if (typeof d.value === "number" && d.value >= 0 && d.value < 100000) customData.value = d.value;
  if (texto(d.currency, 3)) customData.currency = d.currency;

  const user = await getUser().catch(() => null);
  await enviarEventoStudio({
    evento,
    eventId,
    url,
    customData,
    email: user?.email,
    externalId: user?.id,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") ?? undefined,
    fbp: texto(cuerpo?.fbp, 256),
    fbc: texto(cuerpo?.fbc, 512),
  });
  return new NextResponse(null, { status: 204 });
}
