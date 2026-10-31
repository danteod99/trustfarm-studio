import { leerBearer, UUID_REGEX, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { estudioDepsReales } from "@/app/lib/cajas/estudio-deps";
import { estudioGenerar } from "@/app/lib/cajas/estudio-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Nano Banana responde en la misma petición (10-40 s).
export const maxDuration = 120;

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

// La caja pide generar una imagen o un video; se cobra a la cuenta dueña de la caja.
export async function POST(req: Request) {
  const d = estudioDepsReales();
  if (!d) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined; // el servicio responde 400 "Solicitud inválida." (después de autenticar)
  }
  try {
    const r = await estudioGenerar(d, { registroId, bearer: leerBearer(req) }, body);
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo generar. Inténtalo de nuevo." }, { status: 500 });
  }
}
