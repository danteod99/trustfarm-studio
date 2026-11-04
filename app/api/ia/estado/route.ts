import { depsIAReales } from "@/app/lib/ia/deps";
import { consultarEstadoIa } from "@/app/lib/ia/pasarela";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NS = { "Cache-Control": "no-store" };

// La mini PC pregunta si ya puede volver a usar la IA (saldo y tope), sin gastar una llamada a Anthropic.
export async function GET(req: Request) {
  const deps = depsIAReales();
  if (!deps) return Response.json({ error: { type: "pasarela_apagada" } }, { status: 503, headers: NS });
  try {
    const r = await consultarEstadoIa(deps, { llave: req.headers.get("x-api-key") });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return Response.json({ error: { type: "api_error" } }, { status: 500, headers: NS });
  }
}
