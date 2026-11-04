"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Users } from "lucide-react";
import Cuentas from "@/app/granja/Cuentas";
import Multiplicar from "@/app/granja/Multiplicar";
import type { Network } from "@/app/lib/granja";

export interface Account { id: string; handle: string; network: Network; preset_id: string | null; notes: string }
export interface Character { id: string; name: string; description: string }

type Tab = "cuentas" | "multiplicar";

export default function Granja() {
  const [tab, setTab] = useState<Tab>("multiplicar");
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [missingTable, setMissingTable] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/granja/cuentas", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (r.status === 503 && d.missingTable) { setMissingTable(true); setAccounts([]); return; }
      if (!r.ok) { setLoadError(d.error || "No se pudieron cargar tus cuentas."); setAccounts([]); return; }
      setMissingTable(false);
      setLoadError(null);
      setAccounts(d.accounts ?? []);
    } catch {
      setLoadError("No se pudieron cargar tus cuentas.");
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    reload();
    fetch("/api/presets")
      .then((r) => (r.ok ? r.json() : { presets: [] }))
      .then((d) => setCharacters(((d.presets ?? []) as (Character & { kind: string })[]).filter((p) => p.kind === "character")))
      .catch(() => setCharacters([]));
  }, [reload]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="eyebrow">Contenido para cada cuenta</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Modo Granja</h1>
      <p className="mt-2 max-w-2xl text-mute">
        Convierte de 1 a 5 videos en un video distinto para cada cuenta de tu granja: otro gancho arriba, otro color, otro encuadre y otra velocidad.
        Los videos se hacen en tu computadora (gratis); solo los ganchos con IA cuestan créditos.
      </p>

      <div className="mt-6 flex gap-2 border-b border-line">
        {([
          ["multiplicar", "Multiplicar", <Layers key="l" size={15} />],
          ["cuentas", `Mis cuentas${accounts?.length ? ` (${accounts.length})` : ""}`, <Users key="u" size={15} />],
        ] as const).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === k ? "border-brand-2 text-ink" : "border-transparent text-mute hover:text-ink"
            }`}
          >
            <span className={tab === k ? "text-brand-2" : ""}>{icon}</span> {label}
          </button>
        ))}
      </div>

      {missingTable && (
        <div className="card mt-5 border-amber-400/50 bg-amber-400/5 p-4 text-sm text-amber-200">
          <b>Mis cuentas aún no está activado</b> en esta instalación (falta crear la tabla <code>farm_accounts</code> en la base de datos).
          Mientras tanto puedes usar Multiplicar con nombres genéricos (cuenta-001, cuenta-002…).
        </div>
      )}
      {loadError && <div className="card mt-5 border-red-500/50 bg-red-500/5 p-4 text-sm text-red-300">{loadError}</div>}

      <div className="mt-6">
        {tab === "cuentas" ? (
          <Cuentas accounts={accounts} characters={characters} disabled={missingTable} onChange={setAccounts} reload={reload} />
        ) : (
          <Multiplicar accounts={accounts ?? []} characters={characters} goToAccounts={() => setTab("cuentas")} />
        )}
      </div>
    </div>
  );
}
