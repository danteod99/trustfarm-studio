import { getUser, isAdminEmail, UNAUTHORIZED } from "@/app/lib/auth";
import { publicGeneration, signedUrls, startGeneration } from "@/app/lib/generations";
import { getBalance } from "@/app/lib/credits";
import { etasPara } from "@/app/lib/eta";

// Nano Banana responde en la misma request (10-40 s).
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const result = await startGeneration(user.id, isAdminEmail(user.email), {
    model: String(body.model || ""),
    prompt: String(body.prompt || ""),
    aspect: body.aspect,
    duration: body.duration ? Number(body.duration) : undefined,
    resolution: body.resolution,
    image: body.image?.data && body.image?.mime ? { data: String(body.image.data), mime: String(body.image.mime) } : undefined,
    fromGeneration: body.fromGeneration ? String(body.fromGeneration) : undefined,
    characterId: body.characterId ? String(body.characterId) : undefined,
    styleId: body.styleId ? String(body.styleId) : undefined,
    motion: body.motion ? String(body.motion) : undefined,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });

  const [urls, etas] = await Promise.all([signedUrls([result.generation]), etasPara([result.generation])]);
  return Response.json({
    generation: publicGeneration(result.generation, urls[result.generation.id], etas[result.generation.id]),
    balance: await getBalance(user.id),
  });
}
