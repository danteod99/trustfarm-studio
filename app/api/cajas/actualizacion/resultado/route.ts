import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { registrarResultadoActualizacion } from "@/app/lib/cajas/actualizacion-servicio";
import { actualizacionStoreSupabase } from "@/app/lib/cajas/store-actualizacion-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La caja informa cómo le fue con una actualización (versión, ok y un detalle corto). Sin datos del negocio.
export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500, headers: NS });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return Response.json({ error: "No autorizado." }, { status: 401, headers: NS });
  let version = "";
  let ok = false;
  let detalle: string | null = null;
  try {
    const b = await req.json();
    if (typeof b?.version === "string") version = b.version;
    ok = b?.ok === true;
    if (typeof b?.detalle === "string") detalle = b.detalle;
  } catch {
    // cuerpo ausente o inválido: version queda vacía y se responde 400
  }
  try {
    const r = await registrarResultadoActualizacion({ ...deps, act: actualizacionStoreSupabase() }, { registroId, bearer: leerBearer(req), version, ok, detalle });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: "No se pudo registrar el resultado. Inténtalo de nuevo." }, { status: 500, headers: NS });
  }
}
