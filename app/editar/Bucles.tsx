"use client";

// «Repetir»: el bucle de una herramienta (Multiclipping / Perfil de TikTok). Se repite solo según días y hora de Lima
// y cada resultado queda como «entrega» que TrustFarm Desktop recoge a la carpeta de su bucle de publicación.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { ErrorBox } from "@/app/editar/ToolHeader";
import SelectorVariacion, { cuerpoVariacion, type SeleccionVariacion } from "@/app/editar/SelectorVariacion";
import { textoVariacion } from "@/app/lib/variacion";

type Tool = "multiclip" | "perfil";
interface Vuelta { status: string; source_ref: string; error: string | null; created_at: string }
interface Bucle {
  id: string; tool: Tool; name: string; status: "active" | "paused" | "error" | "no_credits"; days: number[]; hora: number; minuto: number;
  daily_cap: number; max_per_run: number; variacion: string | null; pantalla: string | null; estilo?: string | null; last_error: string | null;
  next_run_at: string; last_run_at: string | null; entregas: Record<string, number>; ultimas_vueltas: Vuelta[];
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ESTADO: Record<Bucle["status"], { t: string; c: string }> = {
  active: { t: "Activo", c: "text-emerald-400" },
  paused: { t: "En pausa", c: "text-mute" },
  error: { t: "Detenido por errores", c: "text-red-400" },
  no_credits: { t: "Sin créditos", c: "text-amber-300" },
};
const fmt = (iso: string) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
const hh = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

export default function Bucles({ tool, precio, precioVariacion }: { tool: Tool; precio: number; precioVariacion: number }) {
  const [bucles, setBucles] = useState<Bucle[]>([]);
  const [disponible, setDisponible] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [fuente, setFuente] = useState("");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hora, setHora] = useState("09:00");
  const [tope, setTope] = useState(2);
  const [porVuelta, setPorVuelta] = useState(1);
  const [sel, setSel] = useState<SeleccionVariacion>({ variacion: null, pantalla: "mixto", estilo: "mixto" });
  const [desdeAhora, setDesdeAhora] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/bucles?tool=${tool}`).catch(() => null);
    if (!r?.ok) return;
    const d = await r.json();
    setBucles(d.loops || []);
    setDisponible(d.disponible !== false);
  }, [tool]);
  useEffect(() => { cargar(); }, [cargar]);

  const costo = sel.variacion ? precioVariacion : precio;

  const crear = async () => {
    setError(null); setBusy(true);
    try {
      const [h, m] = hora.split(":").map(Number);
      const r = await fetch("/api/bucles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool, days, hora: h, minuto: m, daily_cap: tope, max_per_run: tool === "perfil" ? 1 : porVuelta,
          ...cuerpoVariacion(sel),
          ...(tool === "perfil" ? { usuario: fuente } : { url: fuente, desde_ahora: desdeAhora }),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo crear el bucle.");
      setFuente(""); setAbierto(false);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const accion = async (id: string, a: "pausar" | "reanudar") => {
    const r = await fetch(`/api/bucles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: a }) });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || "No se pudo actualizar.");
    await cargar();
  };
  const borrar = async (id: string) => {
    if (!confirm("¿Borrar este bucle? Las entregas que aún no se recogieron también se borran.")) return;
    const r = await fetch(`/api/bucles/${id}`, { method: "DELETE" });
    if (!r.ok) setError((await r.json().catch(() => ({}))).error || "No se pudo borrar.");
    await cargar();
  };

  if (!disponible) return null; // la migración de bucles todavía no se aplicó

  return (
    <div className="card mt-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Repeat size={15} className="text-brand-2" /> Bucles automáticos</h2>
        <button type="button" onClick={() => setAbierto((v) => !v)} className="btn-ghost !px-3 !py-1.5 text-xs">
          <Repeat size={13} /> {abierto ? "Cerrar" : "Repetir"}
        </button>
      </div>
      <p className="mt-2 text-xs text-mute">
        {tool === "perfil"
          ? "Baja solo los videos nuevos de un perfil de TikTok a la hora que elijas."
          : "Procesa solo los videos nuevos de un canal de YouTube a la hora que elijas."}{" "}
        Cada resultado queda como entrega para TrustFarm Desktop. <b className="text-ink">Necesita el desktop encendido</b> para recogerlas
        (esperan 7 días en la nube).
      </p>
      {error && <div className="mt-3"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      {abierto && (
        <div className="mt-4 space-y-4 rounded-xl border border-line bg-panel-2 p-4">
          <label className="block text-sm">
            <span className="font-semibold">{tool === "perfil" ? "Perfil de TikTok" : "Link de YouTube (canal, lista o video)"}</span>
            <input value={fuente} onChange={(e) => setFuente(e.target.value)} className="input mt-2" disabled={busy}
              placeholder={tool === "perfil" ? "@tucuenta" : "https://www.youtube.com/@canal"} />
          </label>
          <div className="text-sm">
            <span className="font-semibold">Días (hora de Lima)</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DIAS.map((d, i) => (
                <button key={d} type="button" disabled={busy} onClick={() => setDays((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}
                  className={`chip ${days.includes(i) ? "chip-on" : ""}`}>{d}</button>
              ))}
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input !w-auto" disabled={busy} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold">Tope por día: {tope} trabajo{tope > 1 ? "s" : ""}</span>
              <input type="range" min={1} max={5} value={tope} onChange={(e) => setTope(Number(e.target.value))} className="mt-2 block w-full accent-cyan-400" disabled={busy} />
            </label>
            {tool === "multiclip" && (
              <label className="text-sm">
                <span className="font-semibold">Videos por vuelta: {porVuelta}</span>
                <input type="range" min={1} max={5} value={porVuelta} onChange={(e) => setPorVuelta(Number(e.target.value))} className="mt-2 block w-full accent-cyan-400" disabled={busy} />
              </label>
            )}
          </div>
          <SelectorVariacion value={sel} onChange={setSel} disabled={busy} compacto />
          {tool === "multiclip" && (
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={desdeAhora} onChange={(e) => setDesdeAhora(e.target.checked)} className="mt-1 accent-cyan-400" disabled={busy} />
              <span><span className="font-semibold">Solo videos que suba desde ahora</span>
                <span className="block text-xs text-mute">Si lo desmarcas, empieza por los más recientes que ya tiene el canal.</span></span>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={crear} disabled={busy || !fuente.trim() || days.length === 0} className="btn-primary">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Repeat size={16} />} Crear bucle
            </button>
            <span className="text-sm">Costo: <span className="font-semibold text-brand-2">{costo} créditos</span> por trabajo, cobrado en cada vuelta
              (máx. {costo * tope}/día). Si falla, se devuelve.</span>
          </div>
        </div>
      )}

      {bucles.length > 0 && (
        <div className="mt-4 space-y-3">
          {bucles.map((b) => {
            const e = b.entregas || {};
            const est = ESTADO[b.status];
            return (
              <div key={b.id} className="rounded-xl border border-line bg-panel-2 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{b.name}</p>
                    <p className="text-xs text-mute">
                      {b.days.map((d) => DIAS[d]).join(" ")} {hh(b.hora, b.minuto)} · tope {b.daily_cap}/día{b.tool === "multiclip" ? ` · ${b.max_per_run} por vuelta` : ""}
                      {b.variacion ? ` · ${textoVariacion(b.variacion, b.estilo, b.pantalla)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${est.c}`}>{est.t}</span>
                    {b.status === "active"
                      ? <button type="button" onClick={() => accion(b.id, "pausar")} className="btn-ghost !px-2.5 !py-1 text-xs"><Pause size={12} /> Pausar</button>
                      : <button type="button" onClick={() => accion(b.id, "reanudar")} className="btn-primary !px-2.5 !py-1 text-xs"><Play size={12} /> Reanudar</button>}
                    <button type="button" onClick={() => borrar(b.id)} aria-label="Borrar" className="text-mute hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-mute">
                  Última vuelta: {b.last_run_at ? fmt(b.last_run_at) : "—"}
                  {b.status === "active" && <> · Próxima: {fmt(b.next_run_at)}</>}
                  {" · "}Entregas: <b className="text-ink">{(e.pending_pickup || 0) + (e.picked || 0)}</b> por recoger · <b className="text-ink">{e.delivered || 0}</b> entregadas
                  {(e.failed || 0) + (e.expired || 0) > 0 && <> · {(e.failed || 0) + (e.expired || 0)} perdidas</>}
                </p>
                {b.last_error && <p className="mt-1 text-xs text-amber-300">{b.last_error}</p>}
                {(e.pending_pickup || 0) > 0 && <p className="mt-1 text-xs text-sky-300">Hay entregas esperando: abre TrustFarm Desktop para que las recoja.</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
