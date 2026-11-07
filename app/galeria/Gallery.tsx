"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Film, Loader2, RotateCcw, X } from "lucide-react";
import GenerationCard, { type PublicGeneration } from "@/app/components/GenerationCard";
import { useGenerations } from "@/app/components/useGenerations";
import { MAX_ESCENAS, downloadBlobUrl, unirVideos } from "@/app/lib/video";

const FILTERS = [
  { id: "", label: "Todo" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Imágenes" },
];

const listo = (g: PublicGeneration) => g.kind === "video" && g.status === "done" && !!g.url;
const fmtSeg = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function Gallery() {
  const router = useRouter();
  const [kind, setKind] = useState("");
  const { items, loading } = useGenerations(`?limit=60${kind ? `&kind=${kind}` : ""}`);

  // Modo "Unir videos": null = apagado; si no, los ids en el orden en que se tocaron.
  const [seleccion, setSeleccion] = useState<string[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; size: number } | null>(null);
  const uniendo = status !== null;

  const videosListos = items.filter(listo);
  const elegidos = (seleccion ?? []).map((id) => items.find((g) => g.id === id)).filter((g): g is PublicGeneration => !!g);
  const total = elegidos.reduce((s, g) => s + (g.params.duration ?? 8), 0);
  const mezclados = elegidos.some((g) => g.params.aspect !== elegidos[0]?.params.aspect);

  function empezar() {
    if (kind === "image") setKind("video");
    setSeleccion([]);
    setResult(null);
    setError(null);
  }

  function salir() {
    if (uniendo) return;
    setSeleccion(null);
    setResult(null);
    setError(null);
  }

  // Tocar un video lo agrega al final; tocarlo otra vez lo quita y los demás se renumeran.
  function tocar(g: PublicGeneration) {
    if (!seleccion || uniendo || !listo(g)) return;
    setResult(null);
    setError(null);
    if (seleccion.includes(g.id)) return setSeleccion(seleccion.filter((id) => id !== g.id));
    if (seleccion.length >= MAX_ESCENAS) return setError(`Máximo ${MAX_ESCENAS} videos por unión.`);
    setSeleccion([...seleccion, g.id]);
  }

  async function unir() {
    if (elegidos.length < 2 || uniendo) return;
    setError(null);
    setResult(null);
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

  return (
    <div className={`mx-auto max-w-6xl px-4 py-8 ${seleccion ? "pb-40" : ""}`}>
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                      className={`absolute inset-0 rounded-2xl transition ${
                        n > 0 ? "bg-brand/10 ring-2 ring-brand-2" : "hover:bg-white/5"
                      }`}
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
      )}

      {seleccion && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-3xl">
          <div className="card flex flex-col gap-3 p-4 shadow-2xl sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              {uniendo ? (
                <>
                  <p className="truncate text-ink">{status}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand-2 transition-[width]" style={{ width: `${Math.round(pct * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-mute">No cierres esta pestaña mientras se une.</p>
                </>
              ) : result ? (
                <p className="text-ink">
                  ¡Listo! Tu video unido se descargó ({(result.size / 1048576).toFixed(1)} MB).
                </p>
              ) : (
                <>
                  <p className="text-ink">
                    {elegidos.length === 0
                      ? "Elige los videos que quieres unir"
                      : `${elegidos.length} ${elegidos.length === 1 ? "video" : "videos"} · ${fmtSeg(total)}`}
                  </p>
                  {mezclados && (
                    <p className="text-xs text-mute">
                      Hay videos con distinto formato: se ajustan al del video 1 ({elegidos[0].params.aspect}) con bandas negras.
                    </p>
                  )}
                </>
              )}
              {error && <p className="mt-1 text-xs text-amber-400">{error}</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              {result ? (
                <>
                  <button onClick={() => downloadBlobUrl(result.url, "videos-unidos.mp4")} className="btn-ghost">
                    <Download size={15} /> Descargar de nuevo
                  </button>
                  <button
                    onClick={() => {
                      setResult(null);
                      setSeleccion([]);
                    }}
                    className="btn-ghost"
                  >
                    <RotateCcw size={15} /> Unir otros
                  </button>
                  <button onClick={salir} className="btn-ghost" aria-label="Cerrar">
                    <X size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={salir} disabled={uniendo} className="btn-ghost">
                    Cancelar
                  </button>
                  <button onClick={unir} disabled={uniendo || elegidos.length < 2} className="btn-primary">
                    {uniendo ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
                    {elegidos.length < 2 ? "Elige al menos 2" : "Unir y descargar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
