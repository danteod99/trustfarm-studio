"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** La decisión de abrir la venta la toma el servidor; el endpoint la revalida igual. */
export default function BotonComprar({
  planId,
  etiqueta,
  ventaAbierta,
  destacado = false,
}: {
  planId: string;
  etiqueta: string;
  ventaAbierta: boolean;
  destacado?: boolean;
}) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al volver atrás desde Stripe, Safari iOS restaura la página con el estado "cargando".
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (e.persisted) setCargando(false);
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  if (!ventaAbierta) {
    return (
      <button type="button" disabled className="btn-ghost w-full" aria-disabled="true">
        Próximamente
      </button>
    );
  }

  async function comprar() {
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/minipc/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data: { url?: unknown; error?: unknown } = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.assign("/entrar?next=/minipc");
        return;
      }
      if (res.ok && typeof data.url === "string" && data.url.startsWith("https://")) {
        window.location.assign(data.url);
        return;
      }
      setError(
        typeof data.error === "string" && data.error
          ? data.error
          : "No pudimos iniciar la reserva. Inténtalo de nuevo en unos minutos."
      );
    } catch {
      setError("No pudimos conectar. Revisa tu internet e inténtalo de nuevo.");
    }
    setCargando(false);
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={comprar}
        disabled={cargando}
        aria-busy={cargando}
        className={`${destacado ? "btn-primary" : "btn-ghost"} w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
      >
        {cargando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {cargando ? "Abriendo la reserva…" : etiqueta}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
