import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { PACK_PRUEBA } from "@/app/lib/catalog";

// La oferta de $1 se puede comprar una sola vez por usuario y por tarjeta (huella de Stripe).
// Se guarda en ai_ledger.meta: { pack: "prueba", card_fp }.

// `excluirRef`: la propia compra (un reintento del webhook no debe contarse como repetida).
export async function yaUsoPrueba(userId: string, excluirRef?: string): Promise<boolean> {
  let q = supabaseAdmin()
    .from("ai_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("meta->>pack", PACK_PRUEBA.id);
  if (excluirRef) q = q.neq("ref", excluirRef);
  const { count } = await q;
  return (count ?? 0) > 0;
}

export async function tarjetaYaUsoPrueba(huella: string, excluirRef?: string): Promise<boolean> {
  let q = supabaseAdmin()
    .from("ai_ledger")
    .select("id", { count: "exact", head: true })
    .eq("meta->>pack", PACK_PRUEBA.id)
    .eq("meta->>card_fp", huella);
  if (excluirRef) q = q.neq("ref", excluirRef);
  const { count } = await q;
  return (count ?? 0) > 0;
}
