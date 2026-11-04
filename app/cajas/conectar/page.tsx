import Conectar from "@/app/cajas/conectar/Conectar";
import { getUser } from "@/app/lib/auth";
import { correoDeGoogle } from "@/app/lib/cajas/correo";

export const metadata = { title: "Conectar tu mini PC", robots: { index: false } };

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

// La abre la ventana de Google de la propia mini PC. El middleware ya exige sesión.
export default async function ConectarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const user = await getUser();
  return (
    <Conectar
      correo={(user && (correoDeGoogle(user) ?? user.email)) || ""}
      codigo={texto(p.codigo)}
      caja={texto(p.caja)}
      volver={texto(p.volver)}
      sello={texto(p.sello)}
    />
  );
}
