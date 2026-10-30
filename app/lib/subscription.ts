import type Stripe from "stripe";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Estado del plan mensual, guardado en auth.users.app_metadata.studio_sub (solo lo escribe el
// servidor; el usuario no puede editar app_metadata). Así no hace falta otra tabla.

export interface StudioSub {
  customer: string;
  subscription: string;
  status: Stripe.Subscription.Status | "incomplete";
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function readSub(appMetadata: unknown): StudioSub | null {
  const s = (appMetadata as { studio_sub?: StudioSub } | null)?.studio_sub;
  return s?.subscription ? s : null;
}

export function isActive(sub: StudioSub | null): boolean {
  return !!sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
}

export async function saveSub(userId: string, patch: Partial<StudioSub>): Promise<void> {
  const db = supabaseAdmin();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error(`usuario ${userId}: ${error?.message ?? "no existe"}`);
  const prev = readSub(data.user.app_metadata) ?? ({} as Partial<StudioSub>);
  const { error: upErr } = await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, studio_sub: { ...prev, ...patch } },
  });
  if (upErr) throw new Error(`guardar suscripción: ${upErr.message}`);
}

/** Fin del período actual (en la API "basil" vive en los items de la suscripción). */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const ts = sub.items?.data?.[0]?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

export function subFields(sub: Stripe.Subscription): Partial<StudioSub> {
  return {
    customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscription: sub.id,
    status: sub.status,
    periodEnd: periodEnd(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}
