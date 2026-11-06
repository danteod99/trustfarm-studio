import { NextResponse } from "next/server";
import { createServerSupabase } from "@/app/lib/supabase/server";

// Cierra la sesión. Con "todas=1" la cierra también en los demás dispositivos.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const supabase = await createServerSupabase();
  await supabase.auth.signOut({ scope: form?.get("todas") === "1" ? "global" : "local" });
  // 303: el navegador sigue con GET a la portada.
  return NextResponse.redirect(new URL("/", req.url), 303);
}
