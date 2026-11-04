import { getUser } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { conectarCaja } from "@/app/lib/cajas/cliente-servicio";
import { correoDeGoogle } from "@/app/lib/cajas/correo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

// Vincula la mini PC o comprueba que sea del usuario, y devuelve a dónde vuelve la ventana con el pase.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);

  let b: { codigo?: unknown; caja?: unknown; volver?: unknown; sello?: unknown };
  try {
    const body = await req.json();
    b = body && typeof body === "object" ? body : {};
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }
  try {
    const r = await conectarCaja(deps, { userId: user.id, email: correoDeGoogle(user), codigo: b.codigo, caja: b.caja, volver: b.volver, sello: b.sello });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo conectar tu mini PC. Inténtalo de nuevo." }, 500);
  }
}
