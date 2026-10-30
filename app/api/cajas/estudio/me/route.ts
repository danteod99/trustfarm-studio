import { leerBearer, UUID_REGEX, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { estudioDepsReales } from "@/app/lib/cajas/estudio-deps";
import { estudioMe } from "@/app/lib/cajas/estudio-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

// La caja pregunta por su saldo, su tope de hoy y los modelos disponibles.
export async function GET(req: Request) {
  const d = estudioDepsReales();
  if (!d) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();
  try {
    const r = await estudioMe(d, { registroId, bearer: leerBearer(req) });
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo leer el Estudio. Inténtalo de nuevo." }, { status: 500 });
  }
}
