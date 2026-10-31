import { apiCaller, API_UNAUTHORIZED } from "@/app/lib/apikeys";
import { getBalance } from "@/app/lib/credits";

export async function GET(req: Request) {
  const c = await apiCaller(req);
  if (!c) return API_UNAUTHORIZED();
  return Response.json({ credits: await getBalance(c.userId) });
}
