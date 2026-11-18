"use client";

// Sección opcional «Poner en pantalla real» de Variaciones únicas: interruptor, dispositivo y miniaturas.
// La elección de plantilla por versión vive en app/lib/pantalla-real.ts (pura, con tests).

import { MonitorSmartphone } from "lucide-react";
import {
  FILTROS_DISPOSITIVO, etiquetaPlantillaUi, plantillasPermitidas, urlMiniatura,
  type FiltroDispositivo, type Plantilla,
} from "@/app/lib/pantalla-real";

interface Props {
  on: boolean;
  filtro: FiltroDispositivo;
  plantillas: Plantilla[] | null; // null = cargando
  disabled: boolean;
  onOn: (v: boolean) => void;
  onFiltro: (f: FiltroDispositivo) => void;
}

export default function PantallaReal({ on, filtro, plantillas, disabled, onOn, onFiltro }: Props) {
  const permitidas = plantillas ? plantillasPermitidas(plantillas, filtro) : [];
  return (
    <div className="border-t border-line pt-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onOn(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
        <span>
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${on ? "text-brand-2" : ""}`}>
            <MonitorSmartphone size={15} /> Poner en pantalla real
          </span>
          <span className="block text-xs text-mute">
            Cada versión se mete dentro de la pantalla de una laptop, PC, TV, celular o tablet reales (una plantilla distinta por versión).
            Sigue siendo gratis y en tu computadora, pero <b>tarda más</b>: calcula ~1–2 min extra por versión de 15 s. El video sale 1080×1920.
          </span>
        </span>
      </label>

      {on && (
        <div className="mt-3 space-y-3 pl-7">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS_DISPOSITIVO.map((f) => (
              <button key={f.id} onClick={() => onFiltro(f.id)} disabled={disabled} className={`chip ${filtro === f.id ? "chip-on" : ""}`}>
                {f.texto}
              </button>
            ))}
          </div>
          {plantillas === null ? (
            <p className="text-xs text-mute">Cargando plantillas…</p>
          ) : !permitidas.length ? (
            <p className="text-xs text-amber-300">No hay plantillas para ese dispositivo. Elige otro o «Cualquiera».</p>
          ) : (
            <>
              <p className="text-xs text-mute">
                {permitidas.length} plantilla{permitidas.length === 1 ? "" : "s"}: las versiones las van usando en orden, y se vuelven a repetir si hay más versiones que plantillas.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {permitidas.map((p) => (
                  <figure key={p.id} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urlMiniatura(p)} alt={etiquetaPlantillaUi(p)} width={60} height={107} loading="lazy"
                      className="h-[107px] w-[60px] rounded-md border border-line object-cover" />
                    <figcaption className="mt-0.5 w-[60px] truncate text-center text-[10px] text-mute" title={etiquetaPlantillaUi(p)}>
                      {etiquetaPlantillaUi(p).replace(/^[^·]*· ?/, "") || etiquetaPlantillaUi(p)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
