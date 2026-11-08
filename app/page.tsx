import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  AudioLines,
  Coins,
  Languages,
  MousePointerClick,
  Palette,
  ShieldCheck,
  Sparkles,
  Type,
  UserRound,
  Wand2,
} from "lucide-react";
import { MODELS, PACKS, PLAN, creditCost } from "@/app/lib/catalog";
import { BRAND } from "@/app/lib/brand";
import { BRAINROT, MARQUEE, SHOW, type Showcase } from "@/app/lib/showcase";
import Reveal from "@/app/components/Reveal";
import Media from "@/app/components/Media";
import SoundReel from "@/app/components/SoundReel";
import Rombos from "@/app/components/Rombos";
import { ideasPublicas } from "@/app/lib/ideas-servidor";

function exampleCost(id: string) {
  const m = MODELS.find((x) => x.id === id)!;
  if (m.kind === "image") {
    const c = creditCost(m, { aspect: "1:1" });
    return `${c} crédito${c === 1 ? "" : "s"} / imagen`;
  }
  const d = Math.max(...(m.durations ?? [8]));
  const r = m.resolutions?.[0] ?? "720p";
  return `${creditCost(m, { aspect: "9:16", duration: d, resolution: r })} créditos / clip ${d} s ${r}`;
}

const FAQ = [
  {
    q: "¿Cómo funcionan los créditos?",
    a: "Te suscribes al plan mensual (US$20, 260 créditos cada mes) o compras un paquete suelto. Cada generación descuenta créditos según el modelo, la duración y la resolución.",
  },
  {
    q: "¿Qué pasa si una generación falla?",
    a: "Si el modelo no entrega el resultado (error técnico o filtro de seguridad), los créditos vuelven a tu saldo automáticamente.",
  },
  {
    q: "¿Puedo usar los videos en anuncios y redes?",
    a: "Sí. Lo que generas es tuyo y puedes usarlo comercialmente, siempre que respete nuestros términos y las políticas de cada plataforma.",
  },
  {
    q: "¿Los créditos vencen?",
    a: "No. Tus créditos quedan en tu cuenta hasta que los uses, también los del plan mensual: lo que no gastes un mes se suma al siguiente.",
  },
  {
    q: "¿Cómo cancelo el plan mensual?",
    a: "Desde Créditos → Gestionar plan, cuando quieras. Sigue activo hasta el final del mes pagado y no se vuelve a cobrar. Tus créditos se quedan.",
  },
  {
    q: "¿Cómo pago?",
    a: "Con tarjeta de crédito o débito de cualquier país a través de Stripe. Los precios están en dólares (USD).",
  },
];

const FORMATS: { t: string; d: string; item: Showcase }[] = [
  { t: "Frutinovelas", d: "Telenovelas cortas con frutas que actúan, capítulo a capítulo y con final en suspenso.", item: SHOW.fresaLlorando },
  { t: "Modelos IA", d: "Una creadora virtual con la misma cara en cada foto y video, lista para marcas y afiliados.", item: SHOW.modelo },
  { t: "Miniseries TikTok", d: "Escenas cinematográficas con gancho en el primer segundo y personajes fijos.", item: SHOW.taxi },
  { t: "Videos con voz", d: "Personas que hablan a cámara en español, con sonido ambiente y lip-sync.", item: SHOW.ltxCafe },
  { t: "Anuncios de producto", d: "Fotos de estudio de tu producto sin estudio: luz, fondo y gotas incluidas.", item: SHOW.serum },
  { t: "Fábulas e historias", d: "Ilustraciones con estilo propio para canales sin rostro que enseñan algo.", item: SHOW.zorro },
];

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mb-10">
      <Rombos n={3} size={7} className="mb-3 text-ocre" />
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-mute">{sub}</p>}
    </Reveal>
  );
}

function Frame({ item, className = "", priority = false }: { item: Showcase; className?: string; priority?: boolean }) {
  return (
    // Sin "relative" fijo: las tarjetas del hero van en "absolute" y el resto lo pasa en className.
    <div className={`group overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl shadow-black/50 ${className}`}>
      <Media item={item} priority={priority} className="transition duration-700 group-hover:scale-105" />
    </div>
  );
}

