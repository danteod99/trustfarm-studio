import { IDEAS, type Idea } from "@/app/lib/ideas";
import { combinarIdeas, type FilaIdea, type IdeaAdmin } from "@/app/lib/ideas-datos";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

// Lectura de ideas en el servidor. Si la base falla, tarda o aún no tiene la tabla, /ideas sigue
// funcionando con las del archivo: la página nunca depende de la base.
const TOPE_LECTURA_MS = 3000;

const esTablaFaltante = (e: { code?: string; message?: string }) =>
  e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? "");

async function leerFilas(): Promise<{ filas: FilaIdea[]; faltaTabla: boolean; caida: boolean }> {
  try {
    const { data, error } = await supabaseAdmin().from("ideas").select("*").abortSignal(AbortSignal.timeout(TOPE_LECTURA_MS));
    if (error) {
      const faltaTabla = esTablaFaltante(error);
      if (!faltaTabla) console.error("[ideas] leer:", error.message);
      return { filas: [], faltaTabla, caida: !faltaTabla };
    }
    return { filas: (data ?? []) as FilaIdea[], faltaTabla: false, caida: false };
  } catch (e) {
    console.error("[ideas] leer:", e);
    return { filas: [], faltaTabla: false, caida: true };
  }
}

export async function ideasPublicas(): Promise<Idea[]> {
  return combinarIdeas(IDEAS, (await leerFilas()).filas).publicas;
}

export async function ideasParaAdmin(): Promise<{ ideas: IdeaAdmin[]; faltaTabla: boolean; caida: boolean }> {
  const { filas, faltaTabla, caida } = await leerFilas();
  return { ideas: combinarIdeas(IDEAS, filas).todas, faltaTabla, caida };
}
