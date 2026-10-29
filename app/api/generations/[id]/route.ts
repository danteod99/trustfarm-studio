import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { publicGeneration, refreshGeneration, signedUrls, type Generation } from "@/app/lib/generations";
import { getBalance } from "@/app/lib/credits";

export const maxDuration = 60;

// Estado de una generación; si está en curso consulta al proveedor (lo llama el navegador cada ~8 s).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;

  const { data } = await supabaseAdmin()
    .from("ai_generations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return Response.json({ error: "No encontrada." }, { status: 404 });

  const gen = await refreshGeneration(data as Generation);
  const urls = await signedUrls([gen]);
  return Response.json({ generation: publicGeneration(gen, urls[gen.id]), balance: await getBalance(user.id) });
}
