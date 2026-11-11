"use client";

// Panel de estilo de Multiclipping: subtítulos, título (colores de marca) y logo, con vista previa.
// El estilo se recuerda en este navegador para reusarlo en el siguiente video.

import { useRef, useState } from "react";
import { ImagePlus, Palette, RotateCcw, X } from "lucide-react";
import {
  ESTILO_DEFAULT, FONTS, LOGO_POSITIONS, MAX_LOGO_B64, SUB_POSITIONS, SUB_PRESETS, SUB_PRESET_DEFAULTS,
  TITLE_POSITIONS, type EstiloClips,
} from "@/app/lib/estilo-clips";

const fontCss = (id: string) => FONTS.find((f) => f.id === id)?.css || FONTS[0].css;
const hexRgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Reduce el logo a PNG de máximo 400 px de ancho para que pese poco. */
async function logoAPng(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const w = Math.min(400, bmp.width);
  const h = Math.round((bmp.height * w) / bmp.width);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  return c.toDataURL("image/png");
}

function Colores({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-mute">
      <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-8 cursor-pointer rounded border border-line bg-transparent p-0" />
      {label}
    </label>
  );
}

function Fila<T extends readonly { id: string; label: string }[]>({ items, value, onPick, disabled }: { items: T; value: string; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((o) => (
        <button key={o.id} type="button" disabled={disabled} onClick={() => onPick(o.id)} className={`chip ${value === o.id ? "chip-on" : ""}`}>{o.label}</button>
      ))}
    </div>
  );
}

