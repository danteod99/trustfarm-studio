import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { MAX_NOTES, normalizeHandle } from "@/app/lib/granja";
import { FARM_COLUMNS, MISSING_TABLE, farmDb, isMissingTable } from "@/app/lib/granja-db";
import { getPreset } from "@/app/lib/presets";

const UUID = /^[0-9a-f-]{36}$/i;

// body: { preset_id?: uuid|null, notes?: string, handle?: string }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Cuenta no encontrada." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if ("preset_id" in body) {
    const pid = body.preset_id;
    if (pid === null || pid === "") patch.preset_id = null;
    else if (typeof pid === "string" && UUID.test(pid) && (await getPreset(user.id, pid))) patch.preset_id = pid;
    else return Response.json({ error: "Ese personaje no existe." }, { status: 400 });
  }
  if ("notes" in body) patch.notes = String(body.notes ?? "").slice(0, MAX_NOTES);
  if ("handle" in body) {
    const h = normalizeHandle(String(body.handle ?? ""));
    if (!h) return Response.json({ error: "Nombre de cuenta inválido (solo letras, números, punto, guion y guion bajo)." }, { status: 400 });
    patch.handle = h;
  }
  if (!Object.keys(patch).length) return Response.json({ error: "Nada que cambiar." }, { status: 400 });

  const { data, error } = await farmDb().update(patch).eq("id", id).eq("user_id", user.id).select(FARM_COLUMNS).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE();
    if (error.code === "23505") return Response.json({ error: "Ya tienes esa cuenta en esa red." }, { status: 409 });
    console.error("[granja/cuentas] PATCH:", error.message);
    return Response.json({ error: "No se pudo guardar el cambio." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Cuenta no encontrada." }, { status: 404 });
  return Response.json({ account: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Cuenta no encontrada." }, { status: 404 });
  const { error } = await farmDb().delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    if (isMissingTable(error)) return MISSING_TABLE();
    console.error("[granja/cuentas] DELETE:", error.message);
    return Response.json({ error: "No se pudo borrar." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
