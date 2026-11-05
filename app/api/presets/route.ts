import { randomUUID } from "crypto";
import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin, MEDIA_BUCKET } from "@/app/lib/supabase/admin";
import { MAX_PRESETS, MAX_PRESET_DESC, listPresets, publicPresets, type PresetKind } from "@/app/lib/presets";
import { registrarSenal } from "@/app/lib/senales";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  return Response.json({ presets: await publicPresets(await listPresets(user.id)) });
}

// Crea un personaje o estilo. Foto opcional: subida (image) o de una generación propia (fromGeneration).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const kind: PresetKind = body.kind === "style" ? "style" : "character";
  const name = String(body.name || "").trim().slice(0, 60);
  const description = String(body.description || "").trim();
  if (!name) return Response.json({ error: "Ponle un nombre." }, { status: 400 });
  if (description.length < 10) return Response.json({ error: "Describe con más detalle (mínimo 10 caracteres)." }, { status: 400 });
  if (description.length > MAX_PRESET_DESC) {
    return Response.json({ error: `Máximo ${MAX_PRESET_DESC} caracteres.` }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { count, error: countErr } = await db.from("ai_presets").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (countErr) {
    console.error("[presets] count:", countErr.message);
    return Response.json({ error: "Los personajes aún no están activados." }, { status: 503 });
  }
  if ((count ?? 0) >= MAX_PRESETS) return Response.json({ error: `Máximo ${MAX_PRESETS} guardados.` }, { status: 400 });

  const id = randomUUID();
  let imagePath: string | null = null;
  if (kind === "character" && body.fromGeneration) {
    const { data: gen } = await db
      .from("ai_generations")
      .select("output_path, kind, status")
      .eq("id", String(body.fromGeneration))
      .eq("user_id", user.id)
      .maybeSingle();
    if (!gen || gen.kind !== "image" || gen.status !== "done" || !gen.output_path) {
      return Response.json({ error: "Esa imagen no está disponible." }, { status: 400 });
    }
    imagePath = `presets/${user.id}/${id}.${gen.output_path.split(".").pop()}`;
    const { error } = await db.storage.from(MEDIA_BUCKET).copy(gen.output_path, imagePath);
    if (error) return Response.json({ error: "No se pudo copiar la imagen." }, { status: 500 });
  } else if (kind === "character" && body.image?.data) {
    const bytes = Buffer.from(String(body.image.data), "base64");
    if (bytes.length > MAX_IMAGE_BYTES) return Response.json({ error: "La imagen pesa más de 5 MB." }, { status: 400 });
    imagePath = `presets/${user.id}/${id}.jpg`;
    const { error } = await db.storage.from(MEDIA_BUCKET).upload(imagePath, bytes, { contentType: "image/jpeg" });
    if (error) return Response.json({ error: "No se pudo guardar la imagen." }, { status: 500 });
  }

  const { data: row, error } = await db
    .from("ai_presets")
    .insert({ id, user_id: user.id, kind, name, description, image_path: imagePath })
    .select()
    .single();
  if (error || !row) {
    console.error("[presets] insert:", error?.message);
    return Response.json({ error: "No se pudo guardar." }, { status: 500 });
  }
  if (kind === "character" && body.fromGeneration) await registrarSenal(String(body.fromGeneration), user.id, "character");
  return Response.json({ preset: (await publicPresets([row]))[0] });
}
