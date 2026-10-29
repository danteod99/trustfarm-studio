import Studio from "@/app/estudio/Studio";
import { getUser, isAdminEmail } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";

export const metadata = { title: "Estudio" };

export default async function EstudioPage() {
  const user = await getUser();
  const balance = user ? await getBalance(user.id) : 0;
  return <Studio initialBalance={balance} free={isAdminEmail(user?.email)} />;
}
