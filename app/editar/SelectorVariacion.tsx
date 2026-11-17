"use client";

// Selector de variación (Ninguna / Pantalla real / Marco o fondo) + su sub-opción, compartido por Perfil de TikTok y los bucles.

import { Frame, MonitorPlay } from "lucide-react";
import { ESTILOS_MARCO, ESTILOS_MARCO_TEXTO, type EstiloMarco, type Variacion } from "@/app/lib/variacion";

export type PantallaSel = "mixto" | "laptop" | "tv";
export interface SeleccionVariacion { variacion: Variacion | null; pantalla: PantallaSel; estilo: EstiloMarco }

const TIPOS: { k: Variacion | null; t: string; d: string }[] = [
  { k: null, t: "Ninguna", d: "Solo se bajan los videos tal cual, sin marca de agua." },
  { k: "pantalla_real", t: "Pantalla real laptop/TV", d: "Cada video se compone dentro de una laptop o TV reales, con luz suave de fondo, en vertical 1080×1920." },
  { k: "marco", t: "Marco o fondo", d: "El video va centrado sobre un fondo desenfocado, de color o dentro de un marco. Sin laptop ni TV, 1080×1920." },
];

export default function SelectorVariacion({ value, onChange, disabled, compacto }: {
  value: SeleccionVariacion; onChange: (v: SeleccionVariacion) => void; disabled?: boolean; compacto?: boolean;
}) {
  const set = (p: Partial<SeleccionVariacion>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="font-semibold">Variación del video</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIPOS.map(({ k, t }) => (
            <button key={String(k)} type="button" disabled={disabled} onClick={() => set({ variacion: k })} className={`chip ${value.variacion === k ? "chip-on" : ""}`}>
              {k === "pantalla_real" && <MonitorPlay size={13} className="mr-1 inline" />}{k === "marco" && <Frame size={13} className="mr-1 inline" />}{t}
            </button>
          ))}
        </div>
        {!compacto && <p className="mt-1.5 text-xs text-mute">{TIPOS.find((x) => x.k === value.variacion)?.d}</p>}
      </div>
      {value.variacion === "pantalla_real" && (
        <div>
          <span className="font-semibold">Dispositivo</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["mixto", "Variado (laptops y TVs)"], ["laptop", "Solo laptops"], ["tv", "Solo TVs"]] as [PantallaSel, string][]).map(([k, t]) => (
              <button key={k} type="button" onClick={() => set({ pantalla: k })} disabled={disabled} className={`chip ${value.pantalla === k ? "chip-on" : ""}`}>{t}</button>
            ))}
          </div>
        </div>
      )}
      {value.variacion === "marco" && (
        <div>
          <span className="font-semibold">Estilo</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ESTILOS_MARCO.map((k) => (
              <button key={k} type="button" onClick={() => set({ estilo: k })} disabled={disabled} className={`chip ${value.estilo === k ? "chip-on" : ""}`}>{ESTILOS_MARCO_TEXTO[k].titulo}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-mute">{ESTILOS_MARCO_TEXTO[value.estilo].texto}</p>
        </div>
      )}
    </div>
  );
}

/** Lo que se manda a la API según la selección. */
export const cuerpoVariacion = (v: SeleccionVariacion) => ({
  variacion: v.variacion,
  pantalla: v.variacion === "pantalla_real" && v.pantalla !== "mixto" ? v.pantalla : undefined,
  estilo: v.variacion === "marco" ? v.estilo : undefined,
});
