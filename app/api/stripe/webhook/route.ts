import type Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import { PLAN, getPack } from "@/app/lib/catalog";
import { addCredits } from "@/app/lib/credits";
import { enviarEventoStudio } from "@/app/lib/pixel-server";
import { SITE_URL } from "@/app/lib/brand";
import { decidirRama, procesarSesionMinipc } from "@/app/lib/minipc-pedidos";
import { pedidosStoreSupabase } from "@/app/lib/minipc-store-supabase";
import { saveSub, subFields } from "@/app/lib/subscription";

// Paquetes: acredita cuando Stripe confirma el pago (idempotente por id de sesión).
// Plan mensual: acredita PLAN.credits con cada factura pagada (idempotente por id de factura)
// y guarda el estado de la suscripción. Stripe reintenta; ai_credit ignora un ref repetido.
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

  if (event.type === "invoice.paid") return invoicePaid(event.data.object as Stripe.Invoice);
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.user_id;
    if (userId) {
      try {
        await saveSub(userId, subFields(sub));
      } catch (e) {
        console.error("[stripe] guardar suscripción:", e);
        return new Response("save failed", { status: 500 });
      }
    }
    return Response.json({ received: true });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription") {
      // Los créditos llegan con invoice.paid; aquí solo se enlaza la suscripción a la cuenta.
      const userId = session.metadata?.user_id || session.client_reference_id;
      if (userId && session.subscription) {
        try {
          const sub = await stripe().subscriptions.retrieve(String(session.subscription));
          await saveSub(userId, subFields(sub));
        } catch (e) {
          console.error("[stripe] enlazar suscripción:", e);
          return new Response("save failed", { status: 500 });
        }
      }
      return Response.json({ received: true });
    }
    if (session.payment_status !== "paid") return Response.json({ received: true, pending: true });

    // Mini PC: rama aparte; retorna antes de leer user_id/pack de créditos.
    if (decidirRama(session) === "minipc") {
      try {
        const resultado = await procesarSesionMinipc({ store: pedidosStoreSupabase(), log: console.error }, session);
        if (resultado.resultado === "pendiente") return Response.json({ received: true, pending: true });
        return Response.json({ received: true, minipc: resultado });
      } catch (e) {
        // Mensaje fijo + código SQLSTATE (o el aviso de entorno de supabaseAdmin): sin datos personales.
        console.error("[stripe] no se pudo guardar el pedido de mini PC:", session.id, e instanceof Error ? e.message : "error");
        return new Response("pedido failed", { status: 500 }); // Stripe reintenta
      }
    }

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
    // Pixel: compra real con monto (event_id = sesión de Stripe, así un reintento no duplica).
    await enviarEventoStudio({
      evento: "Purchase",
      eventId: `stripe:${session.id}`,
      url: `${SITE_URL}/creditos`,
      customData: { value: pack.priceUsd, currency: "USD", content_name: `Paquete ${pack.name}` },
      email: session.customer_details?.email,
      externalId: userId,
    });
  }

  return Response.json({ received: true });
}

async function invoicePaid(inv: Stripe.Invoice) {
  // API 2025+ (basil) lo trae en parent; versiones anteriores, en inv.subscription.
  const subId = inv.parent?.subscription_details?.subscription ?? (inv as unknown as { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!subId) return Response.json({ received: true, ignored: true });
  try {
    const sub = await stripe().subscriptions.retrieve(typeof subId === "string" ? subId : subId.id);
    const userId = sub.metadata?.user_id;
    if (!userId || sub.metadata?.plan !== PLAN.id) {
      console.error("[stripe] factura de suscripción sin usuario/plan:", inv.id);
      return Response.json({ received: true, ignored: true });
    }
    if (inv.amount_paid <= 0) return Response.json({ received: true, ignored: true }); // p. ej. factura en $0
    await addCredits(userId, PLAN.credits, "stripe", `stripe:${inv.id}`, {
      plan: PLAN.id,
      amount_usd: inv.amount_paid / 100,
      invoice: inv.id,
      subscription: sub.id,
      billing_reason: inv.billing_reason,
    });
    await saveSub(userId, subFields(sub));
    // Pixel: solo la primera factura cuenta como alta (las renovaciones no vienen de un anuncio).
    if (inv.billing_reason === "subscription_create") {
      const base = { url: `${SITE_URL}/creditos`, email: inv.customer_email, externalId: userId };
      const customData = { value: inv.amount_paid / 100, currency: (inv.currency || "usd").toUpperCase(), content_name: PLAN.name };
      await enviarEventoStudio({ ...base, evento: "Subscribe", eventId: `stripe-sub:${inv.id}`, customData });
      await enviarEventoStudio({ ...base, evento: "Purchase", eventId: `stripe:${inv.id}`, customData });
    }
  } catch (e) {
    console.error("[stripe] factura del plan:", e);
    return new Response("credit failed", { status: 500 }); // Stripe reintenta
  }
  return Response.json({ received: true });
}
