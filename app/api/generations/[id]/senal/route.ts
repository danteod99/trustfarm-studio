import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { registrarSenal } from "@/app/lib/senales";

// El navegador avisa que el cliente descargó una generación (señal de calidad para entrenar).
// Las demás señales (animar, personaje, regenerar) las registra el servidor solo.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  const { data } = await supabaseAdmin()
    .from("ai_generations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return Response.json({ error: "No encontrada." }, { status: 404 });
  await registrarSenal(id, user.id, "download");
  return Response.json({ ok: true });
}
