import { FORBIDDEN, getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { depsSoporteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { isSoporteEmail } from "@/app/lib/cajas/soporte-acceso";
import { soporteAdmin } from "@/app/lib/cajas/soporte-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

async function atender(accion: unknown, datos: Record<string, unknown>) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isSoporteEmail(user.email)) return FORBIDDEN();
  const deps = depsSoporteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  try {
    const r = await soporteAdmin(deps, { quien: user.email!, accion, datos });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo atender el soporte. Inténtalo de nuevo." }, 500);
  }
}

// Soporte: tickets pendientes de todas las cajas
export async function GET() {
  return atender("listar", {});
}

// Soporte: aceptar, cerrar, entrar. Cuerpo: { accion, ticket_id | caja_id, ... }
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    const b = await req.json();
    if (b && typeof b === "object") body = b;
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  if (body.accion === "listar") return json({ error: "Acción desconocida." }, 400);
  return atender(body.accion, body);
}
