import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/app/lib/supabase/server";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function getUser(): Promise<User | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export const UNAUTHORIZED = () => Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });
export const FORBIDDEN = () => Response.json({ error: "No autorizado." }, { status: 403 });
