"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { PACKS } from "@/app/lib/catalog";

interface Me {
  balance: number;
  ledger: { delta: number; balance_after: number | null; reason: string; created_at: string }[];
}

const REASON: Record<string, string> = {
  stripe: "Compra de créditos",
  refund: "Devolución por generación fallida",
  admin: "Créditos de regalo",
};

function reasonLabel(r: string) {
  if (REASON[r]) return REASON[r];
  if (r.startsWith("gen:")) return "Generación";
  return r;
}

export default function Credits() {
  const params = useSearchParams();
  const paid = params.get("pago") === "ok";
  const [me, setMe] = useState<Me | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let tries = 0;
    let stop = false;
    async function load() {
      const r = await fetch("/api/me");
      if (r.ok && !stop) setMe(await r.json());
    }
    load();
    // Al volver de Stripe el webhook puede tardar unos segundos en acreditar.
    const t = paid
      ? setInterval(() => {
          if (++tries > 6) return clearInterval(t);
          load();
        }, 3000)
      : undefined;
    return () => {
      stop = true;
      if (t) clearInterval(t);
    };
  }, [paid]);

  async function buy(pack: string) {
    setBuying(pack);
    setError(null);
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else {
      setError(d.error || "No se pudo iniciar el pago.");
      setBuying(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Créditos</h1>
          <p className="mt-1 text-mute">Pago único, sin suscripción. Los créditos no vencen.</p>
        </div>
        <div className="card px-5 py-3 text-right">
          <p className="text-xs uppercase tracking-wider text-mute">Tu saldo</p>
          <p className="text-2xl font-extrabold">{me ? me.balance : "—"} créditos</p>
        </div>
      </div>

      {paid && (
        <p className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-300">
          <CheckCircle2 size={16} /> ¡Pago recibido! Tus créditos se acreditan en unos segundos.
        </p>
      )}
      {error && <p className="mt-6 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PACKS.map((p) => (
          <div key={p.id} className={`card flex flex-col p-6 ${p.popular ? "border-brand" : ""}`}>
            <h3 className="font-semibold">{p.name}</h3>
            <p className="mt-3 text-3xl font-extrabold">${p.priceUsd}</p>
            <p className="mt-1 flex-1 text-sm text-mute">
              {p.credits.toLocaleString("es")} créditos {p.bonus && <span className="text-brand-2">({p.bonus})</span>}
            </p>
            <button onClick={() => buy(p.id)} disabled={!!buying} className={`mt-5 ${p.popular ? "btn-primary" : "btn-ghost"}`}>
              {buying === p.id ? <Loader2 size={15} className="animate-spin" /> : null}
              Comprar
            </button>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-mute">
        <ShieldCheck size={15} /> Pago seguro con tarjeta a través de Stripe.
      </p>

      <h2 className="mt-12 text-lg font-semibold">Movimientos</h2>
      <div className="card mt-3 divide-y divide-line">
        {!me?.ledger.length ? (
          <p className="p-5 text-sm text-mute">Sin movimientos todavía.</p>
        ) : (
          me.ledger.map((l, i) => (
            <div key={i} className="flex items-center justify-between p-4 text-sm">
              <div>
                <p>{reasonLabel(l.reason)}</p>
                <p className="text-xs text-mute">{new Date(l.created_at).toLocaleString("es")}</p>
              </div>
              <span className={l.delta > 0 ? "font-semibold text-emerald-400" : "text-mute"}>
                {l.delta > 0 ? "+" : ""}
                {l.delta}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
