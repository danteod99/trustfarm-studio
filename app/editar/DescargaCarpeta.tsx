"use client";

// Panel «Descarga automática»: los videos nuevos de TODOS tus bucles se guardan solos en una carpeta del computador.
// Funciona con la pestaña de Studio abierta (Chrome/Edge). Es independiente de TrustFarm Desktop: no consume sus entregas.

import { useState } from "react";
import { Download, FolderOpen, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ahora, alternar, elegir, quitar, reactivar, useDescarga } from "@/app/lib/descarga-controlador";
import type { EntregaWeb } from "@/app/lib/descarga-core";

const fmt = (iso: string) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

export default function DescargaCarpeta() {
  const v = useDescarga();
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState<EntregaWeb[] | null>(null);
  const [cargandoManual, setCargandoManual] = useState(false);
  if (!v.cargado) return null;

  const verManual = async () => {
    setCargandoManual(true);
    try {
      const r = await fetch("/api/bucles/descarga", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ya: [] }) });
      const d = await r.json().catch(() => ({}));
      setManual(d.items ?? []);
    } finally { setCargandoManual(false); }
  };

  const e = v.estado;
  return (
    <div className="mt-4 rounded-xl border border-line bg-panel-2 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><FolderOpen size={15} className="text-brand-2" /> Descarga automática a una carpeta</p>
      <p className="mt-1 text-xs text-mute">
        Los videos nuevos de tus bucles (con su texto en un .txt) se guardan solos en la carpeta que elijas, sin TrustFarm Desktop.
        <b className="text-ink"> Solo funciona con esta página (Studio) abierta en Chrome o Edge</b>; al abrir el navegador de nuevo tendrás que pulsar «Reactivar».
      </p>

      {!v.soporte.ok ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-300">{v.soporte.motivo}</p>
          <button type="button" onClick={verManual} disabled={cargandoManual} className="btn-ghost !px-3 !py-1.5 text-xs">
            {cargandoManual ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar manualmente
          </button>
          {manual && (manual.length === 0 ? <p className="text-xs text-mute">No hay entregas en la nube ahora.</p> : (
            <ul className="space-y-1 text-xs">
              {manual.map((m) => m.video_url && (
                <li key={m.id}><a className="text-sky-300 underline" href={m.video_url} download>{m.loop_name} · {m.titulo || m.id.slice(0, 8)}</a></li>
              ))}
              <li className="text-mute">Se muestran hasta 10 a la vez.</li>
            </ul>
          ))}
        </div>
      ) : !e.nombreCarpeta ? (
        <div className="mt-3">
          <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" onClick={async () => setMsg(await elegir())}><FolderOpen size={13} /> Elegir carpeta</button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs">
            Carpeta: <b className="text-ink">{e.nombreCarpeta}</b> · se crea una sub-carpeta por bucle · <b className="text-ink">{e.guardados.length}</b> guardados
            {e.ultima && <> · última descarga {fmt(e.ultima)}</>}
          </p>
          {v.permiso !== "granted" && e.habilitada && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200">
              El navegador pide confirmar el permiso de la carpeta.
              <button type="button" className="btn-primary !px-2.5 !py-1 text-xs" onClick={() => reactivar()}>Reactivar</button>
            </div>
          )}
          {v.ultimo && v.ultimo.guardadas > 0 && <p className="text-xs text-emerald-400">Se guardaron {v.ultimo.guardadas} video{v.ultimo.guardadas > 1 ? "s" : ""} nuevos.</p>}
          {(v.ultimo?.errores.length || e.ultimoError) ? <p className="text-xs text-amber-300">Error: {v.ultimo?.errores[v.ultimo.errores.length - 1] ?? e.ultimoError} (se reintenta solo).</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input type="checkbox" checked={e.habilitada} onChange={(x) => alternar(x.target.checked)} className="accent-cyan-400" /> Descarga automática activa
            </label>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" disabled={v.ocupado || !e.habilitada} onClick={() => ahora()}>
              {v.ocupado ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Descargar ahora
            </button>
            <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={async () => setMsg(await elegir())}>Cambiar carpeta</button>
            <button type="button" className="text-xs text-mute hover:text-red-400" onClick={() => { if (confirm("¿Quitar la carpeta? Los archivos ya guardados no se borran.")) quitar(); }}>
              <Trash2 size={12} className="mr-1 inline" />Quitar carpeta
            </button>
          </div>
          <p className="text-xs text-mute">Con una carpeta nueva se vuelve a bajar lo que siga en la nube (las entregas duran 7 días).</p>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-red-400">{msg}</p>}
    </div>
  );
}
