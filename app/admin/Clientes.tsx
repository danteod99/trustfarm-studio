"use client";

import { useEffect, useMemo, useState } from "react";

interface Cliente {
  id: string;
  email: string;
  nombre: string;
  origen: "studio" | "trustmind";
  alta: string;
  ultimoIngreso: string | null;
  creditos: number;
  pagadoUsd: number;
  compras: number;
  generaciones: number;
  ultimaGeneracion: string | null;
  plan: "activo" | "cancela" | null;
}

type Filtro = "todos" | "pagaron" | "plan" | "sin-usar";
const FILTROS: [Filtro, string][] = [
  ["todos", "Todos"],
  ["pagaron", "Pagaron"],
  ["plan", "Plan mensual"],
  ["sin-usar", "Sin generar"],
];

const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const usd = (n: number) => `$${n.toFixed(2)}`;

function Plan({ c }: { c: Cliente }) {
  if (!c.plan) return <span className="text-mute">—</span>;
  return <span className={c.plan === "activo" ? "text-brand-2" : "text-amber-400"}>{c.plan === "activo" ? "Activo" : "Cancela al final"}</span>;
}

/** Lista de clientes del Studio con búsqueda y filtros. «Regalar» llena el formulario de créditos. */
export default function Clientes({ onRegalar }: { onRegalar: (email: string) => void }) {
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [mostrar, setMostrar] = useState(50);

  useEffect(() => {
    fetch("/api/admin/clientes", { cache: "no-store" }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (r.ok) setClientes(d.clientes);
      else setError(d.error || "No se pudo cargar la lista.");
    });
  }, []);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (clientes ?? []).filter(
      (c) =>
        (!t || c.email.toLowerCase().includes(t) || c.nombre.toLowerCase().includes(t)) &&
        (filtro === "todos" ||
          (filtro === "pagaron" && c.compras > 0) ||
          (filtro === "plan" && !!c.plan) ||
          (filtro === "sin-usar" && c.generaciones === 0))
    );
  }, [clientes, q, filtro]);

  const total = clientes ?? [];
  const resumen: [string, string | number][] = [
    ["Clientes", total.length],
    ["Pagaron", total.filter((c) => c.compras > 0).length],
    ["Plan mensual", total.filter((c) => c.plan).length],
    ["Cobrado total", usd(total.reduce((s, c) => s + c.pagadoUsd, 0))],
  ];

  const regalar = (c: Cliente) => (
    <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => onRegalar(c.email)}>
      Regalar
    </button>
  );

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Clientes</h2>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {resumen.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line p-3">
            <p className="text-xs uppercase tracking-wider text-mute">{k}</p>
            <p className="mt-0.5 text-lg font-bold">{clientes ? v : "—"}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          className="input grow sm:!w-auto"
          placeholder="Buscar por correo o nombre"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMostrar(50);
          }}
        />
        {FILTROS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              setFiltro(id);
              setMostrar(50);
            }}
            className={`chip ${filtro === id ? "chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
      {!clientes && !error && <p className="mt-3 text-sm text-mute">Cargando…</p>}
      {clientes && !lista.length && <p className="mt-3 text-sm text-mute">Ningún cliente con ese filtro.</p>}

      {/* Móvil: tarjetas apiladas */}
      <ul className="mt-3 space-y-3 md:hidden">
        {lista.slice(0, mostrar).map((c) => (
          <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
            <p className="break-all font-medium">{c.email}</p>
            {c.nombre && <p className="text-xs text-mute">{c.nombre}</p>}
            <p className="mt-2 text-xs">
              {c.creditos} créditos · pagó {usd(c.pagadoUsd)} ({c.compras}) · {c.generaciones} generaciones
            </p>
            <p className="text-xs text-mute">
              Alta {dia(c.alta)} · última generación {dia(c.ultimaGeneracion)} · {c.origen === "studio" ? "Studio" : "viene de trustmind"}
            </p>
            <p className="text-xs">
              Plan: <Plan c={c} />
            </p>
            <div className="mt-2">{regalar(c)}</div>
          </li>
        ))}
      </ul>

      {/* Pantallas grandes: tabla */}
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-mute">
            <tr>
              <th className="py-2">Cliente</th>
              <th>Alta</th>
              <th>Créditos</th>
              <th>Pagado</th>
              <th>Plan</th>
              <th>Generaciones</th>
              <th>Última</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.slice(0, mostrar).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-2 pr-3">
                  {c.email}
                  <span className="block text-xs text-mute">
                    {c.nombre ? `${c.nombre} · ` : ""}
                    {c.origen === "studio" ? "Studio" : "viene de trustmind"}
                  </span>
                </td>
                <td className="pr-3 text-xs">{dia(c.alta)}</td>
                <td className="pr-3">{c.creditos}</td>
                <td className="pr-3">
                  {usd(c.pagadoUsd)} {c.compras > 0 && <span className="text-xs text-mute">({c.compras})</span>}
                </td>
                <td className="pr-3 text-xs">
                  <Plan c={c} />
                </td>
                <td className="pr-3">{c.generaciones}</td>
                <td className="pr-3 text-xs">{dia(c.ultimaGeneracion)}</td>
                <td>{regalar(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lista.length > mostrar && (
        <button className="btn-ghost mt-3" onClick={() => setMostrar(mostrar + 50)}>
          Ver más ({lista.length - mostrar})
        </button>
      )}
    </section>
  );
}
