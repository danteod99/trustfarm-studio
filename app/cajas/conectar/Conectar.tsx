"use client";

import { useEffect, useRef, useState } from "react";
import { selloValido, urlCancelar, volverValido } from "@/app/lib/cajas/volver";

const ERR_RED = "No se pudo conectar. Revisa tu internet e inténtalo de nuevo.";

export default function Conectar({ correo, vincular, caja, volver, sello }: { correo: string; vincular: boolean; caja: string; volver: string; sello: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lanzado = useRef(false);
  const valido = volverValido(volver) && selloValido(sello) && Boolean(vincular || caja);
  const cancelar = urlCancelar(volver, sello);

  async function conectar() {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch("/api/cajas/conectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caja ? { caja, volver, sello } : { vincular: true, volver, sello }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && typeof d?.url === "string" && d.url.startsWith(`${volver}/conectado?`)) {
        window.location.assign(d.url);
        return; // la ventana se cierra sola
      }
      setError(typeof d?.error === "string" ? d.error : ERR_RED);
    } catch {
      setError(ERR_RED);
    }
    setOcupado(false);
  }

  // Entrar a una caja que ya es suya no compromete nada: no hace falta confirmar
  useEffect(() => {
    if (valido && caja && !lanzado.current) {
      lanzado.current = true;
      void conectar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <div className="card p-7">
        {!valido ? (
          <>
            <h1 className="text-xl font-black">Este enlace no es válido</h1>
            <p className="mt-2 text-sm text-mute">Vuelve a empezar desde la pantalla de tu mini PC.</p>
          </>
        ) : caja ? (
          <>
            <h1 className="text-xl font-black">Entrando a tu mini PC…</h1>
            <p className="mt-2 break-all text-sm text-mute">Con la cuenta {correo}.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black">Vincular esta mini PC</h1>
            <p className="mt-2 text-sm text-mute">
              Quedará en la cuenta <b className="break-all">{correo}</b>. Hazlo solo si estás frente a la mini PC que compraste.
            </p>
            <button onClick={() => void conectar()} disabled={ocupado} className="btn-primary mt-5 w-full">
              {ocupado ? "Un momento…" : "Sí, es esta mini PC"}
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        )}
        {valido && error && caja && (
          <button onClick={() => void conectar()} disabled={ocupado} className="btn-primary mt-4 w-full">
            Reintentar
          </button>
        )}
        {cancelar && (
          <a href={cancelar} className="btn-ghost mt-3 block w-full text-center">
            Cancelar
          </a>
        )}
      </div>
    </main>
  );
}
