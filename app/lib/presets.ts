import { supabaseAdmin, MEDIA_BUCKET } from "@/app/lib/supabase/admin";
import type { InputImage } from "@/app/lib/providers/gemini";

// Personajes y estilos guardados por el usuario (supabase/03_personajes.sql).

export type PresetKind = "character" | "style";

export interface Preset {
  id: string;
  user_id: string;
  kind: PresetKind;
  name: string;
  description: string;
  image_path: string | null;
  created_at: string;
}

export const MAX_PRESETS = 40;
export const MAX_PRESET_DESC = 1200;

export async function listPresets(userId: string): Promise<Preset[]> {
  const { data } = await supabaseAdmin()
    .from("ai_presets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_PRESETS);
  return (data ?? []) as Preset[];
}

export async function getPreset(userId: string, id: string): Promise<Preset | null> {
  const { data } = await supabaseAdmin().from("ai_presets").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return (data as Preset) ?? null;
}

/** Lo que ve el usuario, con la foto firmada por 1 h. */
export async function publicPresets(presets: Preset[]) {
  const paths = presets.filter((p) => p.image_path).map((p) => p.image_path!) as string[];
  const byPath: Record<string, string> = {};
  if (paths.length) {
    const { data } = await supabaseAdmin().storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60);
    for (const s of data ?? []) if (s.path && s.signedUrl) byPath[s.path] = s.signedUrl;
  }
  return presets.map((p) => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    description: p.description,
    imageUrl: p.image_path ? byPath[p.image_path] ?? null : null,
  }));
}

/** Descarga un archivo del bucket como imagen de entrada para el proveedor. */
export async function storageImage(path: string): Promise<InputImage | null> {
  const { data, error } = await supabaseAdmin().storage.from(MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  const mime = data.type && data.type.startsWith("image/") ? data.type : path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mime };
}

/** Texto que se antepone al prompt con el estilo y el personaje elegidos. */
export function presetPrefix(style: Preset | null, character: Preset | null, withCharacterImage: boolean): string {
  const parts: string[] = [];
  if (style) parts.push(`Estilo visual: ${style.description}`);
  if (character) {
    parts.push(
      `Personaje "${character.name}" (mantener exactamente el mismo rostro, colores, rasgos y ropa): ${character.description}` +
        (withCharacterImage ? " Usa la imagen adjunta como referencia del personaje." : "")
    );
  }
  return parts.length ? parts.join("\n") + "\n\nEscena: " : "";
}
