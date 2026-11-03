import { FORBIDDEN, getUser, isAdminEmail } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { isActive, readSub } from "@/app/lib/subscription";

// Admin: clientes del Studio. La base de usuarios es la de trustmind, así que cuenta como cliente quien
// se registró en el Studio (signup_source "studio") o ya tiene saldo, compras o generaciones aquí.

type Db = ReturnType<typeof supabaseAdmin>;

/** Supabase devuelve hasta 1000 filas por consulta: pide por tandas hasta traer todo. */
async function all<T>(db: Db, table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function GET() {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();
  const db = supabaseAdmin();

  const [wallets, sales, gens] = await Promise.all([
    all<{ user_id: string; credits: number }>(db, "ai_wallets", "user_id, credits"),
    all<{ user_id: string; meta: { amount_usd?: number } | null }>(db, "ai_ledger", "user_id, meta", (q) => q.eq("reason", "stripe")),
    all<{ user_id: string; created_at: string }>(db, "ai_generations", "user_id, created_at"),
  ]);

  const credits = new Map(wallets.map((w) => [w.user_id, w.credits]));
  const spent = new Map<string, { usd: number; n: number }>();
  for (const s of sales) {
    const t = spent.get(s.user_id) ?? { usd: 0, n: 0 };
    t.usd += Number(s.meta?.amount_usd) || 0;
    t.n++;
    spent.set(s.user_id, t);
  }
  const used = new Map<string, { n: number; last: string }>();
  for (const g of gens) {
    const t = used.get(g.user_id) ?? { n: 0, last: g.created_at };
    t.n++;
    if (g.created_at > t.last) t.last = g.created_at;
    used.set(g.user_id, t);
  }

  const clientes = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    for (const u of data.users) {
      const studio = u.user_metadata?.signup_source === "studio";
      if (!studio && !credits.has(u.id) && !spent.has(u.id) && !used.has(u.id)) continue;
      const sub = readSub(u.app_metadata);
      clientes.push({
        id: u.id,
        email: u.email ?? "",
        nombre: (u.user_metadata?.full_name || u.user_metadata?.name || "") as string,
        origen: studio ? "studio" : "trustmind",
        alta: u.created_at,
        ultimoIngreso: u.last_sign_in_at ?? null,
        creditos: credits.get(u.id) ?? 0,
        pagadoUsd: Math.round((spent.get(u.id)?.usd ?? 0) * 100) / 100,
        compras: spent.get(u.id)?.n ?? 0,
        generaciones: used.get(u.id)?.n ?? 0,
        ultimaGeneracion: used.get(u.id)?.last ?? null,
        plan: isActive(sub) ? (sub!.cancelAtPeriodEnd ? "cancela" : "activo") : null,
      });
    }
    if (data.users.length < 1000) break;
  }
  clientes.sort((a, b) => b.alta.localeCompare(a.alta));
  return Response.json({ clientes });
}
