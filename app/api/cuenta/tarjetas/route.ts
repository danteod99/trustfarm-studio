import type Stripe from "stripe";
import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { SITE_URL } from "@/app/lib/brand";
import { clienteGuardado, clienteStripe } from "@/app/lib/cliente-stripe";
import { aTarjetas } from "@/app/lib/tarjetas";
import { stripe } from "@/app/lib/stripe";

// Tarjetas guardadas del usuario en Stripe. Los números nunca pasan por nuestro servidor: se
// agregan en una página de Stripe (Checkout en modo "setup").
export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const cliente = clienteGuardado(user.app_metadata);
  if (!cliente) return Response.json({ tarjetas: [] });
  try {
    const [metodos, c] = await Promise.all([
      stripe().customers.listPaymentMethods(cliente, { type: "card", limit: 20 }),
      stripe().customers.retrieve(cliente),
    ]);
    const def = c.deleted ? null : (c as Stripe.Customer).invoice_settings?.default_payment_method;
    return Response.json({ tarjetas: aTarjetas(metodos.data, typeof def === "string" ? def : def?.id ?? null) });
  } catch (e) {
    console.error("[tarjetas]", e);
    return Response.json({ error: "No se pudieron cargar tus tarjetas." }, { status: 500 });
  }
}

/** Abre la página de Stripe para agregar una tarjeta. */
export async function POST() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "setup",
      currency: "usd",
      customer: await clienteStripe(user),
      payment_method_types: ["card"],
      // Que aparezca para elegirla en las próximas compras.
      payment_method_data: { allow_redisplay: "always" },
      metadata: { user_id: user.id, tipo: "tarjeta" },
      success_url: `${SITE_URL}/cuenta?tarjeta=ok#pagos`,
      cancel_url: `${SITE_URL}/cuenta#pagos`,
    });
    return Response.json({ url: session.url });
  } catch (e) {
    console.error("[tarjetas] agregar", e);
    return Response.json({ error: "No se pudo abrir el formulario de Stripe." }, { status: 500 });
  }
}
