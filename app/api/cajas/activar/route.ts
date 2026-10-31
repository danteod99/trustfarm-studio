import { depsReales, ERROR_NO_CONFIGURADO } from "@/app/lib/cajas/deps";
import { activarCaja } from "@/app/lib/cajas/servicio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La caja recién preparada presenta su llave de un solo uso y recibe su secreto permanente. Sin sesión: lo frenan los límites
// por IP y por llave. La llave nunca se registra ni se devuelve en un error.
export async function POST(req: Request) {
  const deps = depsReales();
  if (!deps) return Response.json(ERROR_NO_CONFIGURADO, { status: 500, headers: NS });

  let llave: unknown;
  let version = "";
  try {
    const body = await req.json();
    llave = body?.llave;
    if (body && typeof body.version === "string") version = body.version.slice(0, 40);
  } catch {
    // cuerpo ausente o JSON inválido: la llave queda sin valor y se responde el 400 genérico
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";

  try {
    const r = await activarCaja(deps, { llave, version, ip });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: "No se pudo activar la caja. Inténtalo de nuevo." }, { status: 500, headers: NS });
  }
}
