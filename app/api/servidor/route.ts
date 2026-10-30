import { onlineModels } from "@/app/lib/generations";
import { runpodConfigured } from "@/app/lib/providers/runpod";
import type { Capacity } from "@/app/lib/catalog";

// Qué puede generarse ahora: servidor de casa encendido, fal y RunPod configurados.
export async function GET() {
  const body: Capacity = { online: await onlineModels(), fal: !!process.env.FAL_KEY, runpod: runpodConfigured() };
  return Response.json(body);
}
