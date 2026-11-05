"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Coins } from "lucide-react";

/** Evento para fijar el saldo al instante desde cualquier pantalla (p. ej. tras generar). */
export const EVENTO_SALDO = "saldo:set";

/**
 * Contador de créditos del menú. El layout no se vuelve a renderizar al navegar ni al generar,
 * así que se actualiza solo: al cambiar de página, al volver a la pestaña, cada 10 s y por evento.
 */
export default function SaldoCreditos({ inicial }: { inicial: number }) {
  const [saldo, setSaldo] = useState(inicial);
  const pathname = usePathname();

  useEffect(() => setSaldo(inicial), [inicial]);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/saldo", { cache: "no-store" });
        if (r.ok && vivo) setSaldo((await r.json()).balance);
      } catch {
        /* sin red: se queda el último valor */
      }
    };
    cargar();
    const t = setInterval(cargar, 10000);
    const alEvento = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number") setSaldo(n);
    };
    window.addEventListener(EVENTO_SALDO, alEvento);
    document.addEventListener("visibilitychange", cargar);
    window.addEventListener("focus", cargar);
    return () => {
      vivo = false;
      clearInterval(t);
      window.removeEventListener(EVENTO_SALDO, alEvento);
      document.removeEventListener("visibilitychange", cargar);
      window.removeEventListener("focus", cargar);
    };
  }, [pathname]);

  return (
    <Link href="/creditos" className="btn-ghost whitespace-nowrap !py-2">
      <Coins size={15} className="text-brand-2" />
      {saldo} <span className="hidden sm:inline">créditos</span>
    </Link>
  );
}
