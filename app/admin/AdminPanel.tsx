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
