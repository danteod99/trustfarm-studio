import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO, UUID_REGEX } from "@/app/lib/cajas/deps";
import { fijarIaAdmin } from "@/app/lib/cajas/admin-lista";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Admin: bloquea o desbloquea la IA de una caja y cambia su tope diario de chats. Cuerpo: { caja_id, bloqueada?, tope_diario_ia? }.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  let body: { caja_id?: unknown; bloqueada?: unknown; tope_diario_ia?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  if (typeof body.caja_id !== "string" || !UUID_REGEX.test(body.caja_id)) return json({ error: "No encontré esa caja." }, 404);
  try {
    const r = await fijarIaAdmin(deps, { cajaId: body.caja_id, bloqueada: body.bloqueada, topeIa: body.tope_diario_ia });
    return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
  } catch {
    return json({ error: "No se pudo guardar. Inténtalo de nuevo." }, 500);
  }
}
