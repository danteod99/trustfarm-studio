"use client";

import { useEffect, useState } from "react";
import { MODELS } from "@/app/lib/catalog";
import PedidosMinipc from "@/app/admin/PedidosMinipc";

interface Stats {
  revenueUsd: number;
  purchases: number;
  buyers: number;
  byModel: Record<string, { total: number; failed: number; credits: number; local: number }>;
  workers: { id: string; models: string[]; lastSeen: string; online: boolean; info: { gpu?: string } | null }[];
}

interface CajaAdmin {
  id: string;
  nombre: string;
  owner_id: string | null;
  direccion: string;
  estado: "encendida" | "apagada";
  ultima_senal: string | null;
  version: string | null;
  vinculada_en: string | null;
  tope_diario: number;
  gastado_hoy: number;
  etiqueta: string | null;
  asignacion: "preparada" | "asignada";
  activada: boolean;
}

/** Llave de activación recién creada: se muestra UNA vez (el servidor solo guarda su huella). */
interface LlaveNueva {
  titulo: string;
  llave: string;
  vence_en: string;
}

const dueno = (c: CajaAdmin) => (c.owner_id ? c.owner_id.slice(0, 8) : "Sin dueño");

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es") : "—");

/** Tope diario de créditos del Estudio de una caja: lo gastado hoy y un campo para cambiarlo. */
function TopeCaja({ c, onGuardado }: { c: CajaAdmin; onGuardado: (id: string, tope: number) => void }) {
  const [valor, setValor] = useState(String(c.tope_diario));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/cajas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caja_id: c.id, tope_diario: Number(valor) }),
      });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "No se pudo guardar el tope.");
      else onGuardado(c.id, Number(valor));
    } catch {
      setError("No se pudo conectar.");
    }
    setGuardando(false);
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-mute">Hoy {c.gastado_hoy} /</span>
      <input
        className="input !w-20 !py-1"
        type="number"
        min={0}
        max={10000}
        aria-label={`Tope diario de ${c.nombre}`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <button className="btn-ghost !px-3 !py-1.5" disabled={guardando || valor.trim() === "" || Number(valor) === c.tope_diario} onClick={guardar}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </span>
  );
}

