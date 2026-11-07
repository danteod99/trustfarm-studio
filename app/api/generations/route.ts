import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { publicGeneration, refreshGeneration, signedUrls, type Generation } from "@/app/lib/generations";
import { etasPara } from "@/app/lib/eta";

export const maxDuration = 60;

// Galería del usuario. ?kind=image|video, ?limit=, ?before=<created_at> para paginar.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();

  const q = new URL(req.url).searchParams;
  const limit = Math.min(Number(q.get("limit")) || 24, 60);
  let query = supabaseAdmin()
    .from("ai_generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const kind = q.get("kind");
  if (kind === "image" || kind === "video") query = query.eq("kind", kind);
  const before = q.get("before");
  if (before) query = query.lt("created_at", before);

  const { data } = await query;
  let gens = (data ?? []) as Generation[];
  // De paso avanza los trabajos en curso.
  gens = await Promise.all(gens.map((g) => (g.status === "done" || g.status === "failed" ? g : refreshGeneration(g))));
  const [urls, etas] = await Promise.all([signedUrls(gens), etasPara(gens)]);
  return Response.json({ generations: gens.map((g) => publicGeneration(g, urls[g.id], etas[g.id])) });
}
