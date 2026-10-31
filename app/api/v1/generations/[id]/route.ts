import { apiCaller, apiError, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { publicGeneration, refreshGeneration, signedUrls, type Generation } from "@/app/lib/generations";

export const maxDuration = 60;

// GET /api/v1/generations/{id} — estado; cuando status = "done", url trae el archivo (enlace válido 1 h).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  const { id } = await ctx.params;
  const { data } = await supabaseAdmin().from("ai_generations").select("*").eq("id", id).eq("user_id", c.userId).maybeSingle();
  if (!data) return apiError(404, "No existe esa generación.", "not_found");
  const gen = await refreshGeneration(data as Generation);
  const urls = await signedUrls([gen]);
  return Response.json({ generation: publicGeneration(gen, urls[gen.id]) });
}
