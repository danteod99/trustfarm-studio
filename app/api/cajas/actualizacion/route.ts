import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { consultarActualizacion } from "@/app/lib/cajas/actualizacion-servicio";
import { actualizacionStoreSupabase } from "@/app/lib/cajas/store-actualizacion-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La caja pregunta si hay una versión nueva firmada. Autenticada con su secreto (`Authorization: Bearer` + `X-Registro-Id`).
export async function GET(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500, headers: NS });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return Response.json({ error: "No autorizado." }, { status: 401, headers: NS });
  const version = new URL(req.url).searchParams.get("version") ?? "";
  try {
    const r = await consultarActualizacion({ ...deps, act: actualizacionStoreSupabase() }, { registroId, bearer: leerBearer(req), version });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: "No se pudo consultar las actualizaciones. Inténtalo de nuevo." }, { status: 500, headers: NS });
  }
}
