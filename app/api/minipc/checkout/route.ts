import { getUser } from "@/app/lib/auth";
import { SITE_URL } from "@/app/lib/brand";
import { stripe } from "@/app/lib/stripe";
import { ventaAbierta } from "@/app/lib/minipc";
import { armarSesionMinipc, validarCompra } from "@/app/lib/minipc-checkout";

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

// Crea la sesión de Stripe Checkout de la mini PC. Solo acepta `planId`: usuario, email y precio salen del servidor.
export async function POST(req: Request) {
  const venta = ventaAbierta({ MINIPC_VENTA_ACTIVA: process.env.MINIPC_VENTA_ACTIVA });
  // Con la venta cerrada ni se consulta la sesión: 503 gana siempre.
  const user = venta ? await getUser() : null;
  const body: unknown = await req.json().catch(() => ({}));
  const planId = body && typeof body === "object" ? (body as { planId?: unknown }).planId : undefined;

  const v = validarCompra({ venta, userId: user?.id, planId });
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status, headers: HEADERS });

  try {
    const session = await stripe().checkout.sessions.create(
      armarSesionMinipc({ plan: v.plan, userId: user!.id, email: user!.email ?? undefined, siteUrl: SITE_URL }),
    );
    return Response.json({ url: session.url }, { headers: HEADERS });
  } catch (e) {
    const err = e as { type?: unknown; code?: unknown };
    console.error("[minipc/checkout]", { type: err?.type, code: err?.code });
    return Response.json(
      { error: "No se pudo iniciar el pago. Inténtalo de nuevo." },
      { status: 500, headers: HEADERS },
    );
  }
}
