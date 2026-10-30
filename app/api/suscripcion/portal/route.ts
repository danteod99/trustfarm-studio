import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { SITE_URL } from "@/app/lib/brand";
import { stripe } from "@/app/lib/stripe";
import { readSub } from "@/app/lib/subscription";

// Portal de Stripe: cancelar el plan, cambiar la tarjeta y ver facturas.
export async function POST() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const sub = readSub(user.app_metadata);
  if (!sub?.customer) return Response.json({ error: "No tienes un plan mensual." }, { status: 404 });
  try {
    const portal = await stripe().billingPortal.sessions.create({ customer: sub.customer, return_url: `${SITE_URL}/creditos` });
    return Response.json({ url: portal.url });
  } catch (e) {
    console.error("[portal]", e);
    return Response.json({ error: "No se pudo abrir la gestión del plan." }, { status: 500 });
  }
}