function CajasAdmin() {
  const [cajas, setCajas] = useState<CajaAdmin[]>([]);
  const [pagina, setPagina] = useState(0);
  const [hayMas, setHayMas] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [etiqueta, setEtiqueta] = useState("");
  const [creando, setCreando] = useState(false);
  const [llaveNueva, setLlaveNueva] = useState<LlaveNueva | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState<string | null>(null);

  async function cargar(p: number) {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/cajas?pagina=${p}`, { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "No se pudieron leer las cajas.");
      else {
        setCajas((prev) => (p === 0 ? d.cajas : [...prev, ...d.cajas]));
        setHayMas(!!d.hay_mas);
        setPagina(p);
      }
    } catch {
      setError("No se pudo conectar.");
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar(0);
  }, []);

  /** Comando que se ejecuta en la mini PC con `sudo`; la llave va dentro y no se vuelve a mostrar. */
  const comando = (llave: string) =>
    `sudo bash /home/empleado/empleado-ia-staging/deploy/install.sh --solo-app --central ${window.location.origin} --activar ${llave}`;

  async function crear() {
    setCreando(true);
    setError(null);
    setCopiado(false);
    try {
      const r = await fetch("/api/admin/cajas/preparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "No se pudo crear la caja.");
      else {
        setLlaveNueva({ titulo: `${d.caja.etiqueta} · ${d.caja.direccion}`, llave: d.llave, vence_en: d.vence_en });
        setEtiqueta("");
        await cargar(0);
      }
    } catch {
      setError("No se pudo conectar.");
    }
    setCreando(false);
  }

  async function regenerar(c: CajaAdmin) {
    setRegenerando(c.id);
    setError(null);
    setCopiado(false);
    try {
      const r = await fetch("/api/admin/cajas/llave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caja_id: c.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "No se pudo generar la llave.");
      else setLlaveNueva({ titulo: `${c.etiqueta ?? c.nombre} · ${c.direccion}`, llave: d.llave, vence_en: d.vence_en });
    } catch {
      setError("No se pudo conectar.");
    }
    setRegenerando(null);
  }

  async function copiar() {
    if (!llaveNueva) return;
    try {
      await navigator.clipboard.writeText(comando(llaveNueva.llave));
      setCopiado(true);
    } catch {
      setError("No se pudo copiar: selecciona el comando y cópialo a mano.");
    }
  }

  async function desvincular(id: string) {
    setQuitando(id);
    setError(null);
    try {
      const r = await fetch(`/api/cajas/${id}`, { method: "DELETE" });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? "No se pudo desvincular la caja.");
      else {
        setCajas((prev) => prev.filter((c) => c.id !== id));
        setConfirmar(null);
      }
    } catch {
      setError("No se pudo conectar.");
    }
    setQuitando(null);
  }

  const topeGuardado = (id: string, tope: number) => setCajas((prev) => prev.map((x) => (x.id === id ? { ...x, tope_diario: tope } : x)));

  const acciones = (c: CajaAdmin) =>
    confirmar === c.id ? (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-mute">¿Eliminar «{c.etiqueta ?? c.nombre}»? Se borra su túnel y su dirección.</span>
        <button className="btn-ghost !px-3 !py-1.5 !text-red-400" disabled={quitando === c.id} onClick={() => desvincular(c.id)}>
          {quitando === c.id ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button className="btn-ghost !px-3 !py-1.5" disabled={quitando === c.id} onClick={() => setConfirmar(null)}>
          Cancelar
        </button>
      </span>
    ) : (
      <span className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost !px-3 !py-1.5" disabled={regenerando === c.id} onClick={() => regenerar(c)}>
          {regenerando === c.id ? "Generando…" : "Regenerar llave"}
        </button>
        <button className="btn-ghost !px-3 !py-1.5" onClick={() => setConfirmar(c.id)}>
          Eliminar
        </button>
      </span>
    );

  const asignacion = (c: CajaAdmin) => (
    <span className={`rounded-full border border-line px-2 py-0.5 text-xs ${c.asignacion === "preparada" ? "text-amber-400" : "text-emerald-400"}`}>
      {c.asignacion === "preparada" ? (c.activada ? "Preparada" : "Sin activar") : "Asignada"}
    </span>
  );

  const estado = (c: CajaAdmin) => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${c.estado === "encendida" ? "bg-emerald-400" : "bg-red-400"}`} />
      {c.estado === "encendida" ? "Encendida" : "Apagada"}
    </span>
  );

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Cajas</h2>

      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (etiqueta.trim()) void crear();
        }}
      >
        <label className="grow text-sm">
          <span className="text-mute">Etiqueta de la caja nueva (para ti: p. ej. el nombre del cliente)</span>
          <input className="input mt-1 w-full" maxLength={80} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Cliente Bodega López" />
        </label>
        <button className="btn-primary" disabled={creando || !etiqueta.trim()}>
          {creando ? "Creando…" : "Crear caja"}
        </button>
      </form>

      {llaveNueva && (
        <div role="status" className="mt-3 rounded-xl border border-line bg-panel-2 p-3 text-sm">
          <p className="font-medium">Llave de activación de {llaveNueva.titulo}</p>
          <p className="mt-1 text-amber-400">Guárdala ahora: no se vuelve a mostrar. Sirve una sola vez y vence el {fecha(llaveNueva.vence_en)}.</p>
          <p className="mt-2 text-mute">Ejecuta esto en la mini PC, con la sesión que usa sudo:</p>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-black/40 p-2 text-xs">{comando(llaveNueva.llave)}</pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-ghost !px-3 !py-1.5" onClick={copiar}>
              {copiado ? "Copiado" : "Copiar comando"}
            </button>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => setLlaveNueva(null)}>
              Ya la guardé
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {!cajas.length && !cargando && !error && <p className="mt-2 text-sm text-mute">Todavía no hay cajas. Crea la primera arriba.</p>}

      {/* Móvil: tarjetas apiladas */}
      <ul className="mt-3 space-y-3 md:hidden">
        {cajas.map((c) => (
          <li key={c.id} className="rounded-xl border border-line p-3 text-sm">
            <p className="font-medium">
              {c.etiqueta ?? c.nombre} {asignacion(c)}
            </p>
            <p className="break-all text-xs text-mute">{c.direccion}</p>
            <p className="mt-2">{estado(c)}</p>
            <p className="text-xs text-mute">
              Dueño {dueno(c)} · versión {c.version ?? "—"}
            </p>
            <p className="text-xs text-mute">Última señal: {fecha(c.ultima_senal)}</p>
            <p className="text-xs text-mute">Vinculada: {fecha(c.vinculada_en)}</p>
            <div className="mt-2">
              <TopeCaja key={`${c.id}-${c.tope_diario}`} c={c} onGuardado={topeGuardado} />
            </div>
            <div className="mt-2">{acciones(c)}</div>
          </li>
        ))}
      </ul>

      {/* Pantallas grandes: tabla */}
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-mute">
            <tr>
              <th className="py-2">Caja</th>
              <th>Asignación</th>
              <th>Dueño</th>
              <th>Dirección</th>
              <th>Estado</th>
              <th>Última señal</th>
              <th>Versión</th>
              <th>Estudio (créditos hoy / tope)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cajas.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-2 pr-3">{c.etiqueta ?? c.nombre}</td>
                <td className="pr-3">{asignacion(c)}</td>
                <td className="pr-3 font-mono text-xs">{dueno(c)}</td>
                <td className="pr-3 text-xs">{c.direccion}</td>
                <td className="pr-3">{estado(c)}</td>
                <td className="pr-3 text-xs">{fecha(c.ultima_senal)}</td>
                <td className="pr-3 text-xs">{c.version ?? "—"}</td>
                <td className="pr-3">
                  <TopeCaja key={`${c.id}-${c.tope_diario}`} c={c} onGuardado={topeGuardado} />
                </td>
                <td>{acciones(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cargando && <p className="mt-3 text-sm text-mute">Cargando…</p>}
      {hayMas && !cargando && (
        <button className="btn-ghost mt-3" onClick={() => cargar(pagina + 1)}>
          Cargar más
        </button>
      )}
    </section>
  );
}

