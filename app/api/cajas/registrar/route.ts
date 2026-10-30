import { depsReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { registrarCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });

  let version = "";
  try {
    const body = await req.json();
    if (body && typeof body.version === "string") version = body.version.slice(0, 40);
  } catch {
    // cuerpo ausente o JSON inválido: se tolera
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";

  try {
    const r = await registrarCaja(deps, { ip, version });
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ registro_id: r.registro_id, codigo: r.codigo, secreto: r.secreto, expira_en: r.expira_en });
  } catch {
    return Response.json({ error: "No se pudo registrar la caja. Inténtalo de nuevo." }, { status: 500 });
  }
}
