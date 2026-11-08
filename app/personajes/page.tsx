import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  AudioLines,
  Camera,
  Check,
  Coins,
  Film,
  Repeat,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { PACKS, PLAN } from "@/app/lib/catalog";
import { BRAND } from "@/app/lib/brand";
import { getUser } from "@/app/lib/auth";
import Reveal from "@/app/components/Reveal";
import { EventoAlVer } from "@/app/components/PixelStudio";

const TITULO = "Personajes IA y videos con movimiento para todas tus cuentas";
const DESCRIPCION =
  "Crea un personaje con IA, ponlo a hablar, caminar y moverse en videos verticales, y recrea el mismo video con la cara de cada cuenta. Hecho para granjas, agencias y creadores.";
const OG_IMG = "/showcase/creadora-cafe.jpg";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/personajes" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: "/personajes",
    siteName: BRAND.name,
    locale: "es_419",
    type: "website",
    images: [{ url: OG_IMG, alt: "Personaje IA hablando a cámara en una cafetería" }],
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION, images: [OG_IMG] },
};

type Item = { src: string; poster: string; tag: string; video: boolean };
const v = (n: string, tag: string): Item => ({ src: `/showcase/${n}.mp4`, poster: `/showcase/${n}.jpg`, tag, video: true });
const im = (n: string, tag: string): Item => ({ src: "", poster: `/showcase/${n}.jpg`, tag, video: false });

// Muro de 3 columnas: videos reales del estudio mezclados con personajes. Cada columna se duplica para el bucle.
const COL_A: Item[] = [
  v("ltx-cafe", "Creadora · habla a cámara"),
  im("idea-outfit-calle", "Modelo IA · outfit"),
  v("brainrot-papa", "Brainrot · papa en moto"),
  im("idea-coach-gym", "Coach fitness"),
];
const COL_B: Item[] = [
  im("idea-viajera-cusco", "Viajera · Cusco"),
  v("brainrot-llama", "Brainrot · llama licuadora"),
  im("idea-chef", "Chef con fuego real"),
  v("ltx-granja", "Granja de celulares"),
];
const COL_C: Item[] = [
  v("brainrot-pollo", "Brainrot · pollo bailarín"),
  im("idea-profesor-dato", "Profe explicando"),
  v("brainrot-cuy", "Brainrot · cuy astronauta"),
  im("idea-yoga-amanecer", "Yoga al amanecer"),
];

const CASOS = [
  { img: "creadora-cafe", t: "Creadora hablando a cámara", d: "Estilo selfie de Reels: ella te cuenta el producto, con voz y gestos." },
  { img: "idea-outfit-calle", t: "Modelo IA en movimiento", d: "Camina, gira y posa. Cambias el outfit, el lugar o el producto y mantienes su cara." },
  { img: "idea-viajera-cusco", t: "Viajera / lifestyle", d: "Mismo personaje en Cusco, Lima o la playa. Un video por destino." },
  { img: "idea-chef", t: "Escenas con acción", d: "Fuego, vapor, cámara que se mueve. Movimiento real, no fotos con zoom." },
];

const PASOS = [
  { icon: UserRound, n: "01", t: "Crea o sube tu personaje", d: "Lo generas con IA o subes una foto. Queda guardado en tus presets con la misma cara siempre." },
  { icon: Wand2, n: "02", t: "Dile qué hacer", d: "«Habla a cámara en una cafetería», «camina por la calle»… Eliges modelo, voz y duración." },
  { icon: Repeat, n: "03", t: "Recrea para cada cuenta", d: "Mismo video con otro personaje, otro gancho y otro encuadre. Uno por cuenta de tu granja." },
];

const FEATURES = [
  { icon: Film, t: "Videos verticales con movimiento", d: "Cine, caminatas, gestos, escenas de acción y cámara dinámica en 9:16." },
  { icon: AudioLines, t: "Voz y lip-sync en español", d: "Tu personaje habla con voz propia y labios sincronizados." },
  { icon: Camera, t: "Personaje consistente", d: "La misma cara y ropa en cada video, para que cada cuenta tenga identidad." },
  { icon: Sparkles, t: "Formatos que ya funcionan", d: "Frutinovelas, brainrot, modelos IA, miniseries y reseñas, listos con un clic." },
];

function Tarjeta({ it }: { it: Item }) {
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-line bg-panel">
      {it.video ? (
        <video src={it.src} poster={it.poster} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.poster} alt={it.tag} loading="lazy" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
        <span className="text-[11px] font-semibold text-ocre">{it.tag}</span>
      </div>
      {it.video && (
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ocre backdrop-blur">
          ▶ video
        </span>
      )}
    </div>
  );
}

function Columna({ items, dir, className = "" }: { items: Item[]; dir: "up" | "down"; className?: string }) {
  const dup = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`flex flex-col gap-3 ${dir === "up" ? "animate-col-up" : "animate-col-down"}`}>
        {dup.map((it, i) => (
          <Tarjeta key={`${it.poster}-${i}`} it={it} />
        ))}
      </div>
    </div>
  );
}

