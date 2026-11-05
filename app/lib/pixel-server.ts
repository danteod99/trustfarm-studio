import { createHash } from "node:crypto";
import { PIXEL_STUDIO } from "@/app/lib/pixel";

// API de conversiones del pixel de TrustFarm Studio. Token: META_CAPI_TOKEN (usuario del sistema de Meta).
// Nunca lanza: si Meta falla, se registra y la venta/visita sigue su curso.

const sha = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

export interface EventoServidor {
  evento: string;
  eventId: string;
  url: string;
  customData?: Record<string, unknown>;
  email?: string | null;
  externalId?: string | null;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
}

/** IP, navegador y cookies del pixel de una request: Meta los necesita para atribuir eventos
 *  "website" que salen del servidor (compras del webhook, registros con Google). */
export function datosNavegador(req: Request): Pick<EventoServidor, "ip" | "userAgent" | "fbp" | "fbc"> {
  const cookies = req.headers.get("cookie") ?? "";
  const cookie = (n: string) => cookies.match(new RegExp(`(?:^|;\\s*)${n}=([^;]+)`))?.[1];
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    userAgent: req.headers.get("user-agent")?.slice(0, 450) || undefined,
    fbp: cookie("_fbp")?.slice(0, 256),
    fbc: cookie("_fbc")?.slice(0, 450),
  };
}

/** Para guardar en la metadata de Stripe (solo strings, máx. 500 caracteres) y leerlo en el webhook. */
export function navegadorAMetadata(req: Request): Record<string, string> {
  const d = datosNavegador(req);
  const out: Record<string, string> = {};
  if (d.ip) out.meta_ip = d.ip;
  if (d.userAgent) out.meta_ua = d.userAgent;
  if (d.fbp) out.meta_fbp = d.fbp;
  if (d.fbc) out.meta_fbc = d.fbc;
  return out;
}

export function navegadorDeMetadata(md: Record<string, string> | null | undefined): Pick<EventoServidor, "ip" | "userAgent" | "fbp" | "fbc"> {
  return { ip: md?.meta_ip, userAgent: md?.meta_ua, fbp: md?.meta_fbp, fbc: md?.meta_fbc };
}

export async function enviarEventoStudio(e: EventoServidor): Promise<void> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;
  try {
    const r = await fetch(`https://graph.facebook.com/v23.0/${PIXEL_STUDIO}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
        data: [
          {
            event_name: e.evento,
            event_id: e.eventId,
            event_time: Math.floor(Date.now() / 1000),
            action_source: "website",
            event_source_url: e.url,
            custom_data: e.customData,
            user_data: {
              em: e.email ? [sha(e.email)] : undefined,
              external_id: e.externalId ? [sha(e.externalId)] : undefined,
              client_ip_address: e.ip,
              client_user_agent: e.userAgent,
              fbp: e.fbp,
              fbc: e.fbc,
            },
          },
        ],
      }),
    });
    if (!r.ok) console.error("[meta] API de conversiones:", r.status, (await r.text()).slice(0, 300));
  } catch (err) {
    console.error("[meta] API de conversiones:", err instanceof Error ? err.message : err);
  }
}
