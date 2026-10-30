import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { estadoCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

export async function GET(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });

  const url = new URL(req.url);
  const registroId = url.searchParams.get("registro_id") ?? "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();

  try {
    const r = await estadoCaja(deps, { registroId, bearer: leerBearer(req), conToken: url.searchParams.get("token") === "1" });
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo consultar la caja. Inténtalo de nuevo." }, { status: 500 });
  }
}
