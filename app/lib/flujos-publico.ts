import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { publicGeneration, signedUrls, type Generation } from "@/app/lib/generations";
import type { FlowRun } from "@/app/lib/flujos";

/** Lo que ve el usuario de una corrida: pasos con su generación (y enlace cuando está lista). */
export async function publicRun(run: FlowRun) {
  const { data } = run.generations.length
    ? await supabaseAdmin().from("ai_generations").select("*").in("id", run.generations)
    : { data: [] };
  const gens = (data ?? []) as Generation[];
  const urls = await signedUrls(gens);
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    step: run.step,
    error: run.error,
    loop_id: run.loop_id,
    created_at: run.created_at,
    steps: run.steps.map((s, i) => {
      const g = gens.find((x) => x.id === run.generations[i]);
      return { title: s.title, model: s.model, generation: g ? publicGeneration(g, urls[g.id]) : null };
    }),
  };
}
