import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";
import { EN_VIVO_CREDITOS, refBloque } from "@/app/lib/en-vivo";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Cobro del Clipeo en vivo: EN_VIVO_CREDITOS por cada bloque de 10 minutos de transmisión.
// La ref del cobro es única en ai_ledger, así que reintentos o trozos del mismo bloque no
// vuelven a cobrar: el segundo intento choca con la ref y se toma como "ya pagado".

export type CobroBloque = { ok: true; cobrado: number } | { ok: false; res: Response };

export async function cobrarBloque(user: User, sesion: string, bloque: number): Promise<CobroBloque> {
  if (isAdminEmail(user.email)) return { ok: true, cobrado: 0 };
  const ref = refBloque(user.id, sesion, bloque);
  const db = supabaseAdmin();
  const { data: previo } = await db.from("ai_ledger").select("id").eq("ref", ref).maybeSingle();
  if (previo) return { ok: true, cobrado: 0 };
  const { error } = await db.rpc("ai_charge", { p_user: user.id, p_amount: EN_VIVO_CREDITOS, p_reason: "editar:en-vivo", p_ref: ref });
  if (!error) return { ok: true, cobrado: EN_VIVO_CREDITOS };
  if (/duplicate key|unique/i.test(error.message || "")) return { ok: true, cobrado: 0 };
  if (error.message?.includes("insufficient_credits")) {
    const saldo = await getBalance(user.id);
    return {
      ok: false,
      res: Response.json(
        { error: `Créditos insuficientes: cada 10 minutos en vivo cuestan ${EN_VIVO_CREDITOS} créditos y tienes ${saldo}. Recarga en /creditos.`, insufficient: true },
        { status: 402 },
      ),
    };
  }
  console.error("[en-vivo] cobro falló:", error.message);
  return { ok: false, res: Response.json({ error: "No se pudo procesar el cobro. Intenta de nuevo." }, { status: 500 }) };
}

/** ¿Ya se pagó este bloque? (los momentos solo se buscan sobre bloques pagados). */
export async function bloquePagado(user: User, sesion: string, bloque: number): Promise<boolean> {
  if (isAdminEmail(user.email)) return true;
  const { data } = await supabaseAdmin().from("ai_ledger").select("id").eq("ref", refBloque(user.id, sesion, bloque)).maybeSingle();
  return !!data;
}
