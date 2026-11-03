import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { prepararCajaParaCuenta } from "@/app/lib/cajas/fabrica-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Crear el túnel y el DNS en Cloudflare puede tardar unos segundos.
export const maxDuration = 60;

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Admin: prepara una caja nueva para una cuenta registrada (túnel y dirección). Solo esa cuenta podrá vincularla.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  let body: { etiqueta?: unknown; usuario_id?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") return json({ error: "Solicitud inválida." }, 400);
  try {
    const r = await prepararCajaParaCuenta(deps, { adminId: user.id, etiqueta: body.etiqueta, usuarioId: body.usuario_id });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo crear la caja. Inténtalo de nuevo." }, 500);
  }
}
