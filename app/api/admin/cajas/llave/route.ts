import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO, UUID_REGEX } from "@/app/lib/cajas/deps";
import { regenerarLlave } from "@/app/lib/cajas/fabrica-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Admin: llave de activación nueva para una caja (invalida las que no se hayan usado). Solo se devuelve aquí, una vez.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  let body: { caja_id?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") return json({ error: "Solicitud inválida." }, 400);
  if (typeof body.caja_id !== "string" || !UUID_REGEX.test(body.caja_id)) return json({ error: "Caja no válida." }, 400);
  try {
    const r = await regenerarLlave(deps, { cajaId: body.caja_id });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo generar la llave. Inténtalo de nuevo." }, 500);
  }
}
