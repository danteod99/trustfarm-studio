import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Clapperboard,
  Copy,
  FolderTree,
  MessageCircle,
  Minus,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  Tractor,
  UserRound,
  Users,
  Wand2,
} from "lucide-react";
import { PACKS, creditCost, getModel } from "@/app/lib/catalog";
import { BRAND } from "@/app/lib/brand";
import { getUser } from "@/app/lib/auth";
import Reveal from "@/app/components/Reveal";
import LightRays from "@/app/components/fx/LightRays";
import StarBorder from "@/app/components/fx/StarBorder";
import DecryptedText from "@/app/components/fx/DecryptedText";
import MultiplicarDemo from "./MultiplicarDemo";

const TITULO = "Modo Granja: un video distinto para cada cuenta de tu granja";
const DESCRIPCION =
  "Generas 1 a 5 videos con IA y TrustFarm Studio crea 100 versiones únicas, una por cuenta: gancho propio, otro color, otro encuadre y otra velocidad. Descarga por carpeta de cuenta, lista para tu multiposting.";
const OG_IMG = "/showcase/idea-estudio-40-iphones.jpg";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/granjas" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: "/granjas",
    siteName: BRAND.name,
    locale: "es_419",
    type: "website",
    images: [{ url: OG_IMG, width: 514, height: 900, alt: "Estudio con decenas de iPhones publicando de noche" }],
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION, images: [OG_IMG] },
};

const WHATSAPP = `https://wa.me/51955477423?text=${encodeURIComponent("Hola, quiero contenido para mi granja")}`;

// Ejemplo de costo justificado con el catálogo: 5 videos base con voz (Trust Cine Voz, 5 s, 720p).
// Las versiones se renderizan en el navegador, así que no cobran créditos; los ganchos IA van aparte.
const LTX = getModel("ltx-25")!;
const BASE_VIDEOS = 5;
const CREDITOS_BASE = BASE_VIDEOS * creditCost(LTX, { aspect: "9:16", duration: 5, resolution: "720p" });
const DESDE = Math.min(...PACKS.map((p) => p.priceUsd));

const COMPARA: { t: string; normal: string | false; granja: string }[] = [
  { t: "Videos por clic", normal: "1 video", granja: "Hasta 100+ versiones de 1 a 5 videos base" },
  { t: "Contenido distinto por cuenta", normal: false, granja: "Gancho, color, encuadre, velocidad y volumen propios" },
  { t: "Personaje fijo por cuenta", normal: "Lo armas a mano cada vez", granja: "Cada cuenta con su cara, siempre la misma" },
  { t: "Entrega", normal: "Un archivo suelto", granja: "ZIP con una carpeta por cuenta + caption" },
  { t: "Automático todos los días", normal: false, granja: "Loops que generan solos cada día" },
  { t: "Herramientas de edición", normal: "En otra app, aparte", granja: "Incluidas: cortos, variaciones y clips" },
];

const PASOS = [
  {
    n: "01",
    t: "Registra tus cuentas",
    d: "Pega la lista de cuentas de tu granja (TikTok, Instagram, Facebook o YouTube). A cada una le puedes fijar su personaje IA.",
    img: "/showcase/granja-iphones.jpg",
    alt: "Caja de iPhones encendidos con luces azules",
  },
  {
    n: "02",
    t: "Genera 1 a 5 videos base",
    d: "Con los modelos de video de TrustFarm Studio, en español, o súbelos desde tu galería.",
    img: "/showcase/idea-mano-iphone.jpg",
    alt: "Mano conectando un cable a una pila de iPhones",
  },
  {
    n: "03",
    t: "Multiplica y descarga",
    d: "Eliges cuántos por cuenta. La IA escribe un gancho distinto para cada una y te bajas un ZIP con una carpeta por cuenta.",
    img: "/showcase/idea-estudio-40-iphones.jpg",
    alt: "Pared con decenas de iPhones publicando videos",
  },
];

const HERRAMIENTAS = [
  {
    icon: Scissors,
    t: "Editor de cortos",
    d: "Quita silencios y retomas, pone subtítulos karaoke e iguala el volumen. Para tus videos grabados.",
  },
  {
    icon: Copy,
    t: "Variaciones únicas",
    d: "De un video sacas muchas versiones con otro color, brillo, tono y volumen. Ningún archivo repetido.",
  },
  {
    icon: Clapperboard,
    t: "Multiclipping",
    d: "Subes un video largo (podcast, en vivo, clase) y sale en clips cortos listos para TikTok y Reels.",
  },
];

