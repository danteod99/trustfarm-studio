"use client";

// «Qué videos bajar» del Perfil de TikTok (trabajo suelto y bucles): orden (más recientes / más virales), desde qué puesto y cuántos.

import { normalizarSaltar, PERFIL_MAX_SALTAR, PERFIL_MAX_VIDEOS, textoSeleccion, type OrdenPerfil } from "@/app/lib/perfil";

export interface SeleccionOrden { orden: OrdenPerfil; saltar: number; cantidad: number }

/** Lo que se manda a la API (los valores por defecto se omiten, igual que al guardarse). */
export const cuerpoOrden = (s: SeleccionOrden) => ({ orden: s.orden, saltar: s.saltar, max_videos: s.cantidad });

export default function SelectorOrden({ value, onChange, disabled, bucle }: { value: SeleccionOrden; onChange: (v: SeleccionOrden) => void; disabled?: boolean; bucle?: boolean }) {
  const virales = value.orden === "virales";
  const set = (p: Partial<SeleccionOrden>) => onChange({ ...value, ...p });
  const num = (raw: string, lo: number, hi: number, def: number) => {
    const n = Math.floor(Number(raw));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
  };
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="font-semibold">Orden</span>
          <select value={value.orden} disabled={disabled} onChange={(e) => set({ orden: e.target.value === "virales" ? "virales" : "recientes" })} className="input mt-2">
            <option value="recientes">Más recientes</option>
            <option value="virales">Más virales</option>
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Empezar desde el puesto</span>
          <input type="number" min={1} max={PERFIL_MAX_SALTAR + 1} value={value.saltar + 1} disabled={disabled}
            onChange={(e) => set({ saltar: normalizarSaltar(num(e.target.value, 1, PERFIL_MAX_SALTAR + 1, 1) - 1) })} className="input mt-2" />
        </label>
        <label className="block">
          <span className="font-semibold">Cuántos</span>
          <input type="number" min={1} max={PERFIL_MAX_VIDEOS} value={value.cantidad} disabled={disabled}
            onChange={(e) => set({ cantidad: num(e.target.value, 1, PERFIL_MAX_VIDEOS, value.cantidad) })} className="input mt-2" />
        </label>
      </div>
      <p className="text-xs text-mute">
        <b className="text-ink">{textoSeleccion(value.orden, value.saltar, value.cantidad)}</b>
        {virales
          ? ". Se ordenan por vistas entre los últimos 100 videos del perfil (el puesto 1 es el más visto)."
          : ". Se cuentan desde el video más nuevo del perfil."}
        {bucle && (virales
          ? " En cada vuelta baja los siguientes más virales que aún no se hayan entregado."
          : " En cada vuelta baja solo los que aún no se hayan entregado.")}
      </p>
    </div>
  );
}
