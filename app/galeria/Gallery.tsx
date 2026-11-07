"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Download, Film, GripVertical, Loader2, Play, RotateCcw, Trash2, X } from "lucide-react";
import Reproductor from "@/app/components/Reproductor";
import GenerationCard, { type PublicGeneration } from "@/app/components/GenerationCard";
import { useGenerations } from "@/app/components/useGenerations";
import { MAX_ESCENAS, downloadBlobUrl, mover, unirVideos } from "@/app/lib/video";

const FILTERS = [
  { id: "", label: "Todo" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Imágenes" },
];

const ASPECT_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "16:9": "aspect-video", "1:1": "aspect-square" };

const listo = (g: PublicGeneration) => g.kind === "video" && g.status === "done" && !!g.url;
const fmtSeg = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function Gallery() {
  const router = useRouter();
  const [kind, setKind] = useState("");
  const { items, loading } = useGenerations(`?limit=60${kind ? `&kind=${kind}` : ""}`);

  // Modo "Unir videos": null = apagado; si no, los ids en el orden de la unión.
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const uniendo = status !== null;

  const videosListos = items.filter(listo);
  const elegidos = (seleccion ?? []).map((id) => items.find((g) => g.id === id)).filter((g): g is PublicGeneration => !!g);
  const total = elegidos.reduce((s, g) => s + (g.params.duration ?? 8), 0);
  const aspect = elegidos[0]?.params.aspect ?? "9:16";
  const mezclados = elegidos.some((g) => g.params.aspect !== aspect);
  const actual = playing !== null ? elegidos[playing] : null;

  useEffect(() => {
    if (playing !== null) playerRef.current?.play().catch(() => {});
  }, [playing]);

  /** Cualquier cambio en la lista invalida la vista previa y el resultado anterior. */
  function cambiar(next: string[]) {
    setSeleccion(next);
    setPlaying(null);
    setResult(null);
    setError(null);
  }

  function empezar() {
    if (kind === "image") setKind("video");
    cambiar([]);
  }

  function salir() {
    if (uniendo) return;
    setSeleccion(null);
    setPlaying(null);
    setResult(null);
    setError(null);
  }

  // Tocar un video lo agrega al final; tocarlo otra vez lo quita y los demás se renumeran.
  function tocar(g: PublicGeneration) {
    if (!seleccion || uniendo || !listo(g)) return;
    if (seleccion.includes(g.id)) return cambiar(seleccion.filter((id) => id !== g.id));
    if (seleccion.length >= MAX_ESCENAS) return setError(`Máximo ${MAX_ESCENAS} videos por unión.`);
    cambiar([...seleccion, g.id]);
  }

  function soltar(to: number) {
    if (seleccion && dragFrom !== null && dragFrom !== to) cambiar(mover(seleccion, dragFrom, to));
    setDragFrom(null);
    setDragOver(null);
  }

  async function unir() {
    if (elegidos.length < 2 || uniendo) return;
    setError(null);
    setResult(null);
    setPlaying(null);
    setPct(0);
    setStatus("Preparando…");
    try {
      const blob = await unirVideos(
        elegidos.map((g) => g.url!),
        { onStatus: setStatus, onPct: setPct }
      );
      const url = URL.createObjectURL(blob);
      setResult({ url, size: blob.size });
      downloadBlobUrl(url, "videos-unidos.mp4");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron unir los videos.");
    } finally {
      setStatus(null);
    }
  }

  const grilla = (
    <div className={`grid gap-4 sm:grid-cols-2 ${seleccion ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
      {items.map((g) => {
        const n = seleccion ? seleccion.indexOf(g.id) + 1 : 0;
        return (
          <div key={g.id} className="relative">
            <GenerationCard
              g={g}
              onAnimate={(x) => router.push(`/estudio?animar=${x.id}`)}
              onSaveCharacter={(x) => router.push(`/estudio?personaje=${x.id}`)}
              onContinue={(x) => router.push(`/estudio?continuar=${x.id}`)}
            />
            {seleccion &&
              (listo(g) ? (
                <button
                  onClick={() => tocar(g)}
                  disabled={uniendo}
                  aria-pressed={n > 0}
                  aria-label={n > 0 ? `Quitar video ${n} de la unión` : "Agregar este video a la unión"}
                  className={`absolute inset-0 rounded-2xl transition ${n > 0 ? "bg-brand/10 ring-2 ring-brand-2" : "hover:bg-white/5"}`}
                >
                  <span
                    className={`absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full border-2 text-base font-bold tabular-nums shadow-lg ${
                      n > 0 ? "border-brand-2 bg-brand text-white" : "border-white/70 bg-black/40"
                    }`}
                  >
                    {n > 0 ? n : ""}
                  </span>
                </button>
              ) : (
                <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/60 p-6 text-center text-xs text-mute">
                  {g.kind === "video" ? "Este video todavía no está listo" : "Solo se pueden unir videos"}
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );

  const panel = seleccion && (
    <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      {/* Reproductor: muestra los videos uno tras otro, tal como quedarán unidos. */}
      <div className="card overflow-hidden">
        <div className={`relative mx-auto ${ASPECT_CLASS[aspect] ?? "aspect-[9/16]"} max-h-[360px] w-full bg-panel-2`}>
          {result ? (
            <Reproductor src={result.url} autoPlay />
          ) : actual ? (
            <Reproductor
              ref={playerRef}
              key={`${actual.id}-${playing}`}
              src={actual.url!}
              autoPlay
              onEnded={() => setPlaying((p) => (p !== null && p + 1 < elegidos.length ? p + 1 : null))}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-mute">
              {uniendo ? (
                <>
                  <Loader2 className="animate-spin text-brand-2" />
                  <p className="text-ink">{status}</p>
                  <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width]"
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs">No cierres esta pestaña mientras se une.</p>
                </>
              ) : elegidos.length ? (
                <button onClick={() => setPlaying(0)} className="btn-ghost">
                  <Play size={16} /> Ver vista previa ({fmtSeg(total)})
                </button>
              ) : (
                <p>Toca los videos de la galería en el orden en que quieres que aparezcan.</p>
              )}
            </div>
          )}
        </div>
        <p className="border-t border-line px-4 py-2 text-xs text-mute">
          {result
            ? `Video unido · ${(result.size / 1048576).toFixed(1)} MB`
            : actual
              ? `Reproduciendo video ${playing! + 1} de ${elegidos.length}`
              : "Vista previa"}
        </p>
      </div>

      {/* Orden: arrastrar, flechas o quitar. Tocar la miniatura salta a ese video en el reproductor. */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-mute">Orden</h2>
          <span className="text-xs tabular-nums text-mute">
            {elegidos.length} {elegidos.length === 1 ? "video" : "videos"} · {fmtSeg(total)}
          </span>
        </div>
        {elegidos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-mute">Aún no elegiste videos.</p>
        ) : (
          <ol className="space-y-2">
            {elegidos.map((g, i) => (
              <li
                key={g.id}
                draggable={!uniendo}
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(i);
                }}
                onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                onDrop={() => soltar(i)}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`flex items-center gap-2 rounded-xl border p-2 transition ${
                  dragOver === i && dragFrom !== i ? "border-brand bg-brand/10" : playing === i ? "border-brand/60" : "border-line"
                } ${dragFrom === i ? "opacity-50" : ""}`}
              >
                <GripVertical size={15} className="shrink-0 cursor-grab text-mute" aria-hidden />
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand-2">{i + 1}</span>
                <button
                  onClick={() => {
                    setResult(null);
                    setPlaying(i);
                  }}
                  className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-panel-2"
                  aria-label={`Ver video ${i + 1}`}
                >
                  <video src={`${g.url}#t=0.5`} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs">{g.prompt}</p>
                  <p className="mt-0.5 text-[11px] text-mute">
                    {g.params.duration ?? 8} s · {g.params.aspect}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => cambiar(mover(seleccion!, i, i - 1))}
                    disabled={uniendo || i === 0}
                    className="rounded-md p-1.5 text-mute hover:text-ink disabled:opacity-30"
                    aria-label="Subir"
                    title="Subir"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => cambiar(mover(seleccion!, i, i + 1))}
                    disabled={uniendo || i === elegidos.length - 1}
                    className="rounded-md p-1.5 text-mute hover:text-ink disabled:opacity-30"
                    aria-label="Bajar"
                    title="Bajar"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => cambiar(seleccion!.filter((id) => id !== g.id))}
                    disabled={uniendo}
                    className="rounded-md p-1.5 text-mute hover:text-red-300 disabled:opacity-30"
                    aria-label="Quitar"
                    title="Quitar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {mezclados && (
          <p className="mt-3 text-xs text-amber-300">
            Hay videos con distinto formato: se ajustan al del video 1 ({aspect}) con bandas negras.
          </p>
        )}
        {error && <p className="mt-3 text-xs text-amber-400">{error}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          {result ? (
            <>
              <button onClick={() => downloadBlobUrl(result.url, "videos-unidos.mp4")} className="btn-primary flex-1">
                <Download size={15} /> Descargar de nuevo
              </button>
              <button onClick={() => cambiar(seleccion!)} className="btn-ghost">
                <RotateCcw size={15} /> Seguir editando
              </button>
            </>
          ) : (
            <button onClick={unir} disabled={uniendo || elegidos.length < 2} className="btn-primary flex-1 !py-3">
              {uniendo ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
              {uniendo ? "Uniendo…" : elegidos.length < 2 ? "Elige al menos 2 videos" : "Unir y descargar"}
            </button>
          )}
          <button onClick={salir} disabled={uniendo} className="btn-ghost" aria-label="Salir de unir videos" title="Salir">
            <X size={15} />
          </button>
        </div>
        <p className="mt-2 text-xs text-mute">Arrastra los videos o usa las flechas para cambiar el orden. Es gratis: se une en tu navegador.</p>
      </div>
    </aside>
  );

  return (
    <div className={`mx-auto px-4 py-8 ${seleccion ? "max-w-7xl" : "max-w-6xl"}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Galería</h1>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setKind(f.id)}
              disabled={!!seleccion && f.id === "image"}
              className={`chip ${kind === f.id ? "chip-on" : ""} disabled:opacity-40`}
            >
              {f.label}
            </button>
          ))}
          {!seleccion && videosListos.length >= 2 && (
            <button onClick={empezar} className="btn-primary !py-1.5 text-xs">
              <Film size={14} /> Unir videos
            </button>
          )}
        </div>
      </div>
      <p className="mb-6 text-sm text-mute">
        {seleccion
          ? "Toca los videos en el orden en que quieres que aparezcan. Tócalo otra vez para quitarlo."
          : "Descarga tus archivos: los enlaces se renuevan cada vez que abres la galería."}
      </p>
      {loading && !items.length ? (
        <p className="text-mute">Cargando…</p>
      ) : !items.length ? (
        <div className="card p-12 text-center text-mute">
          Aún no has generado nada.{" "}
          <Link href="/estudio" className="text-brand-2 hover:underline">
            Ir al estudio
          </Link>
        </div>
      ) : seleccion ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {grilla}
          {panel}
        </div>
      ) : (
        grilla
      )}
    </div>
  );
}
