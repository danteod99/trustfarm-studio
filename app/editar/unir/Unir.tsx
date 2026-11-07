"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Film, GripVertical, Loader2, Play, Plus, RotateCcw, Trash2, X } from "lucide-react";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import Reproductor from "@/app/components/Reproductor";
import type { PublicGeneration } from "@/app/components/GenerationCard";
import { sceneText } from "@/app/lib/escena";
import { MAX_ESCENAS, downloadBlobUrl, mover, unirVideos } from "@/app/lib/video";

/** Una escena en la línea de tiempo. `key` permite usar el mismo video dos veces. */
interface Clip {
  key: string;
  g: PublicGeneration;
}

const ASPECT_CLASS: Record<string, string> = { "9:16": "aspect-[9/16]", "16:9": "aspect-video", "1:1": "aspect-square" };

let nextKey = 0;
const clip = (g: PublicGeneration): Clip => ({ key: `${g.id}-${nextKey++}`, g });
const ready = (g: PublicGeneration) => g.kind === "video" && g.status === "done" && !!g.url;
const fmtSeg = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function Unir() {
  const [library, setLibrary] = useState<PublicGeneration[] | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  /** Video de la biblioteca que se está viendo en el reproductor antes de agregarlo. */
  const [previa, setPrevia] = useState<PublicGeneration | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const busy = status !== null;

  // Biblioteca (últimos 60 videos) y, si viene ?historia=<id>, sus escenas ya en orden.
  useEffect(() => {
    const historia = new URLSearchParams(window.location.search).get("historia");
    const get = (q: string) =>
      fetch(`/api/generations?${q}`)
        .then((r) => (r.ok ? r.json() : { generations: [] }))
        .then((d) => ((d.generations ?? []) as PublicGeneration[]).filter(ready))
        .catch(() => [] as PublicGeneration[]);
    get("kind=video&limit=60").then(setLibrary);
    if (historia) {
      get(`kind=video&limit=60&story=${encodeURIComponent(historia)}`).then((escenas) =>
        setClips(
          escenas
            .sort((a, b) => (a.params.scene ?? 1) - (b.params.scene ?? 1) || a.createdAt.localeCompare(b.createdAt))
            .map(clip)
        )
      );
    }
  }, []);

  // Libera el MP4 anterior al reemplazarlo o al salir.
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const total = useMemo(() => clips.reduce((s, c) => s + (c.g.params.duration ?? 8), 0), [clips]);
  const aspect = clips[0]?.g.params.aspect ?? "9:16";
  const mixed = clips.some((c) => c.g.params.aspect !== aspect);

  function change(next: Clip[]) {
    setClips(next);
    setPlaying(null);
    setResult(null);
  }

  function add(g: PublicGeneration) {
    if (clips.length >= MAX_ESCENAS) return setError(`Máximo ${MAX_ESCENAS} escenas por video.`);
    change([...clips, clip(g)]);
  }

  function drop(to: number) {
    if (dragFrom !== null) change(mover(clips, dragFrom, to));
    setDragFrom(null);
    setDragOver(null);
  }

  // Vista previa: reproduce las escenas una tras otra en el mismo reproductor.
  function play(from = 0) {
    setResult(null);
    setPrevia(null);
    setPlaying(from);
  }

  function verPrevia(g: PublicGeneration) {
    setResult(null);
    setPlaying(null);
    setPrevia(g);
  }
  useEffect(() => {
    if (playing !== null) playerRef.current?.play().catch(() => {});
  }, [playing]);

  async function unir() {
    if (clips.length < 2) return;
    setError(null);
    setResult(null);
    setPlaying(null);
    setPrevia(null);
    setPct(0);
    try {
      const blob = await unirVideos(
        clips.map((c) => c.g.url!),
        { onStatus: setStatus, onPct: setPct }
      );
      setResult({ url: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo unir el video.");
    } finally {
      setStatus(null);
    }
  }

  const current = playing !== null ? clips[playing] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <ToolHeader
        icon={<Film size={20} />}
        title="Unir escenas"
        subtitle="Ordena tus videos como quieras y únelos en una sola historia. Gratis: se procesa en tu computadora."
      />

      {error && (
        <div className="mb-4">
          <ErrorBox msg={error} onClose={() => setError(null)} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Línea de tiempo + reproductor */}
        <section className="space-y-4">
          <div className="card overflow-hidden">
            <div className={`relative mx-auto ${ASPECT_CLASS[aspect] ?? "aspect-[9/16]"} max-h-[480px] w-full bg-panel-2`}>
              {result ? (
                <Reproductor src={result.url} autoPlay />
              ) : previa ? (
                <Reproductor key={`previa-${previa.id}`} src={previa.url!} autoPlay />
              ) : current ? (
                <Reproductor
                  ref={playerRef}
                  key={current.key}
                  src={current.g.url!}
                  autoPlay
                  onEnded={() => setPlaying((p) => (p !== null && p + 1 < clips.length ? p + 1 : null))}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-mute">
                  {busy ? (
                    <>
                      <Loader2 className="animate-spin text-brand-2" />
                      <p className="text-ink">{status}</p>
                      <div className="h-2 w-full max-w-[240px] overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2 transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                    </>
                  ) : clips.length ? (
                    <button onClick={() => play(0)} className="btn-ghost">
                      <Play size={16} /> Ver la historia ({fmtSeg(total)})
                    </button>
                  ) : (
                    <p>Agrega videos desde la derecha para armar tu historia.</p>
                  )}
                </div>
              )}
            </div>
            {previa && !result && (
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2">
                <p className="min-w-0 flex-1 truncate text-xs text-mute" title={sceneText(previa.prompt)}>
                  Vista previa · {sceneText(previa.prompt)}
                </p>
                <button
                  onClick={() => {
                    add(previa);
                    setPrevia(null);
                  }}
                  disabled={busy}
                  className="btn-primary !px-3 !py-1.5 text-xs"
                >
                  <Plus size={14} /> Agregar a la historia
                </button>
                <button onClick={() => setPrevia(null)} className="btn-ghost !px-2 !py-1.5 text-xs" aria-label="Cerrar vista previa" title="Cerrar">
                  <X size={14} />
                </button>
              </div>
            )}
            {current && !result && !previa && (
              <p className="border-t border-line px-4 py-2 text-xs text-mute">
                Reproduciendo escena {playing! + 1} de {clips.length}
              </p>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-mute">Orden de las escenas</h2>
              <span className="text-xs text-mute tabular-nums">
                {clips.length} {clips.length === 1 ? "escena" : "escenas"} · {fmtSeg(total)}
              </span>
            </div>
            {clips.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-mute">
                Aún no hay escenas. Toca <Plus size={12} className="inline" /> en un video de tu biblioteca.
              </p>
            ) : (
              <ol className="space-y-2">
                {clips.map((c, i) => (
                  <li
                    key={c.key}
                    draggable={!busy}
                    onDragStart={() => setDragFrom(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(i);
                    }}
                    onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
                    onDrop={() => drop(i)}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-2 transition ${
                      dragOver === i && dragFrom !== i ? "border-brand bg-brand/10" : playing === i ? "border-brand/60" : "border-line"
                    } ${dragFrom === i ? "opacity-50" : ""}`}
                  >
                    <GripVertical size={16} className="shrink-0 cursor-grab text-mute" aria-hidden />
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand-2">
                      {i + 1}
                    </span>
                    <button onClick={() => play(i)} className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-panel-2" aria-label={`Ver escena ${i + 1}`}>
                      <video src={`${c.g.url}#t=0.5`} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{sceneText(c.g.prompt)}</p>
                      <p className="mt-0.5 text-xs text-mute">
                        {c.g.params.duration ?? 8} s · {c.g.params.aspect}
                        {c.g.params.scene ? ` · escena ${c.g.params.scene} original` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        onClick={() => change(mover(clips, i, i - 1))}
                        disabled={busy || i === 0}
                        className="rounded-md p-1.5 text-mute hover:text-ink disabled:opacity-30"
                        aria-label="Subir"
                        title="Subir"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        onClick={() => change(mover(clips, i, i + 1))}
                        disabled={busy || i === clips.length - 1}
                        className="rounded-md p-1.5 text-mute hover:text-ink disabled:opacity-30"
                        aria-label="Bajar"
                        title="Bajar"
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        onClick={() => change(clips.filter((_, j) => j !== i))}
                        disabled={busy}
                        className="rounded-md p-1.5 text-mute hover:text-red-300 disabled:opacity-30"
                        aria-label="Quitar"
                        title="Quitar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {mixed && (
              <p className="mt-3 text-xs text-amber-300">
                Hay escenas con distinto formato: se ajustan al de la primera ({aspect}) con bandas negras.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {result ? (
                <>
                  <button onClick={() => downloadBlobUrl(result.url, "historia.mp4")} className="btn-primary flex-1">
                    <Download size={16} /> Descargar historia ({(result.size / 1048576).toFixed(1)} MB)
                  </button>
                  <button onClick={() => setResult(null)} className="btn-ghost">
                    <RotateCcw size={15} /> Seguir editando
                  </button>
                </>
              ) : (
                <button onClick={unir} disabled={busy || clips.length < 2} className="btn-primary flex-1 !py-3">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
                  {busy ? status : clips.length < 2 ? "Agrega al menos 2 escenas" : `Unir ${clips.length} escenas · gratis`}
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-mute">
              Arrastra las escenas o usa las flechas para cambiar el orden. Mantén esta pestaña abierta mientras se une.
            </p>
          </div>
        </section>

        {/* Biblioteca */}
        <aside className="card h-fit p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mute">Tus videos</h2>
          {library === null ? (
            <p className="text-sm text-mute">Cargando…</p>
          ) : library.length === 0 ? (
            <p className="text-sm text-mute">
              Aún no tienes videos.{" "}
              <Link href="/estudio" className="text-brand-2 hover:underline">
                Genera uno en el estudio
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {library.map((g) => {
                const n = clips.filter((c) => c.g.id === g.id).length;
                const viendo = previa?.id === g.id;
                return (
                  <div
                    key={g.id}
                    className={`group relative overflow-hidden rounded-xl border transition ${
                      viendo ? "border-brand-2 ring-1 ring-brand-2" : n ? "border-brand/60" : "border-line hover:border-mute"
                    }`}
                  >
                    <button
                      onClick={() => add(g)}
                      disabled={busy}
                      title={`Agregar: ${sceneText(g.prompt)}`}
                      aria-label="Agregar a la historia"
                      className="block w-full text-left disabled:opacity-50"
                    >
                      <div className="aspect-[9/16] bg-panel-2">
                        {/* Vista rápida: al pasar el mouse se reproduce sin sonido. */}
                        <video
                          src={`${g.url}#t=0.5`}
                          muted
                          loop
                          preload="metadata"
                          playsInline
                          onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0.5;
                          }}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white group-hover:bg-brand">
                        <Plus size={15} />
                      </span>
                    </button>
                    <button
                      onClick={() => verPrevia(g)}
                      disabled={busy}
                      className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-2 hover:text-black disabled:opacity-50"
                      aria-label="Ver este video en el reproductor"
                    >
                      <Play size={11} /> Ver
                    </button>
                    {g.params.story && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Escena {g.params.scene ?? 1}
                      </span>
                    )}
                    {n > 0 && (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        En la historia{n > 1 ? ` ×${n}` : ""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
