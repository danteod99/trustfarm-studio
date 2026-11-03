import { MODELS } from "@/app/lib/catalog";
import { MOTIONS } from "@/app/lib/templates";

// Catálogo público: modelos, opciones y costo en créditos. No requiere clave.
export async function GET() {
  return Response.json({
    models: MODELS.filter((m) => !m.adminOnly).map((m) => ({
      id: m.publicId,
      kind: m.kind,
      name: m.name,
      description: m.tagline,
      aspects: m.aspects,
      durations: m.durations ?? null,
      resolutions: m.resolutions ?? null,
      credits: m.credits, // número por imagen, o créditos por segundo según resolución
      accepts_image: m.acceptsImage,
    })),
    motions: MOTIONS.map((m) => ({ id: m.id, label: m.label })),
  });
}
