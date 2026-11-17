import { getUser } from "@/app/lib/auth";
import DescargaAutomatica from "@/app/components/DescargaAutomatica";

export default async function DescargaAutomaticaHost() {
  const user = await getUser().catch(() => null);
  return user ? <DescargaAutomatica userId={user.id} /> : null;
}
