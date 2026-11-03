import { depsReales, ERROR_NO_CONFIGURADO, leerBearer, UUID_REGEX } from "@/app/lib/cajas/deps";
import { correoCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La mini PC valida el correo que escribió el cliente: debe tener una caja asignada libre.
// Autenticada con su secreto: `Authorization: Bearer <secreto>` y `X-Registro-Id`, como las rutas del Estudio.
export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500, headers: NS });
  const registroId = req.headers.get("x-registro-id") ?? "";
  if (!UUID_REGEX.test(registroId)) return Response.json({ error: "No autorizado." }, { status: 401, headers: NS });

  let correo: unknown;
  try {
    const body = await req.json();
    correo = body && typeof body === "object" ? (body as { correo?: unknown }).correo : undefined;
  } catch {
    return Response.json({ error: "Solicitud no válida." }, { status: 400, headers: NS });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  try {
    const r = await correoCaja(deps, { registroId, bearer: leerBearer(req), ip, correo });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: "No se pudo validar el correo. Inténtalo de nuevo." }, { status: 500, headers: NS });
  }
}
