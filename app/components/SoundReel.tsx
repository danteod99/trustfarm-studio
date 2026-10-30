"use client";

import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Showcase } from "@/app/lib/showcase";

/**
 * Fila de videos verticales en bucle. Arrancan mudos (los navegadores no dejan reproducir con
 * sonido sin un toque); al tocar uno se le activa el audio y se silencian los demás.
 */
export default function SoundReel({ items }: { items: (Showcase & { title: string })[] }) {
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);

  function toggle(i: number) {
    const next = playing === i ? null : i;
    refs.current.forEach((v, k) => {
      if (!v) return;
      v.muted = k !== next;
      if (k === next) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    });
    setPlaying(next);
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
      {items.map((it, i) => (
        <button
          key={it.src}
          onClick={() => toggle(i)}
          aria-label={`${playing === i ? "Silenciar" : "Escuchar"}: ${it.title}`}
          className={`group relative aspect-[9/16] w-52 shrink-0 snap-start overflow-hidden rounded-2xl border bg-panel text-left transition lg:w-auto ${
            playing === i ? "border-brand-2 shadow-lg shadow-brand-2/20" : "border-line hover:border-brand/60"
          }`}
        >
          <video
            ref={(el) => {
              refs.current[i] = el;
            }}
            src={it.video}
            poster={it.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p className="text-sm font-bold text-white">{it.title}</p>
          </div>
          <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur">
            {playing === i ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </span>
        </button>
      ))}
    </div>
  );
}
