import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { createApiKey } from "@/app/lib/apikeys";

// Claves de API del usuario (desde la web, con sesión).
export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { data } = await supabaseAdmin()
    .from("ai_api_keys")
    .select("id, name, prefix, created_at, last_used_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return Response.json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { name } = await req.json().catch(() => ({}));
  const r = await createApiKey(user.id, String(name ?? ""));
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });
  return Response.json({ key: r.key, row: r.row }); // la clave completa se muestra solo esta vez
}
