"use client";

import { Download, Loader2, TriangleAlert } from "lucide-react";
import { getModel } from "@/app/lib/catalog";

export interface PublicGeneration {
  id: string;
  kind: "image" | "video";
  model: string;
  prompt: string;
  params: { aspect: string; duration?: number; resolution?: string; withImage?: boolean };
  status: "running" | "done" | "failed";
  cost: number;
  error: string | null;
  url: string | null;
  createdAt: string;
}

const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-video",
  "1:1": "aspect-square",
};

export default function GenerationCard({ g }: { g: PublicGeneration }) {
  const model = getModel(g.model);
  const aspect = ASPECT_CLASS[g.params.aspect] ?? "aspect-square";
  return (
    <div className="card overflow-hidden">
      <div className={`relative ${aspect} max-h-[520px] w-full bg-panel-2`}>
        {g.status === "done" && g.url ? (
          g.kind === "video" ? (
            <video src={g.url} controls playsInline loop className="h-full w-full object-contain" />
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
            {model?.name ?? g.model} · {g.params.aspect}
            {g.params.duration ? ` · ${g.params.duration} s` : ""}
            {g.params.resolution ? ` · ${g.params.resolution}` : ""}
          </span>
          {g.status === "done" && g.url && (
            <a href={g.url} download target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-2 hover:underline">
              <Download size={13} /> Descargar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
