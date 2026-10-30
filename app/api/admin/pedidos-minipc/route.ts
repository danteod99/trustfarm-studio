import { FORBIDDEN, UNAUTHORIZED, getUser, isAdminEmail } from "@/app/lib/auth";
import { pedidosStoreSupabase } from "@/app/lib/minipc-store-supabase";
import { PEDIDOS_POR_PAGINA, paginaPedidos, parsePagina } from "@/app/lib/minipc-admin";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Admin: lista de pedidos de la mini PC, 100 por página.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  if (!isAdminEmail(user.email)) return FORBIDDEN();

  const pagina = parsePagina(new URL(req.url).searchParams.get("pagina"));
  try {
    const filas = await pedidosStoreSupabase().listar(pagina * PEDIDOS_POR_PAGINA, PEDIDOS_POR_PAGINA + 1);
    return Response.json(paginaPedidos(filas, PEDIDOS_POR_PAGINA), { headers: NO_STORE });
  } catch (e) {
    console.error("admin pedidos-minipc: no se pudo listar", e);
    return Response.json({ error: "No pude cargar los pedidos." }, { status: 500, headers: NO_STORE });
  }
}
