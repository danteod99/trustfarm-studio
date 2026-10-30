import { FORBIDDEN, getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { paginaAdminCajas } from "@/app/lib/cajas/admin-lista";

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
