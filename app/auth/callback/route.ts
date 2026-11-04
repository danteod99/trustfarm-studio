import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/app/lib/supabase/server";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { siguienteSeguro } from "@/app/lib/siguiente";

// Vuelta de Google OAuth / enlace de confirmación de email.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = url.searchParams.get("next") || decodeURIComponent(jar.get("tf_next")?.value || "") || "/estudio";
  const safeNext = siguienteSeguro(next);
  if (code) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    await markStudioSignup(data.user);
  }
  const res = NextResponse.redirect(new URL(safeNext, url.origin));
  res.cookies.delete("tf_next");
  return res;
}

/** Una cuenta nueva aún sin origen (p. ej. Google) se marca "studio": así trustmind, que comparte
 *  Supabase, no le manda su nurture de granjas. Las cuentas viejas de trustmind no se tocan. */
async function markStudioSignup(user: { id: string; created_at?: string; user_metadata?: Record<string, unknown> } | null) {
  if (!user || user.user_metadata?.signup_source) return;
  const ageMs = Date.now() - new Date(user.created_at ?? 0).getTime();
  if (ageMs > 15 * 60 * 1000) return;
  const { error } = await supabaseAdmin().auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, signup_source: "studio" },
  });
  if (error) console.error("[auth] marcar signup_source:", error.message);
}
