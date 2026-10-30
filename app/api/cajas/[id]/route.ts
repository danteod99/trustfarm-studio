import { getUser, isAdminEmail } from "@/app/lib/auth";
import { depsClienteReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { quitarCaja, renombrarMiCaja } from "@/app/lib/cajas/cliente-servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };
const json = (body: object, status = 200) => Response.json(body, { status, headers: NS });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);

  let nombre: unknown;
  try {
    const body = await req.json();
    nombre = body && typeof body === "object" ? (body as { nombre?: unknown }).nombre : undefined;
  } catch {
    return json({ error: "Solicitud no válida." }, 400);
  }
  try {
    const { id } = await params;
    const r = await renombrarMiCaja(deps, { userId: user.id, cajaId: id, nombre });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo renombrar la caja. Inténtalo de nuevo." }, 500);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getUser();
  if (!user) return json({ error: "Inicia sesión para continuar." }, 401);
  const deps = depsClienteReales();
  if (!deps) return json(ERROR_NO_CONFIGURADO, 500);
  try {
    const { id } = await params;
    const r = await quitarCaja(deps, { userId: user.id, esAdmin: isAdminEmail(user.email), cajaId: id });
    return json(r.body, r.status);
  } catch {
    return json({ error: "No se pudo quitar la caja. Inténtalo de nuevo." }, 500);
  }
}
