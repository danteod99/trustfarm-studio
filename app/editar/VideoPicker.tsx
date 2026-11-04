"use client";

import { useRef, useState } from "react";
import { FolderOpen, Loader2, Upload, X } from "lucide-react";
import { fetchAsFile, fmtMB, isVideoFile } from "@/app/lib/video";

interface GalleryVideo { id: string; kind: string; status: string; url: string | null; prompt: string; createdAt: string }

interface Props {
  /** Recibe los videos elegidos (subidos o de la galería). */
  onFiles: (files: File[]) => void;
  onError: (msg: string) => void;
  multiple?: boolean;
  maxMB: number;
  disabled?: boolean;
  /** Texto principal del recuadro. */
  title: string;
  hint?: string;
  /** Mostrar el botón «De mi galería». */
  gallery?: boolean;
}

/** Recuadro para soltar/elegir videos + selector de videos de la galería del usuario. */
export default function VideoPicker({ onFiles, onError, multiple, maxMB, disabled, title, hint, gallery = true }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<GalleryVideo[] | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pct, setPct] = useState(0);

  const accept = (list: FileList | File[]) => {
    const all = Array.from(list);
    const vids = all.filter(isVideoFile);
    if (!vids.length) return onError("Solo se aceptan videos (MP4, MOV o WebM).");
    const big = vids.find((f) => f.size > maxMB * 1024 * 1024);
    if (big) return onError(`"${big.name}" pesa ${fmtMB(big.size)}: el máximo es ${maxMB} MB.`);
    onFiles(multiple ? vids : vids.slice(0, 1));
  };

  const openGallery = async () => {
    setOpen(true);
    if (items) return;
    try {
      const r = await fetch("/api/generations?kind=video&limit=60");
      const d = await r.json();
      setItems(((d.generations ?? []) as GalleryVideo[]).filter((g) => g.status === "done" && g.url));
    } catch {
      setItems([]);
    }
  };

  const pick = async (g: GalleryVideo) => {
    if (!g.url || picking) return;
    setPicking(g.id);
    setPct(0);
    try {
      const f = await fetchAsFile(g.url, `galeria-${g.id.slice(0, 8)}.mp4`, setPct);
      onFiles([f]);
      setOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo traer el video de tu galería.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) accept(e.dataTransfer.files); }}
        className={`card cursor-pointer border-2 border-dashed px-6 py-9 text-center transition ${
          drag ? "border-brand-2 bg-brand/10" : "border-line hover:border-brand/60"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm"
          multiple={multiple}
          className="hidden"
          onChange={(e) => { if (e.target.files) accept(e.target.files); e.target.value = ""; }}
        />
        <Upload size={26} className="mx-auto mb-2 text-brand-2" />
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-xs text-mute">{hint ?? `MP4, MOV o WebM · máx. ${maxMB} MB`}</p>
        {gallery && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openGallery(); }}
            className="btn-ghost mt-4 !py-1.5 text-xs"
          >
            <FolderOpen size={14} className="text-brand-2" /> Elegir de mi galería
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !picking && setOpen(false)}>
          <div className="card max-h-[80vh] w-full max-w-3xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Tus videos generados</h3>
              <button onClick={() => !picking && setOpen(false)} aria-label="Cerrar" className="text-mute hover:text-ink">
                <X size={18} />
              </button>
            </div>
            {items === null ? (
              <p className="text-sm text-mute"><Loader2 size={14} className="mr-2 inline animate-spin" />Cargando…</p>
            ) : !items.length ? (
              <p className="text-sm text-mute">Aún no tienes videos listos en tu galería. Genera uno en el Estudio o sube un archivo.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => pick(g)}
                    disabled={!!picking}
                    className="group relative overflow-hidden rounded-xl border border-line bg-panel-2 text-left transition hover:border-brand"
                  >
                    <video src={g.url!} muted playsInline preload="metadata" className="aspect-[9/16] w-full object-cover" />
                    <p className="line-clamp-2 p-2 text-[11px] text-mute">{g.prompt}</p>
                    {picking === g.id && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 text-xs">
                        <Loader2 size={18} className="animate-spin text-brand-2" />
                        {Math.round(pct * 100)}%
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
