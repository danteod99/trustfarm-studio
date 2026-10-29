import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { getPack } from "@/app/lib/catalog";
import { BRAND, SITE_URL } from "@/app/lib/brand";
import { stripe } from "@/app/lib/stripe";

// Crea una sesión de Stripe Checkout para un paquete de créditos (pago único).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();

  const { pack: packId } = await req.json().catch(() => ({}));
  const pack = getPack(String(packId || ""));
  if (!pack) return Response.json({ error: "Paquete no válido." }, { status: 400 });

  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(pack.priceUsd * 100),
            product_data: {
              name: `${pack.credits} créditos de generación IA — ${BRAND.name}`,
              description: "Créditos prepagados para generar imágenes y videos con IA.",
            },
          },
        },
      ],
      metadata: { user_id: user.id, pack_id: pack.id },
      payment_intent_data: { metadata: { user_id: user.id, pack_id: pack.id } },
      success_url: `${SITE_URL}/creditos?pago=ok`,
      cancel_url: `${SITE_URL}/creditos?pago=cancelado`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[checkout]", e);
    return Response.json({ error: "No se pudo iniciar el pago. Intenta de nuevo." }, { status: 500 });
  }
}
