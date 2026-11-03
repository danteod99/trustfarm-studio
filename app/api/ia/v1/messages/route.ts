import { depsIAReales } from "@/app/lib/ia/deps";
import { atenderMensajes } from "@/app/lib/ia/pasarela";
import { MAX_CUERPO_BYTES } from "@/app/lib/ia/reglas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Un recorte de video largo con Sonnet puede tardar: la llamada a Anthropic corta a los 110 s
export const maxDuration = 120;

const NS = { "Cache-Control": "no-store" };
const fallo = (status: number, type: string, message: string) =>
  Response.json({ type: "error", error: { type, message } }, { status, headers: NS });

// La mini PC llama aquí con el SDK de Anthropic. Nunca se registra el cuerpo: lleva conversaciones de clientes.
export async function POST(req: Request) {
  const deps = depsIAReales();
  if (!deps) return fallo(503, "pasarela_apagada", "La IA no está disponible en este momento.");

  const texto = await req.text().catch(() => "");
  if (texto.length > MAX_CUERPO_BYTES) return fallo(413, "demasiado_grande", "El archivo es demasiado grande.");
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return fallo(400, "invalid_request_error", "Solicitud inválida.");
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
  try {
    const r = await atenderMensajes(deps, { llave: req.headers.get("x-api-key"), ip, cuerpo });
    return Response.json(r.body, { status: r.status, headers: NS });
  } catch {
    return fallo(500, "api_error", "La IA no pudo responder. Inténtalo de nuevo.");
  }
}
