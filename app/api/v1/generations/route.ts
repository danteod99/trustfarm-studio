import { apiCaller, apiError, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { publicGeneration, signedUrls, startGeneration } from "@/app/lib/generations";
import { getBalance } from "@/app/lib/credits";

export const maxDuration = 120;

// POST /api/v1/generations — crea una imagen o un video. Descuenta créditos de la cuenta dueña de la clave.
// Las imágenes de Google vuelven listas; el resto vuelve "running": consulta GET /api/v1/generations/{id}.
export async function POST(req: Request) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return apiError(400, "El cuerpo debe ser JSON.");
  }
  const image = b.image as { data?: string; mime?: string } | undefined;
  const r = await startGeneration(c.userId, c.admin, {
    model: String(b.model ?? ""),
    prompt: String(b.prompt ?? ""),
    aspect: (b.aspect as never) ?? "9:16",
    duration: b.duration ? Number(b.duration) : undefined,
    resolution: b.resolution as never,
    motion: b.motion ? String(b.motion) : undefined,
    image: image?.data && image?.mime ? { data: String(image.data), mime: String(image.mime) } : undefined,
    fromGeneration: b.from_generation ? String(b.from_generation) : undefined,
    characterId: b.character_id ? String(b.character_id) : undefined,
    styleId: b.style_id ? String(b.style_id) : undefined,
  });
  if (!r.ok) {
    const code = r.status === 402 ? "insufficient_credits" : r.status === 429 ? "too_many_jobs" : r.status === 503 ? "unavailable" : "bad_request";
    return apiError(r.status, r.error, code);
  }
  const urls = await signedUrls([r.generation]);
  return Response.json({ generation: publicGeneration(r.generation, urls[r.generation.id]), credits: await getBalance(c.userId) }, { status: 201 });
}
