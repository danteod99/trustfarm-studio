import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import { PLAN } from "@/app/lib/catalog";
import { stripe } from "@/app/lib/stripe";
import { isActive, readSub } from "@/app/lib/subscription";

// Crea la sesión de Stripe Checkout del plan mensual. Los créditos los acredita el webhook
// con cada factura pagada (invoice.paid), incluida la primera.
export async function POST() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const price = process.env.STRIPE_SUB_PRICE_ID;
  if (!price) return Response.json({ error: "El plan mensual no está disponible." }, { status: 503 });

  const sub = readSub(user.app_metadata);
  if (isActive(sub)) return Response.json({ error: "Ya tienes el plan mensual activo." }, { status: 409 });

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      ...(sub?.customer ? { customer: sub.customer } : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan: PLAN.id },
      subscription_data: {
        metadata: { user_id: user.id, plan: PLAN.id },
        description: `${PLAN.name} — ${BRAND.name}`,
      },
      success_url: `${SITE_URL}/creditos?plan=ok`,
      cancel_url: `${SITE_URL}/creditos?pago=cancelado`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[suscripcion]", e);
    return Response.json({ error: "No se pudo iniciar la suscripción. Intenta de nuevo." }, { status: 500 });
  }
}
