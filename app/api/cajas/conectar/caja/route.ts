import { depsClienteReales, depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { vincularDesdeCaja } from "@/app/lib/cajas/cliente-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Segunda parte de «Continuar con Google»: la caja canjea el reto que le trajo la ventana.
// Autenticada con su secreto: `Authorization: Bearer <secreto>` y `X-Registro-Id`, como las demás rutas de la caja.
export async function POST(req: Request) {
  const cajas = depsReales();
  const cliente = depsClienteReales();
  if (!cajas || !cliente) return json(ERROR_NO_CONFIGURADO, 500);
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return json({ error: "No autorizado." }, 401);

  let reto: unknown;
  try {
    const body = await req.json();
    reto = body && typeof body === "object" ? (body as { reto?: unknown }).reto : undefined;
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }
  try {
    const r = await vincularDesdeCaja(cliente, cajas.store, { registroId, bearer: leerBearer(req), reto });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo vincular la mini PC. Inténtalo de nuevo." }, 500);
  }
}
