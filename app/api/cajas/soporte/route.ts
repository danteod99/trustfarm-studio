import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { soporteCaja } from "@/app/lib/cajas/soporte-servicio";
import { soporteStoreSupabase } from "@/app/lib/cajas/store-soporte-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

// La caja pide sus tickets y da o cierra el permiso. Cuerpo: { registro_id, accion, ...datos }, con su secreto como Bearer.
export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });

  let datos: Record<string, unknown> = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object") datos = body;
  } catch {
    // cuerpo ausente o inválido: registro_id queda vacío y se responde 401
  }
  const registroId = typeof datos.registro_id === "string" ? datos.registro_id : "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();

  try {
    const r = await soporteCaja({ ...deps, soporte: soporteStoreSupabase() }, { registroId, bearer: leerBearer(req), accion: datos.accion, datos });
    return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No se pudo atender el soporte. Inténtalo de nuevo." }, { status: 500 });
  }
}
