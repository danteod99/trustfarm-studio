import { supabaseAdmin } from "@/app/lib/supabase/admin";
import type { Network } from "@/app/lib/granja";

// Acceso a farm_accounts (supabase/13_granja.sql). Solo servidor.

export interface FarmAccount {
  id: string;
  handle: string;
  network: Network;
  preset_id: string | null;
  notes: string;
  created_at: string;
}

export const FARM_COLUMNS = "id, handle, network, preset_id, notes, created_at";

/** ¿El error es porque aún no se corrió supabase/13_granja.sql? */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /farm_accounts/.test(err.message ?? "") && /(does not exist|could not find)/i.test(err.message ?? "");
}

export const MISSING_TABLE = () =>
  Response.json(
    { error: "Mis cuentas aún no está activado: falta crear la tabla en la base de datos (supabase/13_granja.sql).", missingTable: true },
    { status: 503 }
  );

export function farmDb() {
  return supabaseAdmin().from("farm_accounts");
}
