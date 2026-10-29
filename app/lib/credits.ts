import { supabaseAdmin } from "@/app/lib/supabase/admin";

export async function getBalance(userId: string): Promise<number> {
  const { data } = await supabaseAdmin().from("ai_wallets").select("credits").eq("user_id", userId).maybeSingle();
  return data?.credits ?? 0;
}

export type ChargeResult = { ok: true; balance: number } | { ok: false; error: string; insufficient?: boolean };

/** Cobra créditos de forma atómica (falla si no alcanza el saldo). */
export async function chargeCredits(userId: string, amount: number, reason: string, ref?: string): Promise<ChargeResult> {
  const { data, error } = await supabaseAdmin().rpc("ai_charge", {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref ?? null,
  });
  if (error) {
    if (error.message?.includes("insufficient_credits")) {
      const balance = await getBalance(userId);
      return {
        ok: false,
        insufficient: true,
        error: `Créditos insuficientes: esta generación cuesta ${amount} y tienes ${balance}.`,
      };
    }
    console.error(`[credits] cobro "${reason}" falló:`, error.message);
    return { ok: false, error: "No se pudo procesar el cobro. Intenta de nuevo." };
  }
  return { ok: true, balance: Number(data) || 0 };
}

/** Abona créditos. Con el mismo `ref` solo se aplica una vez (webhooks repetidos, reembolsos dobles). */
export async function addCredits(
  userId: string,
  amount: number,
  reason: string,
  ref: string,
  meta: Record<string, unknown> = {}
): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc("ai_credit", {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
    p_meta: meta,
  });
  if (error) throw new Error(`ai_credit: ${error.message}`);
  return Number(data) || 0;
}
