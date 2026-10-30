import { getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { readSub } from "@/app/lib/subscription";

export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { data: ledger } = await supabaseAdmin()
    .from("ai_ledger")
    .select("delta, balance_after, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return Response.json({
    email: user.email,
    admin: isAdminEmail(user.email),
    balance: await getBalance(user.id),
    ledger: ledger ?? [],
    subscription: readSub(user.app_metadata),
  });
}
