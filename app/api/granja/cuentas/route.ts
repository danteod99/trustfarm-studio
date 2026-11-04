import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { MAX_FARM_ACCOUNTS, accountKey, parseAccountsText, parseNetwork } from "@/app/lib/granja";
import { FARM_COLUMNS, MISSING_TABLE, farmDb, isMissingTable, type FarmAccount } from "@/app/lib/granja-db";

// Mis cuentas (Modo Granja): lista y alta masiva desde una lista pegada.

export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { data, error } = await farmDb()
    .select(FARM_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(MAX_FARM_ACCOUNTS);
  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE();
    console.error("[granja/cuentas] GET:", error.message);
    return Response.json({ error: "No se pudieron cargar tus cuentas." }, { status: 500 });
  }
  return Response.json({ accounts: (data ?? []) as FarmAccount[], max: MAX_FARM_ACCOUNTS });
}

// body: { text: "una cuenta por línea", network?: "tiktok" (red por defecto para @handle sueltos) }
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const body = (await req.json().catch(() => ({}))) as { text?: unknown; network?: unknown };
  const text = typeof body.text === "string" ? body.text.slice(0, 200_000) : "";
  const def = parseNetwork(String(body.network ?? "tiktok")) ?? "tiktok";
  const parsed = parseAccountsText(text, def, MAX_FARM_ACCOUNTS * 2);
  if (!parsed.accounts.length) {
    return Response.json({ error: "No encontramos cuentas válidas en la lista.", invalid: parsed.invalid }, { status: 400 });
  }

  const { data: existing, error: exErr } = await farmDb().select("handle, network").eq("user_id", user.id).limit(MAX_FARM_ACCOUNTS + 10);
  if (exErr) {
    if (isMissingTable(exErr)) return MISSING_TABLE();
    console.error("[granja/cuentas] POST existing:", exErr.message);
    return Response.json({ error: "No se pudieron guardar tus cuentas." }, { status: 500 });
  }
  const have = new Set((existing ?? []).map((a) => accountKey(a as { handle: string; network: never })));
  const fresh = parsed.accounts.filter((a) => !have.has(accountKey(a)));
  const room = Math.max(0, MAX_FARM_ACCOUNTS - have.size);
  const toInsert = fresh.slice(0, room);
  const overLimit = fresh.length - toInsert.length;

  let added = 0;
  if (toInsert.length) {
    const { data, error } = await farmDb()
      .upsert(toInsert.map((a) => ({ user_id: user.id, handle: a.handle, network: a.network })), {
        onConflict: "user_id,network,handle",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      if (isMissingTable(error)) return MISSING_TABLE();
      console.error("[granja/cuentas] POST insert:", error.message);
      return Response.json({ error: "No se pudieron guardar tus cuentas." }, { status: 500 });
    }
    added = data?.length ?? 0;
  }
  return Response.json({
    added,
    alreadySaved: parsed.accounts.length - fresh.length,
    duplicates: parsed.duplicates,
    invalid: parsed.invalid,
    overLimit,
    max: MAX_FARM_ACCOUNTS,
  });
}