export default async function PersonajesPage() {
  const user = await getUser();
  const suscribir = user ? "/creditos#plan" : "/entrar?modo=registro&next=/creditos%23plan";
  const recargar = user ? "/creditos#paquetes" : "/entrar?modo=registro&next=/creditos%23paquetes";
  const estudio = user ? "/estudio" : "/entrar?modo=registro&next=/estudio";
  const DESDE = Math.min(...PACKS.map((p) => p.priceUsd));
  const textoSuscribir = `Suscribirme · $${PLAN.priceUsd}/mes`;

  return (
    <div className="overflow-x-clip">
      <EventoAlVer evento="ViewContent" datos={{ content_name: "Personajes IA" }} />

      {/* Hero con muro de videos */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,color-mix(in_srgb,var(--color-ocre)_14%,transparent),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ocre/40 bg-ocre/10 px-3 py-1 text-xs font-semibold text-ocre">
              <Sparkles size={13} /> Personajes IA + video en movimiento
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
              Un personaje, <span className="text-ocre">mil videos</span> con vida
            </h1>
            <p className="mt-5 max-w-xl text-lg text-mute">
              Crea personajes con IA y hazlos hablar, caminar y moverse. Recrea el mismo video con la cara de cada cuenta de
              tu granja, en {BRAND.short}.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={estudio} className="btn !bg-ocre !px-7 !py-3 text-base !text-cacao hover:!bg-ocre-claro">
                <Wand2 size={17} /> Crear mi personaje
              </Link>
              <Link href={suscribir} className="btn-ghost !px-6 !py-3 text-base">
                <Repeat size={17} className="text-ocre" /> {textoSuscribir}
              </Link>
            </div>
            <p className="mt-3 text-sm text-mute">
              {PLAN.credits} créditos cada mes · o recarga desde US${DESDE} · cancelas cuando quieras
            </p>
            <ul className="mt-8 space-y-2 text-sm text-mute">
              {["Voz y lip-sync en español", "Misma cara en todos los videos", "Hasta un video distinto por cuenta"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={15} className="text-ocre" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative grid h-[520px] grid-cols-3 gap-3 sm:h-[640px] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]">
            <Columna items={COL_A} dir="up" />
            <Columna items={COL_B} dir="down" className="mt-10" />
            <Columna items={COL_C} dir="up" />
          </div>
        </div>
      </section>

      {/* Casos */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <Reveal className="mb-8">
          <p className="eyebrow !text-ocre">Para reels</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Crea videos virales o recrea los que ya funcionan</h2>
          <p className="mt-3 max-w-2xl text-mute">Con tu personaje, tu voz y tu estilo. Toca una idea y se abre en el estudio.</p>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CASOS.map((c, i) => (
            <Reveal key={c.img} delay={i * 90}>
              <Link href={estudio} className="group block">
                <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/showcase/${c.img}.jpg`} alt={c.t} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-1.5 rounded-xl bg-hueso py-2 text-xs font-bold text-cacao opacity-0 transition group-hover:opacity-100">
                    Recrear <ArrowRight size={13} />
                  </span>
                </div>
                <h3 className="mt-3 font-semibold">{c.t}</h3>
                <p className="mt-1 text-sm text-mute">{c.d}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <Reveal className="mb-8">
          <p className="eyebrow !text-ocre">Cómo funciona</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">De una foto a un video en 3 pasos</h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {PASOS.map(({ icon: Icon, n, t, d }, i) => (
            <Reveal key={n} delay={i * 110}>
              <div className="card h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-ocre/15 text-ocre">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-sm text-ocre">{n}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-mute">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto mt-28 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, t, d }, i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="card flex h-full gap-4 p-6">
                <Icon size={22} className="mt-0.5 shrink-0 text-ocre" />
                <div>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-mute">{d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4">
          <Link href="/granjas" className="card flex flex-col gap-3 p-5 transition hover:border-ocre/50 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="font-semibold">¿Manejas muchas cuentas?</span>
              <span className="block text-sm text-mute">Con Modo Granja multiplicas cada video en versiones únicas, una por cuenta.</span>
            </span>
            <span className="flex items-center gap-1 text-sm text-ocre">
              Ver Modo Granja <ArrowRight size={15} />
            </span>
          </Link>
        </Reveal>
      </section>

      {/* Cierre */}
      <section className="mx-auto mb-8 mt-28 max-w-6xl px-4">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-ocre/10 to-panel p-8 text-center sm:p-14">
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Dale vida a tu primer personaje hoy</h2>
            <p className="mx-auto mt-3 max-w-xl text-mute">Créditos desde US${DESDE}. Pago seguro con Stripe, sin contratos.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href={estudio} className="btn !bg-ocre !px-7 !py-3 text-base !text-cacao hover:!bg-ocre-claro">
                <Wand2 size={17} /> Crear mi personaje
              </Link>
              <Link href={recargar} className="btn-ghost !px-6 !py-3 text-base">
                <Coins size={17} className="text-ocre" /> Recargar créditos
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
