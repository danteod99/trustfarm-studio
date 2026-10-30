import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { supabaseAdmin, MEDIA_BUCKET } from "@/app/lib/supabase/admin";
import { getPreset } from "@/app/lib/presets";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  const { id } = await params;
  const preset = await getPreset(user.id, id);
  if (!preset) return Response.json({ error: "No existe." }, { status: 404 });

  const db = supabaseAdmin();
  await db.from("ai_presets").delete().eq("id", id).eq("user_id", user.id);
  if (preset.image_path) await db.storage.from(MEDIA_BUCKET).remove([preset.image_path]);
  return Response.json({ ok: true });
}
