import { leerBearer, UUID_REGEX, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { estudioDepsReales } from "@/app/lib/cajas/estudio-deps";
import { estudioObtener } from "@/app/lib/cajas/estudio-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

// Estado de una generación; si está en curso consulta al proveedor (la caja lo llama cada ~8 s).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const d = estudioDepsReales();
  if (!d) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();
  const { id } = await ctx.params;
  if (!UUID_REGEX.test(id)) return Response.json({ error: "No encontrada." }, { status: 404 });
  try {
    const r = await estudioObtener(d, { registroId, bearer: leerBearer(req) }, id);
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo leer la generación. Inténtalo de nuevo." }, { status: 500 });
  }
}
