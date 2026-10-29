import { FORBIDDEN, getUser, isAdminEmail } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Admin: ventas y uso de los últimos 30 días.
export async function GET() {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const db = supabaseAdmin();
  const [{ data: sales }, { data: gens }] = await Promise.all([
    db.from("ai_ledger").select("user_id, delta, meta, created_at").eq("reason", "stripe").gte("created_at", since),
    db.from("ai_generations").select("model, status, cost_credits").gte("created_at", since),
  ]);

  const revenue = (sales ?? []).reduce((s, r: any) => s + (Number(r.meta?.amount_usd) || 0), 0);
  const byModel: Record<string, { total: number; failed: number; credits: number }> = {};
  for (const g of gens ?? []) {
    const m = (byModel[g.model] ??= { total: 0, failed: 0, credits: 0 });
    m.total++;
    if (g.status === "failed") m.failed++;
    else m.credits += g.cost_credits;
  }
  return Response.json({
    revenueUsd: revenue,
    purchases: sales?.length ?? 0,
    buyers: new Set((sales ?? []).map((s: any) => s.user_id)).size,
    byModel,
  });
}
