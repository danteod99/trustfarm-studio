import { getUser, UNAUTHORIZED } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";

export const dynamic = "force-dynamic";

/** Saldo actual, ligero (lo consulta el contador del menú). */
export async function GET() {
  const user = await getUser();
  if (!user) return UNAUTHORIZED();
  return Response.json({ balance: await getBalance(user.id) }, { headers: { "Cache-Control": "no-store" } });
}
