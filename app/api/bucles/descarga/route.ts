import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { CLIPS_BUCKET } from "@/app/lib/clips";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POR_LLAMADA = 10;

// POST { ya: string[] }: entregas del usuario (de cualquiera de sus bucles) que siguen en la nube (no vencidas ni
// purgadas), excluyendo las ids que el navegador ya guardó. Devuelve hasta 10 con URL firmada de 1 h + cuántas quedan.
// SOLO LEE: no usa claim/ack ni cambia el estado (el desktop puede seguir recogiendo las mismas entregas).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const body = (await req.json().catch(() => ({}))) as { ya?: unknown };
  const ya = new Set((Array.isArray(body.ya) ? body.ya : []).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 3000));
  const db = supabaseAdmin();
  const { data, error } = await db.from("tool_deliveries")
    .select("id, loop_id, titulo, caption, storage_path, bytes, created_at")
    .eq("owner", user.id).is("purged_at", null).in("status", ["pending_pickup", "picked", "delivered"])
    .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: true }).limit(500);
  if (error) return Response.json({ items: [], restantes: 0, disponible: false });
  const faltan = (data ?? []).filter((r) => !ya.has(r.id));
  const lote = faltan.slice(0, POR_LLAMADA);
  if (!lote.length) return Response.json({ items: [], restantes: 0, disponible: true });

  const loopIds = [...new Set(lote.map((r) => r.loop_id))];
  const { data: loops } = await db.from("tool_loops").select("id, name").in("id", loopIds).eq("owner", user.id);
  const nombre = new Map((loops ?? []).map((l) => [l.id as string, String(l.name)]));
  const { data: signed, error: eFirma } = await db.storage.from(CLIPS_BUCKET).createSignedUrls(lote.map((r) => r.storage_path), 3600);
  if (eFirma) return Response.json({ error: "No se pudieron firmar las descargas." }, { status: 500 });
  const url = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
  const items = lote.map((r) => ({
    id: r.id, loop_id: r.loop_id, loop_name: nombre.get(r.loop_id) ?? "bucle", titulo: r.titulo ?? "", caption: r.caption ?? "",
    video_url: url.get(r.storage_path) ?? null, bytes: r.bytes,
  }));
  return Response.json({ items, restantes: faltan.length - lote.length, disponible: true });
}