export default async function Home() {
  const IDEAS = await ideasPublicas();
  return (
    <div className="overflow-x-clip">
      {/* Hero "Noche Yamore": resplandor cálido, arco con sol ocre y piso a cuadros (Karibu) */}
      <section className="grano relative overflow-hidden bg-[radial-gradient(120%_90%_at_80%_0%,var(--color-brasa)_0%,var(--color-cacao)_58%)]">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Rombos className="text-ocre" />
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-2">
              <Sparkles size={13} /> Nuevo: videos con voz en español
            </span>
            <h1 className="mt-5 text-[2.6rem] font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.25rem]">
              Imágenes y videos con IA, <em className="italic text-ocre">en minutos</em>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-hueso/85">
              Escribe tu idea en español y obtén videos con voz, personajes que no cambian de cara y fotos de calidad de
              estudio para tus anuncios, redes y canales. Pagas solo por lo que generas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/entrar?modo=registro" className="btn-primary !px-7 !py-3.5 text-base">
                Empezar a crear <ArrowRight size={17} />
              </Link>
              <Link href="/ideas" className="btn-ghost !px-7 !py-3.5 text-base">
                Ver ideas
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
              <span className="flex items-center gap-1.5"><Wand2 size={15} className="text-ocre" /> {MODELS.filter((x) => !x.adminOnly).length} modelos de IA</span>
              <span className="flex items-center gap-1.5"><Coins size={15} className="text-ocre" /> Desde US$10, sin contratos</span>
              <span className="flex items-center gap-1.5"><Languages size={15} className="text-ocre" /> Todo en español</span>
            </div>
          </div>

          {/* Arco con sol y piso a cuadros, con ejemplos reales encima */}
          <div className="relative mx-auto w-full max-w-[440px] pb-6">
            <div
              className="grano relative mx-auto aspect-[4/5] w-[84%] overflow-hidden rounded-b-[18px] rounded-t-[240px] border border-ocre/25"
              style={{ background: "linear-gradient(180deg, var(--color-brasa) 0, var(--color-terracota) 55%, var(--color-cacao-2) 55%)" }}
            >
              <div className="absolute inset-x-0 top-[6%] flex justify-center">
                <div className="animate-latido h-28 w-28 rounded-full bg-ocre shadow-[0_0_80px_10px_color-mix(in_srgb,var(--color-ocre)_50%,transparent)] sm:h-32 sm:w-32" />
              </div>
              <div className="absolute inset-x-0 bottom-[46%] h-[38%] bg-[repeating-linear-gradient(0deg,transparent_0_14px,rgb(0_0_0/0.14)_14px_16px)]" />
              <div className="piso-cuadros absolute -inset-x-[30%] -bottom-[6%] h-[46%]" />
              <Frame item={SHOW.ltxCafe} priority className="absolute bottom-[9%] left-1/2 z-10 aspect-[9/16] w-[40%] -translate-x-1/2 !border-ocre/40" />
            </div>
            <Frame item={SHOW.fresa} className="animate-float absolute bottom-16 left-0 z-20 aspect-[9/16] w-[30%] -rotate-6" />
            <Frame
              item={SHOW.ltxGranja}
              className="animate-float absolute right-0 top-[18%] z-20 aspect-[9/16] w-[30%] rotate-6 [animation-delay:-3s]"
            />
            <div className="absolute bottom-0 left-1/2 z-30 flex w-max max-w-[92%] -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-ocre/35 bg-cacao/80 px-4 py-2.5 text-xs backdrop-blur-md">
              <AudioLines size={16} className="shrink-0 text-ocre" />
              <span>
                <span className="mano block text-[15px] leading-tight text-ocre-claro">«Hoy les traigo el mejor café de Miraflores»</span>
                <span className="block text-mute">Video con voz generado con IA</span>
              </span>
            </div>
          </div>
        </div>
        <Rombos n={14} size={7} className="absolute bottom-3 left-1/2 -translate-x-1/2 text-ocre/40" />
      </section>

      {/* Cinta de ejemplos */}
      <section aria-label="Ejemplos generados" className="relative border-y border-line bg-panel/40 py-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />
        <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
          {[...MARQUEE, ...MARQUEE].map((it, i) => (
            <div key={i} className="relative aspect-[9/16] w-36 shrink-0 overflow-hidden rounded-xl border border-line sm:w-44">
              <Image src={it.src} alt={i < MARQUEE.length ? it.alt : ""} fill sizes="180px" className="object-cover" />
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-mute">Todo lo que ves en esta página se generó con {BRAND.name}.</p>
      </section>

      {/* Modo Granja → /granjas */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <Reveal>
          <Link
            href="/granjas"
            className="card grano group grid items-center gap-6 overflow-hidden bg-gradient-to-br from-terracota/40 via-panel to-panel p-6 transition hover:border-brand/60 sm:grid-cols-[auto_1fr_auto] sm:p-8"
          >
            <div className="flex -space-x-6">
              {["/showcase/granja-iphones.jpg", "/showcase/ltx-granja.jpg", "/showcase/idea-estudio-40-iphones.jpg"].map((src, i) => (
                <div key={src} className={`relative aspect-[9/16] w-16 overflow-hidden rounded-lg border border-line shadow-xl sm:w-20 ${i === 1 ? "z-10 -translate-y-2" : ""}`}>
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </div>
              ))}
            </div>
            <div>
              <p className="eyebrow !text-brand-2">Nuevo · Modo Granja</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Un video distinto para cada cuenta de tu granja</h2>
              <p className="mt-2 text-sm text-mute">
                Generas 1 a 5 videos y salen 100 versiones únicas, cada una con su propio gancho. Descarga por carpeta de cuenta.
              </p>
            </div>
            <span className="btn-primary !px-5 !py-3">
              Ver Modo Granja <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </Link>
        </Reveal>
      </section>

      {/* Ideas */}
      <section className="mx-auto mt-24 max-w-6xl px-4">
        <SectionHead
          eyebrow="Ideas"
          title={`${IDEAS.length} ideas listas para generar`}
          sub="Máquinas que generan dinero, brainrot, comida, inmobiliaria, influencers… Tocas una y el estudio se abre con todo listo."
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {IDEAS.filter((i) => ["maquina-cascos", "brainrot-pollo", "ceviche", "depa-vista-mar"].includes(i.id)).map((i, k) => (
            <Reveal key={i.id} delay={k * 90}>
              <Link href={`/estudio?idea=${i.id}`} className="group relative block aspect-[9/16] overflow-hidden rounded-2xl border border-line">
                {!i.image ? null : i.video ? (
                  <video src={i.video} poster={i.image} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                ) : (
                  <Image src={i.image} alt={i.title} fill sizes="(max-width: 768px) 45vw, 270px" className="object-cover transition duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-2">{i.category}</p>
                  <p className="mt-0.5 font-semibold text-hueso">{i.title}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link href="/ideas" className="btn-ghost !px-6 !py-3">
            Ver todas las ideas <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Formatos */}
      <section id="ejemplos" className="mx-auto mt-24 max-w-6xl scroll-mt-24 px-4">
        <SectionHead
          eyebrow="Qué puedes crear"
          title="Formatos listos para crecer en redes"
          sub="Cada formato trae sus pasos y prompts armados: eliges, completas lo que va entre corchetes y generas."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((f, i) => (
            <Reveal key={f.t} delay={(i % 3) * 120}>
              <Link href="/estudio" className="card group block overflow-hidden transition hover:border-brand/60">
                <div className="relative aspect-[4/5] overflow-hidden bg-panel-2">
                  <Media item={f.item} className="transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-panel to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="flex items-center justify-between font-semibold">
                    {f.t}
                    <ArrowRight size={16} className="text-mute transition group-hover:translate-x-1 group-hover:text-brand-2" />
                  </h3>
                  <p className="mt-1 text-sm text-mute">{f.d}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Brainrot */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead
          eyebrow="Brainrot peruano"
          title="Personajes absurdos que se vuelven virales"
          sub="Fusiona animales, comida y objetos de aquí con voz incluida. Toca un video para escucharlo."
        />
        <Reveal>
          <SoundReel items={BRAINROT} />
        </Reveal>
      </section>

      {/* Personajes consistentes */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <div className="card grid items-center gap-10 overflow-hidden p-6 sm:p-10 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">Personajes</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">El mismo personaje en todas las escenas</h2>
            <p className="mt-3 text-mute">
              Guarda tu personaje una vez —una fruta, una modelo, un narrador— y úsalo en cada imagen y video. Misma cara,
              misma ropa, capítulo tras capítulo.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { icon: UserRound, t: "«Usar como personaje» en cualquier imagen que te guste" },
                { icon: Palette, t: "Estilos guardados para que todo el canal se vea igual" },
                { icon: MousePointerClick, t: "«Animar» convierte la escena en video con un clic" },
              ].map(({ icon: Icon, t }) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand-2">
                    <Icon size={16} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={150} className="flex items-center justify-center gap-4">
            <div className="w-[44%]">
              <Frame item={SHOW.fresa} className="relative aspect-[9/16]" />
              <p className="mt-2 text-center text-xs text-mute">1. Creas el personaje</p>
            </div>
            <ArrowRight className="shrink-0 text-brand-2" />
            <div className="w-[44%]">
              <Frame item={SHOW.fresaLlorando} className="relative aspect-[9/16]" />
              <p className="mt-2 text-center text-xs text-mute">2. Nueva escena, misma fresa</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Texto en la imagen */}
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <div className="card grid items-center gap-10 overflow-hidden p-6 sm:p-10 lg:grid-cols-2">
          <Reveal className="flex justify-center gap-4 lg:order-1">
            <Frame item={SHOW.frutilandia} className="relative aspect-[9/16] w-[46%]" />
            <Frame item={SHOW.retrato} className="relative mt-10 aspect-[9/16] w-[46%]" />
          </Reveal>
          <Reveal delay={150} className="lg:order-2">
            <p className="eyebrow">Texto perfecto</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Afiches y carteles con el texto bien escrito</h2>
            <p className="mt-3 text-mute">
              Trust Foto Pro escribe en la imagen exactamente lo que le pides: el nombre de tu negocio, una promoción o un
              letrero dentro de la escena. Sin letras inventadas.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm">
              <Type size={16} className="text-brand-2" />
              <span className="text-mute">Prompt:</span> «cartel de madera que dice <b>TRUSTFARM STUDIO</b>»
            </div>
          </Reveal>
        </div>
      </section>

      {/* Modelos */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead
          eyebrow="Modelos"
          title="Los mejores modelos en un solo lugar"
          sub="Fotos, videos con voz y clips, todos en un solo lugar. Elige según lo que necesites: calidad máxima, voz, velocidad o el menor costo."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.filter((x) => !x.adminOnly).map((m, i) => (
            <Reveal key={m.publicId} delay={(i % 3) * 80}>
              <div
                className={`card grano flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand/60 ${
                  m.kind === "video" ? "bg-gradient-to-br from-terracota/30 to-panel" : "border-ocre/25 bg-cacao-2"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mute">
                    <Rombos n={3} size={6} className={m.kind === "video" ? "text-durazno" : "text-ocre"} />
                    {m.kind === "video" ? "Video" : "Imagen"}
                  </span>
                  {m.badge && <span className="mano text-base leading-none text-ocre-claro">{m.badge}</span>}
                </div>
                <h3 className="mt-3 text-xl font-black">{m.name}</h3>
                <p className="mt-1 flex-1 text-sm text-mute">{m.tagline}</p>
                <p className="mt-4 text-sm font-medium text-ink">{exampleCost(m.id)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead eyebrow="Cómo funciona" title="De la idea al video en 3 pasos" />
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { n: "01", t: "Escribe o elige un formato", d: "En español, como se lo contarías a un editor. O parte de una plantilla.", item: SHOW.creadora },
            { n: "02", t: "Elige el modelo", d: "Imagen o video, con o sin voz. Ves el costo en créditos antes de generar.", item: SHOW.granja },
            { n: "03", t: "Descarga y publica", d: "Tu galería guarda todo. Descarga en vertical, listo para TikTok y Reels.", item: SHOW.machu },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="card group relative h-72 overflow-hidden">
                <Image
                  src={s.item.src}
                  alt={s.item.alt}
                  fill
                  sizes="(max-width: 768px) 90vw, 380px"
                  className="object-cover opacity-40 transition duration-700 group-hover:scale-105 group-hover:opacity-55"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
                <div className="relative flex h-full flex-col justify-end p-6">
                  <span className="font-display text-2xl font-black italic text-ocre">{s.n}</span>
                  <h3 className="mt-1 text-xl font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-mute">{s.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="mx-auto mt-28 max-w-6xl scroll-mt-24 px-4">
        <SectionHead
          eyebrow="Precios"
          title="Planes y precios"
          sub="Plan mensual con más créditos o paquetes sueltos. En dólares, los créditos no vencen."
        />
        <Reveal className="mb-6">
          <div className="card grano resplandor grid items-center gap-6 border-ocre/50 bg-gradient-to-br from-ocre/15 via-cacao-2 to-panel p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <p className="eyebrow !text-brand-2">{PLAN.name} · el que más rinde</p>
              <p className="mt-2 text-4xl font-extrabold">
                ${PLAN.priceUsd}
                <span className="text-lg font-medium text-mute"> / mes</span>
              </p>
              <p className="mt-2 text-mute">
                {PLAN.credits} créditos cada mes <span className="text-brand-2">({PLAN.bonus})</span>: ≈ {Math.floor(PLAN.credits / 10)} videos con
                voz o ≈ {PLAN.credits} imágenes Trust Foto Flash. Se acumulan, no vencen y cancelas cuando quieras.
              </p>
            </div>
            <Link href="/entrar?modo=registro&next=/creditos" className="btn-primary !px-8 !py-3 text-base">
              Suscribirme <ArrowRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PACKS.map((p, i) => (
            <Reveal key={p.id} delay={i * 80}>
              <div className={`card relative flex h-full flex-col p-6 ${p.popular ? "border-brand shadow-lg shadow-brand/20" : ""}`}>
                {p.popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-on-brand">
                    Más elegido
                  </span>
                )}
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-3 text-4xl font-extrabold">${p.priceUsd}</p>
                <p className="mt-1 text-sm text-mute">
                  {p.credits.toLocaleString("es")} créditos {p.bonus && <span className="text-brand-2">({p.bonus})</span>}
                </p>
                <ul className="mt-5 flex-1 space-y-1.5 text-sm text-mute">
                  <li>≈ {Math.floor(p.credits / 10)} videos con voz de 5 s</li>
                  <li>≈ {Math.floor(p.credits / 3)} imágenes Trust Foto Plus</li>
                  <li>≈ {p.credits} imágenes Trust Foto Flash</li>
                </ul>
                <Link href="/entrar?modo=registro&next=/creditos" className={`mt-6 ${p.popular ? "btn-primary" : "btn-ghost"}`}>
                  Comprar
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-mute">
          <ShieldCheck size={15} /> Pago seguro con Stripe. Si una generación falla, te devolvemos los créditos.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-28 max-w-3xl px-4">
        <SectionHead eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-5 open:border-brand/40">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="text-mute transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-sm text-mute">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto mb-8 mt-28 max-w-6xl px-4">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line">
            <Image src={SHOW.machu.src} alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/30" />
            <div className="relative max-w-xl p-8 sm:p-14">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Tu próxima idea, en video</h2>
              <p className="mt-3 text-mute">
                Crea tu cuenta gratis, recarga desde US$10 y empieza a generar con {BRAND.name}. Esta imagen de Machu
                Picchu también la hizo la IA.
              </p>
              <Link href="/entrar?modo=registro" className="btn-primary mt-6 !px-6 !py-3">
                Crear cuenta <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
