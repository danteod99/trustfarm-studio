import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/app/lib/supabase/server";

// Vuelta de Google OAuth / enlace de confirmación de email.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const jar = await cookies();
  const next = url.searchParams.get("next") || decodeURIComponent(jar.get("tf_next")?.value || "") || "/estudio";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/estudio";
  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const res = NextResponse.redirect(new URL(safeNext, url.origin));
  res.cookies.delete("tf_next");
  return res;
}
