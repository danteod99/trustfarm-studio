import { getUser } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { listarMisCajas } from "@/app/lib/cajas/cliente-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  try {
    const r = await listarMisCajas(deps, { userId: user.id });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudieron leer tus cajas. Inténtalo de nuevo." }, 500);
  }
}
