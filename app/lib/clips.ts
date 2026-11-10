import { addCredits } from "@/app/lib/credits";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Multiclipping (nube): trabajos en `clip_jobs`, clips en el bucket `clips`, procesamiento en el
// servicio trustclip (Railway, TRUSTCLIP_ORIGIN). Tabla y bucket compartidos con trustmind.online
// (mismo Supabase); los trabajos de TrustFarm llevan options.origen = "trustfarm" y options.cobro.

export const CLIPS_BUCKET = "clips";
export const YT_RE = /^https?:\/\/((www|m|music)\.)?(youtube\.com|youtu\.be)\//i;

export function trustclipOrigin(): string | null {
  const o = (process.env.TRUSTCLIP_ORIGIN || "").trim().replace(/\/+$/, "");
  return o || null;
}

export interface ClipResult {
  index: number; file: string; srt: string | null; start: number; end: number; duration: number;
  score: number | null; titulo: string; hook: string; score_reason: string; framing: string | null; size_mb: number;
}
export interface JobResult {
  clips: ClipResult[]; publication_order: number[]; selection_mode: string | null; failed: number[]; warning?: string | null;
}

/** Cobro guardado en options.cobro de un trabajo de TrustFarm. */
export interface CobroClip { creditos: number; ref: string; user_id: string; reembolsado?: boolean }

interface JobRow { id: string; status: string; options: Record<string, unknown> | null }

/**
 * Devuelve los créditos de un trabajo que no se procesó (error, o borrado antes de procesarse).
 * Idempotente: addCredits usa el mismo ref y options.cobro.reembolsado evita repetir la llamada.
 */
export async function reembolsarClip(job: JobRow, motivo: string): Promise<boolean> {
  const cobro = job.options?.cobro as CobroClip | undefined;
  if (!cobro || cobro.reembolsado || !cobro.creditos) return false;
  try {
    await addCredits(cobro.user_id, cobro.creditos, "refund", `refund:${cobro.ref}`, { motivo, job: job.id });
    await supabaseAdmin()
      .from("clip_jobs")
      .update({ options: { ...job.options, cobro: { ...cobro, reembolsado: true } } })
      .eq("id", job.id);
    return true;
  } catch (e) {
    console.error(`[clips] reembolso del trabajo ${job.id} falló:`, e);
    return false;
  }
}
