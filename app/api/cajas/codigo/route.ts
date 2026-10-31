import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { codigoCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La caja que todavía no tiene dueño pide su código de asociación (el vigente, o uno nuevo si venció).
// Autenticada con su secreto: `Authorization: Bearer <secreto>` y `X-Registro-Id`, como las rutas del Estudio.
export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500, headers: NS });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return Response.json({ error: "No autorizado." }, { status: 401, headers: NS });
  try {
    const r = await codigoCaja(deps, { registroId, bearer: leerBearer(req) });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: "No se pudo pedir el código. Inténtalo de nuevo." }, { status: 500, headers: NS });
  }
}