const PARA_QUIEN = [
  { icon: Tractor, t: "Dueños de granjas", d: "Tienes 20, 100 o 1.000 cuentas y necesitas que cada una publique algo distinto cada día." },
  { icon: Building2, t: "Agencias", d: "Manejas cuentas de varios clientes y quieres volumen sin contratar más editores." },
  { icon: Store, t: "Tiendas con varias cuentas", d: "Mismo producto, muchas cuentas: cada una con su gancho y su estilo." },
];

const FAQ = [
  {
    q: "¿Las redes detectan los videos como duplicados?",
    a: "Cada archivo sale distinto: otro gancho escrito, otro color, otro encuadre, otra velocidad, otro volumen y sin los metadatos del original. Eso reduce mucho el riesgo de contenido repetido, pero ninguna herramienta puede garantizar cómo actúa cada red: publica con calma y respeta sus reglas.",
  },
  {
    q: "¿Necesito tener una granja de bots?",
    a: "No. Sirve igual si manejas 3 cuentas que si manejas 300. Registras las cuentas que tengas y listo.",
  },
  {
    q: "¿Cómo publico los videos?",
    a: "Descargas un ZIP con una carpeta por cuenta (video + caption) y los subes tú, o los cargas en el multiposting de TrustFarm o TrustMind para publicar desde tus celulares.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: `Pagas con créditos, desde US$${DESDE}. Los videos base se cobran como cualquier generación; las versiones se arman en tu navegador y no gastan créditos. Los ganchos que escribe la IA cuestan pocos créditos por lote.`,
  },
  {
    q: "¿Puedo hacerlo todos los días sin entrar?",
    a: "Sí. Con los Loops programas que se generen videos solos cada día y solo entras a multiplicarlos y descargar.",
  },
];

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <Reveal className="mb-10">
      <p className="eyebrow">
        <DecryptedText text={eyebrow} animateOn="view" sequential speed={35} encryptedClassName="text-brand-2" />
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-mute">{sub}</p>}
    </Reveal>
  );
}

