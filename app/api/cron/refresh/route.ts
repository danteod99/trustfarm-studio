import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { refreshGeneration, type Generation } from "@/app/lib/generations";

export const maxDuration = 300;

// Respaldo: avanza trabajos en curso aunque el usuario haya cerrado la pestaña
// (y reembolsa los que se pasaron de tiempo). Vercel Cron lo llama cada 5 min.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const { data } = await supabaseAdmin()
    .from("ai_generations")
    .select("*")
    .in("status", ["queued", "running", "finalizing"])
    .order("created_at", { ascending: true })
    .limit(25);
  const results = await Promise.all(((data ?? []) as Generation[]).map(refreshGeneration));
  return Response.json({ checked: results.length, done: results.filter((g) => g.status === "done").length });
}
