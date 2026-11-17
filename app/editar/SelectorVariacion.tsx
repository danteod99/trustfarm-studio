"use client";

// Selector de variación (Ninguna / Pantalla real / Marco o fondo) + su sub-opción, compartido por Perfil de TikTok y los bucles.

import { Frame, MonitorPlay } from "lucide-react";
import { MAX_SALIDAS, MAX_VERSIONES, videosPermitidos, ESTILOS_MARCO, ESTILOS_MARCO_TEXTO, type Dispositivo, type EstiloMarco, type Variacion } from "@/app/lib/variacion";

export type PantallaSel = "mixto" | Dispositivo;
export interface SeleccionVariacion { variacion: Variacion | null; pantalla: PantallaSel; estilo: EstiloMarco }

const TIPOS: { k: Variacion | null; t: string; d: string }[] = [
  { k: null, t: "Ninguna", d: "Solo se bajan los videos tal cual, sin marca de agua." },
  { k: "pantalla_real", t: "Pantalla real", d: "Cada video se compone dentro de un dispositivo real (laptop, TV, celular, tablet o monitor), con luz suave de fondo, en vertical 1080×1920." },
  { k: "marco", t: "Marco o fondo", d: "El video va centrado sobre un fondo desenfocado, de color o dentro de un marco. Sin dispositivo, 1080×1920." },
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
            {([["mixto", "Cualquiera (variado)"], ["laptop", "Laptop"], ["tv", "TV"], ["movil", "Celular"], ["tablet", "Tablet"], ["monitor", "Monitor"]] as [PantallaSel, string][]).map(([k, t]) => (
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

/** «Versiones por video»: incluidas en el precio. `videos` = videos del perfil que se bajarán (null en bucles). */
export function SelectorVersiones({ value, onChange, videos, disabled }: { value: number; onChange: (n: number) => void; videos?: number; disabled?: boolean }) {
  const reales = videos ? videosPermitidos(videos, value) : null;
  return (
    <label className="block text-sm">
      <span className="font-semibold">Versiones por video: {value}</span>
      <span className="ml-2 text-xs text-brand-2">incluidas en el precio</span>
      <input type="range" min={1} max={MAX_VERSIONES} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 block w-full accent-cyan-400" />
      <span className="mt-1 block text-xs text-mute">
        {value === 1
          ? "Una sola salida por video."
          : "Cada video sale en varias versiones distintas (color, brillo, contraste, tono y volumen), cada una con su propia plantilla o marco, para publicar sin repetir."}
        {reales != null && ` Total: ${reales} ${reales === 1 ? "video" : "videos"} × ${value} = ${reales * value} listos para postear.`}
        {reales != null && videos && reales < videos && ` (Máximo ${MAX_SALIDAS} salidas por trabajo: se bajarán ${reales} videos.)`}
      </span>
    </label>
  );
}