export default function EstiloClipsPanel({ estilo, onChange, disabled, conSubs, conTitulo }: {
  estilo: EstiloClips; onChange: (e: EstiloClips) => void; disabled?: boolean; conSubs: boolean; conTitulo: boolean;
}) {
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const setSubs = (p: Partial<EstiloClips["subs"]>) => onChange({ ...estilo, subs: { ...estilo.subs, ...p } });
  const setTitle = (p: Partial<EstiloClips["title"]>) => onChange({ ...estilo, title: { ...estilo.title, ...p } });

  const pickLogo = async (f: File | undefined) => {
    setErr(null);
    if (!f) return;
    try {
      const data = await logoAPng(f);
      if (data.length > MAX_LOGO_B64) throw new Error("big");
      onChange({ ...estilo, logo: { data, position: estilo.logo?.position || "tr", scale: estilo.logo?.scale || 0.18 } });
    } catch {
      setErr("No se pudo usar esa imagen. Prueba con un PNG o JPG más liviano.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const sp = estilo.subs, tt = estilo.title, lg = estilo.logo;
  const subSize = sp.preset === "tiktok" ? 15 : sp.preset === "minimal" ? 9 : sp.preset === "box" ? 12 : 11;
  const subTop = sp.position === "bottom" ? "78%" : sp.position === "center" ? "50%" : "27%";
  const titleTop = tt.position === "top" ? "9%" : "18%";
  const logoPos: Record<string, React.CSSProperties> = {
    tl: { left: "4%", top: "3%" }, tr: { right: "4%", top: "3%" }, bl: { left: "4%", bottom: "13%" }, br: { right: "4%", bottom: "13%" },
  };

  return (
    <div className="rounded-xl border border-line bg-panel-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold"><Palette size={15} className="text-brand-2" /> Estilo y marca</span>
        <button type="button" disabled={disabled} onClick={() => onChange(ESTILO_DEFAULT)} className="btn-ghost !py-1 text-xs"><RotateCcw size={12} /> Restablecer</button>
      </div>
      <div className="grid gap-5 md:grid-cols-[1fr_150px]">
        <div className="space-y-5 text-sm">
          {conSubs && (
            <section className="space-y-2">
              <div className="font-semibold">Subtítulos</div>
              <div className="flex flex-wrap gap-2">
                {SUB_PRESETS.map((p) => (
                  <button key={p.id} type="button" disabled={disabled} title={p.hint}
                    onClick={() => setSubs({ preset: p.id, ...SUB_PRESET_DEFAULTS[p.id] })}
                    className={`chip ${sp.preset === p.id ? "chip-on" : ""}`}>{p.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Colores label="Texto" value={sp.color} onChange={(v) => setSubs({ color: v })} disabled={disabled} />
                <Colores label={sp.preset === "box" ? "Fondo" : "Borde"} value={sp.outline_color} onChange={(v) => setSubs({ outline_color: v })} disabled={disabled} />
              </div>
              <div className="text-xs text-mute">Posición</div>
              <Fila items={SUB_POSITIONS} value={sp.position} onPick={(id) => setSubs({ position: id })} disabled={disabled} />
              <div className="text-xs text-mute">Letra</div>
              <Fila items={FONTS} value={sp.font} onPick={(id) => setSubs({ font: id })} disabled={disabled} />
            </section>
          )}
          {conTitulo && (
            <section className="space-y-2">
              <div className="font-semibold">Título</div>
              <div className="flex flex-wrap items-center gap-4">
                <Colores label="Texto" value={tt.color} onChange={(v) => setTitle({ color: v })} disabled={disabled} />
                <Colores label="Fondo" value={tt.bg} onChange={(v) => setTitle({ bg: v })} disabled={disabled} />
                <label className="flex items-center gap-2 text-xs text-mute">
                  Opacidad del fondo
                  <input type="range" min={0} max={100} value={Math.round(tt.bg_opacity * 100)} disabled={disabled}
                    onChange={(e) => setTitle({ bg_opacity: Number(e.target.value) / 100 })} className="w-24 accent-cyan-400" />
                  {Math.round(tt.bg_opacity * 100)}%
                </label>
              </div>
              <div className="text-xs text-mute">Posición</div>
              <Fila items={TITLE_POSITIONS} value={tt.position} onPick={(id) => setTitle({ position: id })} disabled={disabled} />
              <div className="text-xs text-mute">Letra</div>
              <Fila items={FONTS} value={tt.font} onPick={(id) => setTitle({ font: id })} disabled={disabled} />
            </section>
          )}
          <section className="space-y-2">
            <div className="font-semibold">Logo o marca de agua</div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            {!lg ? (
              <button type="button" disabled={disabled} onClick={() => fileRef.current?.click()} className="btn-ghost text-xs"><ImagePlus size={14} /> Subir logo</button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lg.data} alt="Logo" className="h-10 w-10 rounded border border-line bg-black/40 object-contain" />
                <div className="flex gap-1">
                  {LOGO_POSITIONS.map((p) => (
                    <button key={p.id} type="button" disabled={disabled} onClick={() => onChange({ ...estilo, logo: { ...lg, position: p.id } })}
                      className={`chip !px-2.5 ${lg.position === p.id ? "chip-on" : ""}`}>{p.label}</button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-mute">
                  Tamaño
                  <input type="range" min={8} max={40} value={Math.round(lg.scale * 100)} disabled={disabled}
                    onChange={(e) => onChange({ ...estilo, logo: { ...lg, scale: Number(e.target.value) / 100 } })} className="w-24 accent-cyan-400" />
                </label>
                <button type="button" disabled={disabled} onClick={() => onChange({ ...estilo, logo: null })} className="text-mute hover:text-red-400" aria-label="Quitar logo"><X size={15} /></button>
              </div>
            )}
            {err && <p className="text-xs text-red-400">{err}</p>}
          </section>
        </div>

        {/* Vista previa aproximada (el render real usa ffmpeg: puede variar un poco) */}
        <div className="mx-auto w-[150px]">
          <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-line bg-gradient-to-b from-slate-700 to-slate-900">
            {conTitulo && (
              <div className="absolute left-0 right-0 text-center" style={{ top: titleTop }}>
                <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold leading-tight"
                  style={{ color: tt.color, background: hexRgba(tt.bg, tt.bg_opacity), fontFamily: fontCss(tt.font) }}>
                  Cómo ganar dinero<br />con granjas de bots
                </span>
              </div>
            )}
            {conSubs && (
              <div className="absolute left-0 right-0 -translate-y-1/2 text-center" style={{ top: subTop }}>
                <span className="inline-block px-1 font-extrabold uppercase leading-tight"
                  style={{
                    fontSize: subSize, fontFamily: fontCss(sp.font), color: sp.color,
                    background: sp.preset === "box" ? hexRgba(sp.outline_color, 0.75) : undefined,
                    textShadow: sp.preset === "box" ? undefined : `0 0 2px ${sp.outline_color}, 1px 1px 0 ${sp.outline_color}, -1px -1px 0 ${sp.outline_color}, 1px -1px 0 ${sp.outline_color}, -1px 1px 0 ${sp.outline_color}`,
                  }}>
                  Hola mundo
                </span>
              </div>
            )}
            {lg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lg.data} alt="" className="absolute object-contain" style={{ ...logoPos[lg.position], width: `${lg.scale * 100}%` }} />
            )}
          </div>
          <p className="mt-1 text-center text-[10px] text-mute">Vista previa aproximada</p>
        </div>
      </div>
    </div>
  );
}
