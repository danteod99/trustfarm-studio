import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";
import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { isActive, readSub } from "@/app/lib/subscription";
import Cuenta from "@/app/cuenta/Cuenta";

export const metadata = { title: "Mi cuenta" };

async function contar(tabla: string, userId: string, filtro?: [string, string]) {
  let q = supabaseAdmin().from(tabla).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (filtro) q = q.eq(filtro[0], filtro[1]);
  const { count } = await q;
  return count ?? 0;
}

export default async function CuentaPage() {
  const user = await getUser();
  if (!user) redirect("/entrar?next=/cuenta");
  const sub = readSub(user.app_metadata);
  const proveedores = (user.app_metadata?.providers as string[] | undefined) ?? [user.app_metadata?.provider ?? "email"];
  const [saldo, imagenes, videos, personajes] = await Promise.all([
    getBalance(user.id),
    contar("ai_generations", user.id, ["kind", "image"]),
    contar("ai_generations", user.id, ["kind", "video"]),
    contar("ai_presets", user.id),
  ]);
  return (
    <Suspense>
      <Cuenta
        email={user.email ?? ""}
        desde={user.created_at}
        conGoogle={proveedores.includes("google")}
        conClave={proveedores.includes("email")}
        saldo={saldo}
        plan={isActive(sub) ? { periodEnd: sub!.periodEnd, cancelAtPeriodEnd: sub!.cancelAtPeriodEnd } : null}
        conteo={{ imagenes, videos, personajes }}
      />
    </Suspense>
  );
}
