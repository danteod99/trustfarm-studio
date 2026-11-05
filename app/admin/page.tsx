import { notFound } from "next/navigation";
import { getUser, isAdminEmail } from "@/app/lib/auth";
import AdminPanel from "@/app/admin/AdminPanel";
import { isSoporteEmail } from "@/app/lib/cajas/soporte-acceso";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await getUser();
  if (!isAdminEmail(user?.email)) notFound();
  return <AdminPanel soporte={isSoporteEmail(user?.email)} />;
}
