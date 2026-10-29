import type Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import { getPack } from "@/app/lib/catalog";
import { addCredits } from "@/app/lib/credits";

// Acredita el paquete cuando Stripe confirma el pago. Idempotente por id de sesión
// (Stripe reintenta los webhooks; ai_credit ignora un ref repetido).
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return new Response("missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch (e) {
    console.error("[stripe] firma inválida:", e);
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return Response.json({ received: true, pending: true });

    const userId = session.metadata?.user_id || session.client_reference_id;
    const pack = getPack(session.metadata?.pack_id || "");
    if (!userId || !pack) {
      console.error("[stripe] sesión sin usuario/paquete:", session.id);
      return Response.json({ received: true, ignored: true });
    }
    if (session.amount_total !== Math.round(pack.priceUsd * 100)) {
      console.error(`[stripe] monto inesperado en ${session.id}: ${session.amount_total}`);
      return Response.json({ received: true, ignored: true });
    }
    try {
      await addCredits(userId, pack.credits, "stripe", `stripe:${session.id}`, {
        pack: pack.id,
        amount_usd: pack.priceUsd,
        payment_intent: session.payment_intent,
      });
    } catch (e) {
      console.error("[stripe] no se pudo acreditar:", e);
      return new Response("credit failed", { status: 500 }); // Stripe reintenta
    }
  }

  return Response.json({ received: true });
}