export default async function GranjasPage() {
  const user = await getUser();
  // Hasta que exista /granja (Modo Granja), el usuario con sesión va al estudio.
  const cta = user ? "/estudio" : "/entrar?modo=registro&next=/estudio";
  const ctaTexto = user ? "Ir al estudio" : "Crear cuenta gratis";

  return (
    <div className="overflow-x-clip">
      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-70">
          <LightRays raysOrigin="top-center" raysColor="#22d3ee" raysSpeed={0.8} lightSpread={0.9} rayLength={1.4} followMouse mouseInfluence={0.08} noiseAmount={0.05} distortion={0.04} />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand-2">
              <Sparkles size={13} /> Nuevo: Modo Granja
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
              Un video distinto para <span className="text-brand-2">cada cuenta</span> de tu granja
            </h1>
            <p className="mt-5 max-w-xl text-lg text-mute">
              Otros generadores te hacen un video. {BRAND.short} te hace 100 videos distintos, uno para cada cuenta de tu
              granja, todos los días.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <StarBorder as="a" href={cta} color="#22d3ee" backgroundColor="#3b82f6" textColor="#ffffff" radius={12} className="!text-base !font-semibold">
                <span className="flex items-center justify-center gap-2 px-2">
                  {ctaTexto} <ArrowRight size={17} />
                </span>
              </StarBorder>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-6 !py-3 text-base">
                <MessageCircle size={17} /> Hablar por WhatsApp
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-mute">
              <span className="flex items-center gap-1.5"><Copy size={15} className="text-brand-2" /> Ningún archivo repetido</span>
              <span className="flex items-center gap-1.5"><FolderTree size={15} className="text-brand-2" /> Una carpeta por cuenta</span>
              <span className="flex items-center gap-1.5"><CalendarClock size={15} className="text-brand-2" /> Automático cada día</span>
            </div>
          </div>

          {/* Escena de granja */}
          <div className="relative mx-auto h-[480px] w-full max-w-[440px] sm:h-[560px]">
            <div className="absolute left-[16%] top-0 z-10 aspect-[9/16] w-[60%] overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/50">
              <video src="/showcase/ltx-granja.mp4" poster="/showcase/ltx-granja.jpg" autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
            </div>
            <div className="animate-float absolute bottom-6 left-0 aspect-[9/16] w-[38%] -rotate-6 overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/50">
              <Image src="/showcase/idea-estudio-40-iphones.jpg" alt="Pared con decenas de iPhones encendidos" fill sizes="180px" className="object-cover" priority />
            </div>
            <div className="animate-float absolute right-0 top-16 aspect-[9/16] w-[38%] rotate-6 overflow-hidden rounded-2xl border border-line shadow-2xl shadow-black/50 [animation-delay:-3s]">
              <Image src="/showcase/granja-iphones.jpg" alt="Caja de iPhones con luces azules" fill sizes="180px" className="object-cover" />
            </div>
            <div className="absolute bottom-0 right-2 z-20 rounded-xl border border-line bg-panel/90 px-3 py-2 text-xs backdrop-blur">
              <span className="font-semibold text-brand-2">@cuenta_037</span> · «Mientras duermes, esto publica»
              <span className="block text-mute">Gancho propio para esta cuenta</span>
            </div>
          </div>
        </div>
      </section>

      {/* Demo 1 → 100 */}
      <section className="mx-auto mt-8 max-w-6xl px-4">
        <SectionHead
          eyebrow="Multiplicar"
          title="1 video entra, 100 versiones salen"
          sub="Cada cuenta recibe su propia versión: gancho escrito por IA para esa cuenta, color, encuadre, velocidad y volumen distintos."
        />
        <Reveal>
          <div className="card p-4 sm:p-8">
            <MultiplicarDemo />
          </div>
        </Reveal>
      </section>

      {/* Comparación */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead
          eyebrow="La diferencia"
          title="Generador normal vs Modo Granja"
          sub="A diferencia de los generadores de un video a la vez, Modo Granja piensa en cuentas, no en archivos sueltos."
        />
        <Reveal>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_1.2fr] border-b border-line bg-panel-2 text-[11px] font-semibold uppercase tracking-wider text-mute sm:grid-cols-[1.1fr_1fr_1.3fr] sm:text-xs">
              <div className="p-3 sm:p-4"> </div>
              <div className="p-3 sm:p-4">Generador normal</div>
              <div className="bg-brand/10 p-3 text-brand-2 sm:p-4">Modo Granja</div>
            </div>
            {COMPARA.map((r) => (
              <div key={r.t} className="grid grid-cols-[1fr_1fr_1.2fr] border-b border-line text-xs last:border-b-0 sm:grid-cols-[1.1fr_1fr_1.3fr] sm:text-sm">
                <div className="p-3 font-medium sm:p-4">{r.t}</div>
                <div className="flex items-start gap-1.5 p-3 text-mute sm:p-4">
                  {r.normal === false ? (
                    <>
                      <Minus size={15} className="mt-0.5 shrink-0" /> No
                    </>
                  ) : (
                    r.normal
                  )}
                </div>
                <div className="flex items-start gap-1.5 bg-brand/5 p-3 sm:p-4">
                  <Check size={15} className="mt-0.5 shrink-0 text-brand-2" /> {r.granja}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead eyebrow="Cómo funciona" title="Tu granja con contenido en 3 pasos" />
        <div className="grid gap-5 md:grid-cols-3">
          {PASOS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="card group relative h-80 overflow-hidden">
                <Image src={s.img} alt={s.alt} fill sizes="(max-width: 768px) 90vw, 380px" className="object-cover opacity-45 transition duration-700 group-hover:scale-105 group-hover:opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-transparent" />
                <div className="relative flex h-full flex-col justify-end p-6">
                  <span className="font-mono text-sm text-brand-2">{s.n}</span>
                  <h3 className="mt-1 text-xl font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm text-mute">{s.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Mis cuentas + personaje */}
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <div className="card grid items-center gap-8 overflow-hidden p-6 sm:p-10 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow">Mis cuentas</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Cada cuenta con su propia cara</h2>
            <p className="mt-3 text-mute">
              Registra las cuentas de tu granja y fija un personaje IA a cada una. Sus videos siempre muestran a la misma
              persona: cada cuenta con su identidad y su estilo propios.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                { icon: Users, t: "Alta masiva: pegas la lista y listo" },
                { icon: UserRound, t: "Personaje IA fijo por cuenta (opcional)" },
                { icon: FolderTree, t: "ZIP con @cuenta/video + caption.txt" },
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
          <Reveal delay={150}>
            <div className="rounded-xl border border-line bg-bg/60 p-4 font-mono text-xs sm:text-sm">
              <p className="text-mute">granja-2026-11-04.zip</p>
              {[
                { c: "@lima.tech01", p: "Valeria" },
                { c: "@granja.pe02", p: "Diego" },
                { c: "@ventas.ya03", p: "Camila" },
              ].map((r) => (
                <div key={r.c} className="mt-3">
                  <p>
                    <span className="text-brand-2">▸ {r.c}/</span>
                    <span className="ml-2 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] text-brand-2">personaje: {r.p}</span>
                  </p>
                  <p className="pl-5 text-mute">video-01.mp4</p>
                  <p className="pl-5 text-mute">caption.txt</p>
                </div>
              ))}
              <p className="mt-3 text-mute">… y una carpeta más por cada cuenta</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Herramientas */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead
          eyebrow="Incluido"
          title="Herramientas de edición en la misma cuenta"
          sub="Para lo que grabas tú o lo que ya tienes: todo dentro de TrustFarm Studio, sin instalar nada."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HERRAMIENTAS.map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 100}>
              <Link href="/editar" className="card group flex h-full flex-col p-6 transition hover:-translate-y-0.5 hover:border-brand/50">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand/15 text-brand-2">
                  <Icon size={20} />
                </span>
                <h3 className="mt-4 flex items-center justify-between text-lg font-semibold">
                  {t}
                  <ArrowRight size={16} className="text-mute transition group-hover:translate-x-1 group-hover:text-brand-2" />
                </h3>
                <p className="mt-1 flex-1 text-sm text-mute">{d}</p>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4">
          <Link href="/flujos" className="card flex flex-col gap-3 p-5 transition hover:border-brand/50 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand-2">
                <CalendarClock size={18} />
              </span>
              <span>
                <span className="font-semibold">Loops automáticos</span>
                <span className="block text-sm text-mute">Programa que tus videos base se generen solos todos los días.</span>
              </span>
            </span>
            <span className="flex items-center gap-1 text-sm text-brand-2">
              Ver Flujos <ArrowRight size={15} />
            </span>
          </Link>
        </Reveal>
      </section>

      {/* Para quién */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <SectionHead eyebrow="Para quién" title="Hecho para quien maneja muchas cuentas" />
        <div className="grid gap-4 md:grid-cols-3">
          {PARA_QUIEN.map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 100}>
              <div className="card h-full p-6">
                <Icon size={22} className="text-brand-2" />
                <h3 className="mt-3 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-mute">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="mx-auto mt-28 max-w-6xl scroll-mt-24 px-4">
        <SectionHead
          eyebrow="Precios"
          title={`Créditos desde US$${DESDE}, sin contratos`}
          sub="Pagas los videos base que generas y unos pocos créditos por los ganchos IA. Las versiones se arman en tu navegador: no gastan créditos."
        />
        <Reveal className="mb-6">
          <div className="card grid items-center gap-6 bg-gradient-to-br from-brand/15 to-panel p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <p className="eyebrow !text-brand-2">Ejemplo</p>
              <p className="mt-2 text-2xl font-extrabold sm:text-3xl">
                100 videos únicos ≈ {CREDITOS_BASE} créditos <span className="text-lg font-medium text-mute">+ ganchos IA</span>
              </p>
              <p className="mt-2 text-sm text-mute">
                {BASE_VIDEOS} videos base con voz de 5 s en 720p ({LTX.name}, {CREDITOS_BASE / BASE_VIDEOS} créditos c/u) → 20
                versiones de cada uno = 100 videos, uno por cuenta.
              </p>
            </div>
            <Link href={cta} className="btn-primary !px-8 !py-3 text-base">
              {ctaTexto} <ArrowRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PACKS.map((p) => (
            <div key={p.id} className={`card p-5 ${p.popular ? "border-brand shadow-lg shadow-brand/20" : ""}`}>
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-extrabold">${p.priceUsd}</p>
              <p className="mt-1 text-xs text-mute">
                {p.credits.toLocaleString("es")} créditos {p.bonus && <span className="text-brand-2">({p.bonus})</span>}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-mute">
          <ShieldCheck size={15} className="shrink-0" /> Pago seguro con Stripe. Los créditos no vencen.
          <Link href="/creditos" className="text-brand-2 hover:underline">Ver planes</Link>
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-28 max-w-3xl px-4">
        <SectionHead eyebrow="Dudas" title="Preguntas frecuentes" />
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-5 open:border-brand/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
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
            <Image src="/showcase/idea-estudio-40-iphones.jpg" alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/40" />
            <div className="relative max-w-xl p-8 sm:p-14">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Que cada cuenta publique algo distinto hoy</h2>
              <p className="mt-3 text-mute">
                Crea tu cuenta gratis, genera tus videos base y multiplícalos para toda tu granja.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href={cta} className="btn-primary !px-6 !py-3">
                  <Wand2 size={17} /> {ctaTexto}
                </Link>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-6 !py-3">
                  <MessageCircle size={17} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
