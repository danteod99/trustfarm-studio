import { FORBIDDEN, UNAUTHORIZED, getUser, isAdminEmail } from "@/app/lib/auth";
import { pedidosStoreSupabase } from "@/app/lib/minipc-store-supabase";
import { cambiarEstadoPedido } from "@/app/lib/minipc-pedidos";
import type { EstadoPedido } from "@/app/lib/minipc-pedidos";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS = ["pagado", "revisar", "enviado", "entregado", "reembolsado", "cancelado"];

// Admin: cambia el estado de un pedido ({ estado, seguimiento }).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();

  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "No encontré ese pedido." }, { status: 404, headers: NO_STORE });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "El cuerpo no es un JSON válido." }, { status: 400, headers: NO_STORE });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "El cuerpo no es un JSON válido." }, { status: 400, headers: NO_STORE });
  }
  const { estado, seguimiento } = body as { estado?: unknown; seguimiento?: unknown };
  if (typeof estado !== "string" || !ESTADOS.includes(estado)) {
    return Response.json({ error: "El estado no es válido." }, { status: 400, headers: NO_STORE });
  }

  try {
    const r = await cambiarEstadoPedido(
      { store: pedidosStoreSupabase(), ahora: () => new Date() },
      { id, estado: estado as EstadoPedido, seguimiento: seguimiento as string | null | undefined },
    );
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status, headers: NO_STORE });
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (e) {
    console.error("admin pedidos-minipc: no se pudo cambiar el estado", e);
    return Response.json({ error: "No pude actualizar el pedido." }, { status: 500, headers: NO_STORE });
  }
}
