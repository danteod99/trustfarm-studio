import { onlineModels } from "@/app/lib/generations";

// Qué modelos puede generar ahora el servidor local, y si hay respaldo en fal.ai.
export async function GET() {
  return Response.json({ online: await onlineModels(), fal: !!process.env.FAL_KEY });
}
