import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { buscarCuentas } from "@/app/lib/cajas/fabrica-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Admin: buscador de cuentas registradas para crear una caja (?q=parte del correo).
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  try {
    const r = await buscarCuentas(deps, { texto: new URL(req.url).searchParams.get("q") });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo buscar la cuenta. Inténtalo de nuevo." }, 500);
  }
}
