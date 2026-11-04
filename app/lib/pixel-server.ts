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
