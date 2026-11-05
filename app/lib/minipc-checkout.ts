// Lógica pura del checkout de la mini PC (TRUST Assistant).
// Se ejecuta directo con Node (strip-types): imports relativos con .ts, sin enum.

import type Stripe from 'stripe'
import { getPlan, reservaCentavos, saldoUsd, PAISES_ENVIO, ENTREGA_TEXTO, RESERVA_USD } from './minipc.ts'
import type { Plan } from './minipc.ts'

export type ResultadoCompra =
  | { ok: true; plan: Plan }
  | { ok: false; status: 400 | 401 | 503; error: string }

/** Orden estricto de compuertas: venta cerrada (503) → sin sesión (401) → plan inválido o inactivo (400). */
export function validarCompra(o: {
  venta: boolean
  userId: string | null | undefined
  planId: unknown
}): ResultadoCompra {
  if (!o.venta) return { ok: false, status: 503, error: 'Las ventas aún no están abiertas.' }
  if (!o.userId) return { ok: false, status: 401, error: 'Inicia sesión para continuar.' }
  const plan = getPlan(o.planId)
  if (!plan || !plan.activo) return { ok: false, status: 400, error: 'Ese plan no está disponible.' }
  return { ok: true, plan }
}

export function armarSesionMinipc(o: {
  plan: Plan
  userId: string
  email: string | undefined
  siteUrl: string
}): Stripe.Checkout.SessionCreateParams {
  const { plan, userId, email, siteUrl } = o
  const metadata = { kind: 'minipc', tipo: 'reserva', plan_id: plan.id, user_id: userId }
  // OJO: sin `allow_promotion_codes` ni `discounts`. Un cupón del 100 % deja la sesión en
  // payment_status 'no_payment_required' y el webhook no la guarda como pedido.
  const sesion: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_creation: 'always',
    client_reference_id: userId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: reservaCentavos(),
          product_data: {
            name: `Reserva TRUST Assistant — Plan ${plan.nombre}`,
            description: `Separa tu equipo (${plan.equipo} · ${plan.memoria}). Los $${RESERVA_USD} se descuentan del precio de $${plan.precioUsd}: el saldo de $${saldoUsd(plan)} se paga al coordinar la entrega (${ENTREGA_TEXTO}). Mensualidad de $${plan.mensualUsd} desde que activas tu caja.`,
          },
        },
      },
    ],
    shipping_address_collection: {
      allowed_countries: [...PAISES_ENVIO] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[],
    },
    phone_number_collection: { enabled: true },
    payment_intent_data: { setup_future_usage: 'off_session', metadata: { ...metadata } },
    metadata,
    success_url: `${siteUrl}/minipc/gracias`,
    cancel_url: `${siteUrl}/minipc`,
    locale: 'es-419',
  }
  if (email) sesion.customer_email = email
  return sesion
}