export default function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then(async (r) => r.ok && setStats(await r.json()));
  }, []);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const r = await fetch("/api/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, credits, note }),
    });
    const d = await r.json();
    setMsg(r.ok ? `Listo. Nuevo saldo de ${email}: ${d.balance} créditos.` : d.error);
    if (r.ok) {
      setCredits("");
      setNote("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Ventas (30 días)", stats ? `$${stats.revenueUsd.toFixed(2)}` : "—"],
          ["Compras", stats?.purchases ?? "—"],
          ["Compradores", stats?.buyers ?? "—"],
        ].map(([k, v]) => (
          <div key={k as string} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-mute">{k}</p>
            <p className="mt-1 text-2xl font-extrabold">{v}</p>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Uso por modelo (30 días)</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-mute">
            <tr>
              <th className="py-2">Modelo</th>
              <th>Generaciones</th>
              <th>En servidor local</th>
              <th>Fallidas</th>
              <th>Créditos cobrados</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => {
              const s = stats?.byModel[m.id];
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2">{m.name}</td>
                  <td>{s?.total ?? 0}</td>
                  <td>{m.localCapable ? s?.local ?? 0 : "—"}</td>
                  <td>{s?.failed ?? 0}</td>
                  <td>{s?.credits ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Servidores locales</h2>
        {!stats?.workers.length ? (
          <p className="mt-2 text-sm text-mute">Ninguno registrado. Wan 2.2 y Qwen-Image se generan en fal.ai.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {stats.workers.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${w.online ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="font-medium">{w.id}</span>
                <span className="text-mute">{w.info?.gpu ?? ""}</span>
                <span className="text-mute">{w.models.join(", ")}</span>
                <span className="text-mute">visto {new Date(w.lastSeen).toLocaleString("es")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CajasAdmin />

      <section className="card p-5">
        <h2 className="font-semibold">Regalar créditos</h2>
        <p className="mt-1 text-sm text-mute">Para pagos por transferencia/Yape, promociones o compensaciones.</p>
        <form onSubmit={grant} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto]">
          <input className="input" type="email" required placeholder="email del usuario" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="number" min={1} required placeholder="créditos" value={credits} onChange={(e) => setCredits(e.target.value)} />
          <input className="input" placeholder="nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary">Acreditar</button>
        </form>
        {msg && <p className="mt-3 text-sm text-mute">{msg}</p>}
      </section>

      <PedidosMinipc />
    </div>
  );
}
