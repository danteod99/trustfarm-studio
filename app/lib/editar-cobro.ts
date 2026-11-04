import { randomUUID } from "crypto";
import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/app/lib/auth";
import { addCredits, chargeCredits } from "@/app/lib/credits";

/** Cobro de una acción de /editar, con reembolso idempotente si después falla. */
export interface Cobro {
  /** Créditos cobrados (0 si es admin). */
  amount: number;
  ref: string;
  refund: (why: string) => Promise<void>;
}

/**
 * Cobra `amount` créditos al usuario (admins gratis). Devuelve el cobro o una Response 402/500
 * lista para devolver si no alcanza el saldo.
 */
export async function cobrar(user: User, amount: number, reason: string, refPrefix = "editar"): Promise<Cobro | Response> {
  const ref = `${refPrefix}:${randomUUID()}`;
  if (isAdminEmail(user.email)) return { amount: 0, ref, refund: async () => {} };
  const r = await chargeCredits(user.id, amount, reason, ref);
  if (!r.ok) {
    const error = r.insufficient ? `Créditos insuficientes: esto cuesta ${amount} créditos. Recarga en /creditos.` : r.error;
    return Response.json({ error, insufficient: !!r.insufficient }, { status: r.insufficient ? 402 : 500 });
  }
  return {
    amount,
    ref,
    refund: async (why: string) => {
      try {
        await addCredits(user.id, amount, "refund", `refund:${ref}`, { motivo: why });
      } catch (e) {
        console.error(`[editar] reembolso ${ref} falló:`, e);
      }
    },
  };
}
