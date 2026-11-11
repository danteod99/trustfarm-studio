"use client";

import Reproductor from "@/app/components/Reproductor";
import { ArrowRight, Clapperboard, Download, Film, Loader2, TriangleAlert, UserRoundPlus } from "lucide-react";
import { useRef, useState } from "react";
import Link from "next/link";
import { getModel } from "@/app/lib/catalog";
import BarraCargaT from "@/app/components/BarraCargaT";
import { capturarFotograma, type Fotograma } from "@/app/lib/fotograma";

export interface PublicGeneration {
  id: string;
  kind: "image" | "video";
  model: string;
  prompt: string;
  params: {
    aspect: string;
    duration?: number;
    resolution?: string;
    withImage?: boolean;
    characterId?: string;
    styleId?: string;
    /** Historia a la que pertenece (id de su primera escena) y número de escena. */
    story?: string;
    scene?: number;
  };
  status: "running" | "done" | "failed";
  cost: number;
  error: string | null;
  url: string | null;
  createdAt: string;
  /** Solo mientras está en curso: tiempo estimado según las últimas generaciones reales del modelo. */
  etaSec?: number;
  /** Segundos transcurridos, medidos en el servidor al responder. */
  elapsedSec?: number;
}

/** Pasado el tiempo estimado, el aviso de lentitud solo aparece si lleva más de 3 min 30 s en total. */
const AVISO_LENTITUD_SEG = 210;

/** Barra de carga con la "T" de la marca, según el tiempo real de las últimas generaciones del modelo. */
function BarraProgreso({ g }: { g: PublicGeneration }) {
  const que = g.kind === "video" ? "video" : "imagen";
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-mute">
      <p className="text-ink">Generando {que}…</p>
      <BarraCargaT
        elapsedSec={g.elapsedSec}
        etaSec={g.etaSec ?? 60}
        ariaLabel={`Progreso del ${que}`}
        avisoLentitudSeg={AVISO_LENTITUD_SEG}
        textoLento="Estamos teniendo lentitud en tu red, la IA sigue trabajando…"
      />
    </div>
  );
}

const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
};

interface Props {
  g: PublicGeneration;
  /** Usar esta imagen como primer cuadro de un video. */
  onAnimate?: (g: PublicGeneration) => void;
  /** Guardar esta imagen como personaje reutilizable. */
  onSaveCharacter?: (g: PublicGeneration) => void;
  /**
   * Seguir la historia desde este video: recibe su último cuadro (o null si el navegador no pudo
   * leerlo; entonces se continúa solo por descripción).
   */
  onContinue?: (g: PublicGeneration, frame: Fotograma | null) => void;
  /** Guardar como personaje el cuadro del video que se está viendo. */
  onSaveCharacterFrame?: (g: PublicGeneration, frame: Fotograma) => void;
}

export default function GenerationCard({ g, onAnimate, onSaveCharacter, onContinue, onSaveCharacterFrame }: Props) {
  const model = getModel(g.model);
  const aspect = ASPECT_CLASS[g.params.aspect] ?? "aspect-square";
  const readyImage = g.kind === "image" && g.status === "done" && !!g.url;
  const readyVideo = g.kind === "video" && g.status === "done" && !!g.url;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [busy, setBusy] = useState<"continue" | "character" | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const scene = g.params.scene ?? 1;

  async function continuar() {
    if (!onContinue || !g.url) return;
    setBusy("continue");
    setFrameError(null);
    const frame = await capturarFotograma(g.url, "final").catch(() => null);
    setBusy(null);
    onContinue(g, frame);
  }

  async function guardarPersonaje() {
    if (!onSaveCharacterFrame || !g.url) return;
    setBusy("character");
    setFrameError(null);
    // El cuadro que el usuario dejó en pausa; si no lo movió, uno del principio (suele verse mejor la cara).
    const t = videoRef.current?.currentTime || 0.5;
    try {
      onSaveCharacterFrame(g, await capturarFotograma(g.url, t));
    } catch (e) {
      setFrameError(e instanceof Error ? e.message : "No se pudo tomar el cuadro.");
    }
    setBusy(null);
  }
  return (
    <div className="card overflow-hidden">
      <div className={`relative ${aspect} max-h-[520px] w-full bg-panel-2`}>
        {g.status === "done" && g.url ? (
          g.kind === "video" ? (
            <Reproductor ref={videoRef} src={g.url} loop />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={g.url} alt={g.prompt} className="h-full w-full object-contain" />
          )
        ) : g.status === "failed" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-mute">
            <TriangleAlert className="text-amber-400" />
            <p>{g.error || "La generación falló."}</p>
            {g.cost > 0 && <p className="text-xs">Te devolvimos {g.cost} créditos.</p>}
          </div>
        ) : g.etaSec ? (
          <BarraProgreso g={g} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-mute">
            <Loader2 className="animate-spin text-brand-2" />
            <p>{g.kind === "video" ? "Generando video (1-3 min)…" : "Generando imagen…"}</p>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="line-clamp-2 text-sm">{g.prompt}</p>
        <div className="flex items-center justify-between text-xs text-mute">
          <span>
            {g.params.story && <span className="mr-1 rounded bg-brand/15 px-1.5 py-0.5 font-semibold text-brand-2">Escena {scene}</span>}
            {model?.name ?? g.model} · {g.params.aspect}
            {g.params.duration ? ` · ${g.params.duration} s` : ""}
            {g.params.resolution ? ` · ${g.params.resolution}` : ""}
          </span>
          {g.status === "done" && g.url && (
            <a
              href={g.url}
              download
              target="_blank"
              rel="noreferrer"
              onClick={() => void fetch(`/api/generations/${g.id}/senal`, { method: "POST", keepalive: true }).catch(() => {})}
              className="flex items-center gap-1 text-brand-2 hover:underline"
            >
              <Download size={13} /> Descargar
            </a>
          )}
        </div>
        {readyImage && (onAnimate || onSaveCharacter) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onAnimate && (
              <button onClick={() => onAnimate(g)} className="chip flex items-center gap-1">
                <Clapperboard size={13} /> Animar
              </button>
            )}
            {onSaveCharacter && (
              <button onClick={() => onSaveCharacter(g)} className="chip flex items-center gap-1">
                <UserRoundPlus size={13} /> Usar como personaje
              </button>
            )}
          </div>
        )}
        {readyVideo && (onContinue || onSaveCharacterFrame) && (
          <div className="mt-1 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-2">
              <Film size={13} /> Continuar la historia
            </p>
            <p className="text-xs text-mute">
              Cada video dura hasta 8 s. Sigue desde el último cuadro con los mismos personajes para armar la escena {scene + 1}.
            </p>
            <div className="flex flex-wrap gap-2">
              {onContinue && (
                <button onClick={continuar} disabled={!!busy} className="btn-primary !px-3 !py-1.5 text-xs">
                  {busy === "continue" ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                  Seguir con la escena {scene + 1}
                </button>
              )}
              {onSaveCharacterFrame && (
                <button
                  onClick={guardarPersonaje}
                  disabled={!!busy}
                  title="Pausa el video en el cuadro donde mejor se ve el personaje y tócalo"
                  className="chip flex items-center gap-1"
                >
                  {busy === "character" ? <Loader2 size={13} className="animate-spin" /> : <UserRoundPlus size={13} />}
                  Guardar personaje
                </button>
              )}
              <Link href={`/editar/unir?historia=${g.params.story ?? g.id}`} className="chip flex items-center gap-1">
                <Film size={13} /> Unir escenas
              </Link>
            </div>
            {frameError && <p className="text-xs text-amber-300">{frameError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
