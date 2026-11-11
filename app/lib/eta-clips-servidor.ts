import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { ritmoDe, type MuestraClip, type RitmoClips } from "@/app/lib/eta-clips";

/** Cuántos trabajos terminados recientes se miran. */
const MUESTRAS = 60;
/** El ritmo se recalcula como mucho cada 5 min (por instancia del servidor). */
const CACHE_MS = 5 * 60 * 1000;

let cache: { at: number; ritmo: RitmoClips } | null = null;

/** Ritmo real del servicio de clips según los últimos trabajos terminados (de cualquier usuario). */
export async function ritmoClips(): Promise<RitmoClips> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ritmo;
  try {
    const { data } = await supabaseAdmin()
      .from("clip_jobs")
      .select("created_at, finished_at, input_bytes, options")
      .eq("status", "listo")
      .not("finished_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(MUESTRAS);
    const muestras: MuestraClip[] = (data ?? []).map(
      (r: { created_at: string; finished_at: string; input_bytes: number | null; options: { duracion_seg?: number } | null }) => ({
        seg: (new Date(r.finished_at).getTime() - new Date(r.created_at).getTime()) / 1000,
        duracionSeg: r.options?.duracion_seg ?? null,
        bytes: r.input_bytes,
      })
    );
    const ritmo = ritmoDe(muestras);
    cache = { at: Date.now(), ritmo };
    return ritmo;
  } catch (e) {
    console.error("[eta clips]", e);
    return { porSegVideo: null, porMB: null };
  }
}
