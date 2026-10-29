import { FORBIDDEN, getUser, isAdminEmail } from "@/app/lib/auth";
import { addCredits } from "@/app/lib/credits";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Admin: regalar créditos a un usuario por email (pagos manuales, promos, compensaciones).
export async function POST(req: Request) {
  const admin = await getUser();
  if (!admin || !isAdminEmail(admin.email)) return FORBIDDEN();

  const { email, credits, note } = await req.json().catch(() => ({}));
  const amount = Math.floor(Number(credits));
  if (!email || !amount || amount <= 0 || amount > 100000) {
    return Response.json({ error: "Email y cantidad válida requeridos." }, { status: 400 });
  }

  const { data: userId, error } = await supabaseAdmin().rpc("ai_user_id_by_email", { p_email: String(email).trim() });
  if (error || !userId) return Response.json({ error: "No existe un usuario con ese email." }, { status: 404 });

  const balance = await addCredits(userId as string, amount, "admin", `admin:${Date.now()}:${userId}`, {
    note: note || null,
    admin: admin.email,
  });
  return Response.json({ ok: true, balance });
}
