"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ErrorBox } from "@/app/editar/ToolHeader";
import { MAX_FARM_ACCOUNTS, MAX_NOTES, NETWORKS, NETWORK_LABEL, accountKey, parseAccountsText, type Network } from "@/app/lib/granja";
import type { Account, Character } from "@/app/granja/Granja";

interface Props {
  accounts: Account[] | null;
  characters: Character[];
  disabled: boolean;
  onChange: (a: Account[]) => void;
  reload: () => Promise<void>;
}

const PAGE = 100;

export default function Cuentas({ accounts, characters, disabled, onChange, reload }: Props) {
  const [text, setText] = useState("");
  const [defNet, setDefNet] = useState<Network>("tiktok");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Network | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);

  const saved = useMemo(() => new Set((accounts ?? []).map(accountKey)), [accounts]);
  const preview = useMemo(() => (text.trim() ? parseAccountsText(text, defNet) : null), [text, defNet]);
  const nuevas = preview ? preview.accounts.filter((a) => !saved.has(accountKey(a))) : [];
  const room = MAX_FARM_ACCOUNTS - (accounts?.length ?? 0);

  const list = (accounts ?? []).filter((a) => filter === "all" || a.network === filter);

  const save = async () => {
    if (!nuevas.length || saving) return;
    setSaving(true); setError(null); setMsg(null);
    try {
      const r = await fetch("/api/granja/cuentas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, network: defNet }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudieron guardar.");
      const parts = [`${d.added} cuenta${d.added === 1 ? "" : "s"} guardada${d.added === 1 ? "" : "s"}`];
      if (d.alreadySaved) parts.push(`${d.alreadySaved} ya estaban`);
      if (d.overLimit) parts.push(`${d.overLimit} no entraron (máximo ${d.max})`);
      setMsg(parts.join(" · "));
      setText("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const patch = async (a: Account, change: Partial<Pick<Account, "preset_id" | "notes">>) => {
    const prev = accounts ?? [];
    onChange(prev.map((x) => (x.id === a.id ? { ...x, ...change } : x)));
    const r = await fetch(`/api/granja/cuentas/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "No se pudo guardar el cambio.");
      onChange(prev);
    }
  };

  const remove = async (a: Account) => {
    if (!confirm(`¿Borrar @${a.handle} (${NETWORK_LABEL[a.network]}) de tus cuentas?`)) return;
    setBusy(a.id);
    const r = await fetch(`/api/granja/cuentas/${a.id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) onChange((accounts ?? []).filter((x) => x.id !== a.id));
    else setError("No se pudo borrar.");
  };

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Agregar cuentas</h2>
          <p className="mt-1 text-xs text-mute">
            Pega una cuenta por línea. Sirve <code>@usuario</code>, el link del perfil (TikTok, Instagram, Facebook o YouTube) o <code>usuario,red</code>
            (por ejemplo <code>maria.ventas,ig</code>). Las repetidas se quitan solas.
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || saving}
          rows={6}
          placeholder={"@cuenta1\nhttps://www.tiktok.com/@cuenta2\nhttps://instagram.com/cuenta3\ncuenta4,facebook"}
          className="input font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2 text-xs text-mute">
          Red para los <code>@usuario</code> sueltos:
          {NETWORKS.map((n) => (
            <button key={n} onClick={() => setDefNet(n)} disabled={disabled} className={`chip ${defNet === n ? "chip-on" : ""}`}>
              {NETWORK_LABEL[n]}
            </button>
          ))}
        </div>

        {preview && (
          <div className="rounded-xl border border-line bg-panel-2 p-3 text-xs">
            <p>
              <span className="font-semibold text-brand-2">{nuevas.length} nueva{nuevas.length === 1 ? "" : "s"}</span>
              {preview.accounts.length - nuevas.length > 0 && <> · {preview.accounts.length - nuevas.length} ya guardada{preview.accounts.length - nuevas.length === 1 ? "" : "s"}</>}
              {preview.duplicates > 0 && <> · {preview.duplicates} repetida{preview.duplicates === 1 ? "" : "s"}</>}
              {preview.invalid.length > 0 && <span className="text-amber-300"> · {preview.invalid.length} no se entendieron</span>}
              {nuevas.length > room && <span className="text-amber-300"> · solo entran {Math.max(0, room)} (máximo {MAX_FARM_ACCOUNTS})</span>}
            </p>
            {nuevas.length > 0 && (
              <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                {nuevas.slice(0, 60).map((a) => (
                  <span key={accountKey(a)} className="rounded-md border border-line px-2 py-0.5">
                    @{a.handle} <span className="text-mute">· {NETWORK_LABEL[a.network]}</span>
                  </span>
                ))}
                {nuevas.length > 60 && <span className="px-2 py-0.5 text-mute">y {nuevas.length - 60} más…</span>}
              </div>
            )}
            {preview.invalid.length > 0 && (
              <p className="mt-2 text-amber-300">No se entendió: {preview.invalid.slice(0, 5).join(" · ")}{preview.invalid.length > 5 ? "…" : ""}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={disabled || saving || !nuevas.length || room <= 0} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Guardar {nuevas.length ? Math.min(nuevas.length, Math.max(0, room)) : ""} cuenta{nuevas.length === 1 ? "" : "s"}
          </button>
          {msg && <span className="text-sm text-ok">✓ {msg}</span>}
        </div>
      </div>

      {error && <ErrorBox msg={error} onClose={() => setError(null)} />}

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            Mis cuentas <span className="text-sm font-normal text-mute">({accounts?.length ?? 0} de {MAX_FARM_ACCOUNTS})</span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...NETWORKS] as const).map((n) => (
              <button key={n} onClick={() => setFilter(n)} className={`chip ${filter === n ? "chip-on" : ""}`}>
                {n === "all" ? "Todas" : NETWORK_LABEL[n]}
              </button>
            ))}
          </div>
        </div>

        {accounts === null ? (
          <p className="text-sm text-mute"><Loader2 size={14} className="mr-2 inline animate-spin" />Cargando…</p>
        ) : !list.length ? (
          <p className="text-sm text-mute">{accounts.length ? "No hay cuentas de esa red." : "Aún no agregas cuentas. Pega tu lista arriba."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th className="py-2 pr-3 font-medium">Cuenta</th>
                  <th className="py-2 pr-3 font-medium">Red</th>
                  <th className="py-2 pr-3 font-medium">Personaje</th>
                  <th className="py-2 pr-3 font-medium">Notas</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.slice(0, shown).map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-3 font-medium">@{a.handle}</td>
                    <td className="py-2 pr-3 text-mute">{NETWORK_LABEL[a.network]}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={a.preset_id ?? ""}
                        onChange={(e) => patch(a, { preset_id: e.target.value || null })}
                        className="input !py-1.5 text-xs"
                      >
                        <option value="">Sin personaje</option>
                        {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        defaultValue={a.notes}
                        maxLength={MAX_NOTES}
                        placeholder="Nota (opcional)"
                        onBlur={(e) => { if (e.target.value !== a.notes) patch(a, { notes: e.target.value }); }}
                        className="input !py-1.5 text-xs"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => remove(a)} disabled={busy === a.id} aria-label={`Borrar @${a.handle}`} className="p-1 text-mute hover:text-error">
                        {busy === a.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > shown && (
              <button onClick={() => setShown((s) => s + PAGE)} className="btn-ghost mt-3 !py-2 text-xs">Ver {Math.min(PAGE, list.length - shown)} más</button>
            )}
            {!characters.length && (
              <p className="mt-3 text-xs text-mute">Tip: crea personajes en el Estudio para asignarle uno a cada cuenta; los ganchos se escriben con su voz.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
