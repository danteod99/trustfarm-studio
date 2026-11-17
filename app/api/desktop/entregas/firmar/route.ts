import { CLIPS_BUCKET } from "@/app/lib/clips";
import { supabaseAdmin } from "@/app/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Firma las descargas de entregas que el desktop YA reclamó con trustfarm.claim_deliveries.
// Autenticación: `Authorization: Bearer <access token de Supabase del usuario>` (el mismo JWT que usa el desktop
// contra Supabase). El desktop nunca recibe la service role: aquí se verifica el JWT, se comprueba que cada entrega
// es del usuario y está en `picked` (reclamada, sin vencer) y se devuelven URLs firmadas de 1 h.
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return json({ error: "Falta el token." }, 401);
  const db = supabaseAdmin();
  const { data: auth } = await db.auth.getUser(jwt);
  const uid = auth.user?.id;
  if (!uid) return json({ error: "Sesión no válida." }, 401);

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === "string" && UUID.test(x)).slice(0, 20);
  if (!ids.length) return json({ error: "Manda `ids` (hasta 20)." }, 400);

  const { data } = await db.from("tool_deliveries")
    .select("id, storage_path, caption_path, bytes, titulo, source_ref")
    .in("id", ids).eq("owner", uid).eq("status", "picked").gt("expires_at", new Date().toISOString());
  const rows = data ?? [];
  const paths = rows.flatMap((r) => [r.storage_path, r.caption_path].filter((p): p is string => !!p));
  const { data: signed, error } = paths.length ? await db.storage.from(CLIPS_BUCKET).createSignedUrls(paths, 3600) : { data: [], error: null };
  if (error) return json({ error: "No se pudieron firmar las descargas." }, 500);
  const url = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
  const items = rows.map((r) => ({
    id: r.id,
    video_url: url.get(r.storage_path) ?? null,
    caption_url: r.caption_path ? url.get(r.caption_path) ?? null : null,
    bytes: r.bytes,
    filename: `${String(r.source_ref).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 60)}.mp4`,
  }));
  return json({ items, expira_en_s: 3600 });
}
