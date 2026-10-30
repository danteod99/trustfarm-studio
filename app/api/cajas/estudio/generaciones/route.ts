import { leerBearer, UUID_REGEX, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { estudioDepsReales } from "@/app/lib/cajas/estudio-deps";
import { estudioListar } from "@/app/lib/cajas/estudio-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_AUTORIZADO = () => Response.json({ error: "No autorizado." }, { status: 401 });

// Galería de la cuenta dueña (incluye las pendientes). ?kind=image|video, ?limit=, ?before=<created_at>.
export async function GET(req: Request) {
  const d = estudioDepsReales();
  if (!d) return Response.json(ERROR_NO_CONFIGURADO, { status: 500 });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return NO_AUTORIZADO();
  const q = new URL(req.url).searchParams;
  try {
    const r = await estudioListar(d, { registroId, bearer: leerBearer(req) }, {
      kind: q.get("kind") ?? undefined,
      limit: q.get("limit") ?? undefined,
      before: q.get("before") ?? undefined,
    });
    return Response.json(r.body, { status: r.status });
  } catch {
    return Response.json({ error: "No se pudo leer la galería. Inténtalo de nuevo." }, { status: 500 });
  }
}
