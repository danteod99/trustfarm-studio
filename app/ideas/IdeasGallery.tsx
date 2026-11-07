"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AudioLines, Clapperboard, ImageIcon, Sparkles, Wand2 } from "lucide-react";
import { IDEA_CATEGORIES } from "@/app/lib/ideas-categorias";
import type { Idea } from "@/app/lib/ideas";
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
        {!idea.image ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/30 via-panel-2 to-brand-2/20 p-6 text-center">
            <span className="text-sm font-semibold text-white/80">{idea.title}</span>
          </div>
        ) : idea.video ? (
          <video src={idea.video} poster={idea.image} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        ) : (
          <Image src={idea.image} alt={idea.title} fill sizes="(max-width: 768px) 90vw, 360px" className="object-cover transition duration-700 group-hover:scale-105" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-panel to-transparent" />
        {idea.tendencia && (
          <span className="absolute right-3 top-3 rounded-full border border-amber-400/40 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
            🔥 Tendencia de la semana
          </span>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {idea.kind === "video" ? (voice ? <AudioLines size={12} /> : <Clapperboard size={12} />) : <ImageIcon size={12} />}
          {idea.kind === "video" ? (voice ? "Video con sonido" : "Video") : "Imagen"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-2">{idea.category}</p>
        <h3 className="mt-1 text-lg font-semibold">{idea.title}</h3>
        <p className="mt-1 flex-1 text-sm text-mute">{idea.hook}</p>
        {!!idea.variaciones?.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {idea.variaciones.map((v, k) => (
              <Link key={k} href={`/estudio?idea=${idea.id}&v=${k}`} className="chip !px-2.5 !py-1 text-xs">{v.titulo}</Link>
            ))}
          </div>
        )}
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

const TENDENCIAS = "🔥 Tendencias";

export default function IdeasGallery({ ideas }: { ideas: Idea[] }) {
  const [cat, setCat] = useState<string>("Todas");
  const list = useMemo(() => {
    if (cat === "Todas") return ideas;
    if (cat === TENDENCIAS) return ideas.filter((i) => i.tendencia);
    return ideas.filter((i) => i.category === cat);
  }, [cat, ideas]);
  // Sin chips vacíos: una categoría sin ideas publicadas no se ofrece.
  const filtros = useMemo(() => {
    const conIdeas = IDEA_CATEGORIES.filter((c) => ideas.some((i) => i.category === c));
    return ["Todas", ...(ideas.some((i) => i.tendencia) ? [TENDENCIAS] : []), ...conIdeas];
  }, [ideas]);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <Aurora colorStops={["#ffffff", "#d4d4d4", "#737373"]} amplitude={1.1} blend={0.6} speed={0.6} />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-20 text-center sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-bg/60 px-3 py-1 text-xs font-medium text-brand-2 backdrop-blur">
            <Sparkles size={13} /> {ideas.length} ideas listas para generar
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
          {filtros.map((c) => (
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
