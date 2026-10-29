import { NextResponse } from "next/server";
import { createServerSupabase } from "@/app/lib/supabase/server";

// Vuelta de Google OAuth / enlace de confirmación de email.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/estudio";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/estudio";
  if (code) {
    const supabase = await createServerSupabase();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
