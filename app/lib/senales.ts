import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Señales de calidad para entrenar (supabase/14_senales_generaciones.sql). Nunca rompen el flujo:
// si la tabla aún no existe o falla la escritura, solo se anota en el log.
export type Senal = "download" | "animate" | "character" | "regenerate";

export async function registrarSenal(generationId: string, userId: string, event: Senal): Promise<void> {
  try {
    const { error } = await supabaseAdmin()
      .from("ai_generation_events")
      .upsert({ generation_id: generationId, user_id: userId, event }, { onConflict: "generation_id,event", ignoreDuplicates: true });
    if (error) console.warn("[senal]", event, error.message);
  } catch (e) {
    console.warn("[senal]", event, e);
  }
}

/** Si el usuario repite el mismo prompt con el mismo modelo a los pocos minutos, la anterior no le sirvió. */
export async function marcarRegeneracion(userId: string, model: string, prompt: string, nuevaId: string): Promise<void> {
  try {
    const desde = new Date(Date.now() - 30 * 60_000).toISOString();
    const { data } = await supabaseAdmin()
      .from("ai_generations")
      .select("id")
      .eq("user_id", userId)
      .eq("model", model)
      .eq("prompt", prompt)
      .eq("status", "done")
      .neq("id", nuevaId)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data?.[0]) await registrarSenal(data[0].id, userId, "regenerate");
  } catch (e) {
    console.warn("[senal] regenerate", e);
  }
}
