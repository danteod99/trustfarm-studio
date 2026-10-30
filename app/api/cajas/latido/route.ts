import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { latidoCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });

  let registroId = "";
  let version = "";
  try {
    const body = await req.json();
    if (body && typeof body.registro_id === "string") registroId = body.registro_id;
    if (body && typeof body.version === "string") version = body.version.slice(0, 40);
  } catch {
    // cuerpo ausente o inválido: registroId queda vacío y se responde 401
  }
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();

  try {
    const r = await latidoCaja(deps, { registroId, bearer: leerBearer(req), version });
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo registrar la señal. Inténtalo de nuevo." }, { status: 500 });
  }
}
