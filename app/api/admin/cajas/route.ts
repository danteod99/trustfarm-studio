import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO, UUID_REGEX } from "@/app/lib/cajas/deps";
import { fijarTopeAdmin, paginaAdminCajas } from "@/app/lib/cajas/admin-lista";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Admin: todas las cajas, 100 por página (?pagina=N, desde 0).
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  const pagina = Number(new URL(req.url).searchParams.get("pagina") ?? "0");
  try {
    return json(await paginaAdminCajas(deps, pagina));
  } catch {
    return json({ error: "No se pudieron leer las cajas. Inténtalo de nuevo." }, 500);
  }
}

// Admin: cambia el tope diario de créditos del Estudio de una caja. Cuerpo: { caja_id, tope_diario }.
export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  let body: { caja_id?: unknown; tope_diario?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  if (typeof body.caja_id !== "string" || !UUID_REGEX.test(body.caja_id)) return json({ error: "Caja no válida." }, 400);
  try {
    const r = await fijarTopeAdmin(deps, { cajaId: body.caja_id, tope: body.tope_diario });
    return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
  } catch {
    return json({ error: "No se pudo guardar el tope. Inténtalo de nuevo." }, 500);
  }
}
