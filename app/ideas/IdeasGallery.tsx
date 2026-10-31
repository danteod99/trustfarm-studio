"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AudioLines, Clapperboard, ImageIcon, Sparkles, Wand2 } from "lucide-react";
import { IDEAS, IDEA_CATEGORIES, type Idea } from "@/app/lib/ideas";
import { creditCost, getModel } from "@/app/lib/catalog";
import Aurora from "@/app/components/fx/Aurora";
import DecryptedText from "@/app/components/fx/DecryptedText";
import SpotlightCard from "@/app/components/fx/SpotlightCard";
import Reveal from "@/app/components/Reveal";

function cost(i: Idea) {
  const m = getModel(i.model);
  if (!m) return null;
  return creditCost(m, { aspect: i.aspect, duration: i.duration, resolution: i.resolution });
}

function IdeaCard({ idea }: { idea: Idea }) {
  const c = cost(idea);
  const voice = idea.kind === "video" && idea.model === "ltx-25";
  return (
    <SpotlightCard spotlightColor="rgba(34, 211, 238, 0.22)" className="group flex h-full flex-col overflow-hidden !rounded-2xl !p-0">
      <div className="relative aspect-[4/5] overflow-hidden bg-panel-2">
        {idea.video ? (
          <video src={idea.video} poster={idea.image} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <Image src={idea.image} alt={idea.title} fill sizes="(max-width: 768px) 90vw, 360px" className="object-cover transition duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-panel to-transparent" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {idea.kind === "video" ? (voice ? <AudioLines size={12} /> : <Clapperboard size={12} />) : <ImageIcon size={12} />}
          {idea.kind === "video" ? (voice ? "Video con sonido" : "Video") : "Imagen"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-2">{idea.category}</p>
        <h3 className="mt-1 text-lg font-semibold">{idea.title}</h3>
        <p className="mt-1 flex-1 text-sm text-mute">{idea.hook}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          {c !== null && <span className="text-xs text-mute">{c} crédito{c === 1 ? "" : "s"}</span>}
          <Link href={`/estudio?idea=${idea.id}`} className="btn-primary !px-4 !py-2">
            <Wand2 size={15} /> Usar esta idea
          </Link>
        </div>
      </div>
    </SpotlightCard>
  );
}

export default function IdeasGallery() {
  const [cat, setCat] = useState<string>("Todas");
  const list = useMemo(() => (cat === "Todas" ? IDEAS : IDEAS.filter((i) => i.category === cat)), [cat]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <Aurora colorStops={["#3b82f6", "#22d3ee", "#7c3aed"]} amplitude={1.1} blend={0.6} speed={0.6} />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-bg/60 px-3 py-1 text-xs font-medium text-brand-2 backdrop-blur">
            <Sparkles size={13} /> {IDEAS.length} ideas listas para generar
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            <DecryptedText text="¿Qué creamos hoy?" animateOn="view" sequential revealDirection="start" speed={45} encryptedClassName="text-brand-2" />
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-mute">
            Elige una idea, tócala y se abre el estudio con todo listo: modelo, formato y prompt. Solo cambias lo que quieras y
            generas.
          </p>
        </div>
      </section>

      <div className="sticky top-16 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {["Todas", ...IDEA_CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`chip shrink-0 ${cat === c ? "chip-on" : ""}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((idea, i) => (
            <Reveal key={idea.id} delay={(i % 3) * 100}>
              <IdeaCard idea={idea} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
