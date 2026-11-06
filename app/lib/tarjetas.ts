import type Stripe from "stripe";

// Partes puras de los pagos de "Mi cuenta" (sin imports del servidor, para poder probarlas).

/** Cliente de Stripe ya conocido del usuario, o null. Pura. */
export function clienteGuardado(appMetadata: unknown): string | null {
  const m = (appMetadata ?? {}) as { stripe_customer?: unknown };
  if (typeof m.stripe_customer === "string" && m.stripe_customer.startsWith("cus_")) return m.stripe_customer;
  const sub = (m as { studio_sub?: { customer?: unknown } }).studio_sub;
  return typeof sub?.customer === "string" && sub.customer ? sub.customer : null;
}

export interface Tarjeta {
  id: string;
  marca: string;
  ultimos4: string;
  vence: string;
  principal: boolean;
}

/** Tarjetas para mostrar en "Mi cuenta" (sin datos sensibles: marca, 4 últimos y vencimiento). Pura. */
export function aTarjetas(metodos: Stripe.PaymentMethod[], principal: string | null): Tarjeta[] {
  return metodos
    .filter((m) => m.type === "card" && m.card)
    .map((m) => ({
      id: m.id,
      marca: m.card!.brand,
      ultimos4: m.card!.last4,
      vence: `${String(m.card!.exp_month).padStart(2, "0")}/${String(m.card!.exp_year).slice(-2)}`,
      principal: m.id === principal,
    }));
}
