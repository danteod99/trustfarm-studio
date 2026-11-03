import { getUser } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { vincularCaja } from "@/app/lib/cajas/cliente-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);

  let codigo: unknown;
  try {
    const body = await req.json();
    codigo = body && typeof body === "object" ? (body as { codigo?: unknown }).codigo : undefined;
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }
  try {
    const r = await vincularCaja(deps, { userId: user.id, email: user.email, codigo });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo vincular la caja. Inténtalo de nuevo." }, 500);
  }
}
