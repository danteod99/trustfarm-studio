import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { isAdminEmail } from "@/app/lib/auth";
import { hashApiKey, newApiKey, readApiKey } from "@/app/lib/automatizacion";

export const MAX_KEYS = 10;

export interface ApiCaller {
  userId: string;
  email: string | null;
  admin: boolean;
}

/** Usuario dueño de la clave de "Authorization: Bearer tsk_…", o null si falta, no existe o está revocada. */
export async function apiCaller(req: Request): Promise<ApiCaller | null> {
  const key = readApiKey(req.headers);
  if (!key) return null;
  const db = supabaseAdmin();
  const { data } = await db.from("ai_api_keys").select("id, user_id, revoked_at").eq("key_hash", hashApiKey(key)).maybeSingle();
  if (!data || data.revoked_at) return null;
  await db.from("ai_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  const { data: u } = await db.auth.admin.getUserById(data.user_id);
  const email = u.user?.email ?? null;
  return { userId: data.user_id, email, admin: isAdminEmail(email) };
}

export async function createApiKey(userId: string, name: string) {
  const db = supabaseAdmin();
  const { count } = await db.from("ai_api_keys").select("id", { count: "exact", head: true }).eq("user_id", userId).is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) return { ok: false as const, error: `Máximo ${MAX_KEYS} claves activas.` };
  const k = newApiKey();
  const { data, error } = await db
    .from("ai_api_keys")
    .insert({ user_id: userId, name: name.trim().slice(0, 60) || "Mi clave", prefix: k.prefix, key_hash: k.hash })
    .select("id, name, prefix, created_at")
    .single();
  if (error || !data) return { ok: false as const, error: "No se pudo crear la clave." };
  return { ok: true as const, key: k.key, row: data };
}

export const API_UNAUTHORIZED = () =>
  Response.json({ error: { code: "unauthorized", message: "Falta la clave de API o no es válida. Usa: Authorization: Bearer tsk_…" } }, { status: 401 });

export function apiError(status: number, message: string, code = "bad_request") {
  return Response.json({ error: { code, message } }, { status });
}
