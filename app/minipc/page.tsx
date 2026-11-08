import Image from "next/image";
import type { Metadata } from "next";
import { Check, MessageCircle } from "lucide-react";
import Reveal from "@/app/components/Reveal";
import {
  PLANES,
  CONTACTO,
  ENTREGA_TEXTO,
  RESERVA_USD,
  ventaAbierta,
  paginaVisible,
  libroReclamacionesUrl,
} from "@/app/lib/minipc";
import {
  APP_VISTAS,
  CAJAS_WEB,
  CONTROL,
  DESCRIPCION,
  FOTOS,
  TITULO,
  EQUIPO,
  ESTUDIO_VIDEO,
  FAQ,
  FRASE_MENSUALIDAD,
  NEGOCIOS,
  PASOS,
  PROMESA,
  QUE_HACE,
  TEXTO_ACTUALIZACIONES,
  TEXTO_BORRADO_CLIPS,
  USOS,
} from "@/app/lib/minipc-contenido";
import PlanCard from "./PlanCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/minipc" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: "/minipc",
    siteName: "TrustFarm",
    locale: "es_419",
    type: "website",
    images: [{ url: FOTOS.hero.src, width: FOTOS.hero.ancho, height: FOTOS.hero.alto, alt: FOTOS.hero.alt }],
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION, images: [FOTOS.hero.src] },
  robots: paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: process.env.NEXT_PUBLIC_MINIPC_VISIBLE })
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

function Seccion({
  id,
  eyebrow,
  titulo,
  sub,
  children,
}: {
  id?: string;
  eyebrow: string;
  titulo: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <Reveal className="mb-8">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id ? `${id}-t` : undefined} className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {titulo}
        </h2>
        {sub && <p className="mt-3 max-w-2xl text-mute">{sub}</p>}
      </Reveal>
      {children}
    </section>
  );
}

function Num({ n }: { n: number }) {
  return <span className="text-sm font-semibold text-brand">{String(n).padStart(2, "0")}</span>;
}

export default function MinipcPage() {
  const abierta = ventaAbierta({ MINIPC_VENTA_ACTIVA: process.env.MINIPC_VENTA_ACTIVA });
  const reclamos = libroReclamacionesUrl({
    NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL: process.env.NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL,
  });

  return (
    <div className="overflow-x-clip">
      {/* Héroe */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 pt-12 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="eyebrow">Catálogo 2026 · Inteligencia artificial</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">TRUST Assistant</h1>
          <p className="mt-4 text-xl text-ink sm:text-2xl">{PROMESA}</p>
          <p className="mt-4 text-mute">Vende · toma pedidos · agenda citas · edita tus videos.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#planes" className="btn-primary">
              Ver planes y precios
            </a>
            <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Prefiero cotizar por WhatsApp
            </a>
          </div>
          <dl className="mt-10 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-mute">Atiende tu WhatsApp</dt>
              <dd className="text-2xl font-bold">24/7</dd>
            </div>
            <div>
              <dt className="text-mute">Clips con IA por video (Pro y Negocio)</dt>
              <dd className="text-2xl font-bold">15</dd>
            </div>
            <div>
              <dt className="text-mute">Soporte y oficina</dt>
              <dd className="text-2xl font-bold">Lima</dd>
            </div>
          </dl>
        </div>
        <div className="card overflow-hidden">
          <Image
            src={FOTOS.hero.src}
            alt={FOTOS.hero.alt}
            width={FOTOS.hero.ancho}
            height={FOTOS.hero.alto}
            preload
            sizes="(min-width: 1024px) 560px, 100vw"
            className="h-auto w-full"
          />
        </div>
      </section>

      {/* Qué hace */}
      <Seccion
        eyebrow="Qué es"
        titulo="Una mini PC con un vendedor con IA adentro"
        sub="Se conecta en tu negocio y atiende tu WhatsApp por ti: responde con tu catálogo y tus precios, toma pedidos, agenda citas y cada noche te manda el resumen del día. Lo ves en la pantalla de tu caja y desde tu celular."
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUE_HACE.map((q, i) => (
            <li key={q.titulo}>
              <Reveal delay={i * 60} className="card h-full p-5">
                <Num n={i + 1} />
                <h3 className="mt-2 text-lg font-semibold">{q.titulo}</h3>
                <p className="mt-1 text-sm text-mute">{q.texto}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* Cómo funciona */}
      <Seccion eyebrow="Cómo funciona" titulo="Cuatro pasos y tu vendedor está listo">
        <ol className="grid gap-4 sm:grid-cols-2">
          {PASOS.map((p, i) => (
            <li key={p.titulo}>
              <Reveal delay={i * 60} className="card h-full p-5">
                <Num n={i + 1} />
                <h3 className="mt-2 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1 text-sm text-mute">{p.texto}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Seccion>

      {/* Así se ve */}
      <Seccion
        eyebrow="Sistema real"
        titulo="Así se ve tu negocio en vivo"
        sub="En la pantalla de tu caja: lo que vendiste hoy, tus pedidos, los chats que atendió la IA y los que esperan a una persona. En tu celular, lo mismo, donde estés."
      >
        <Reveal className="card overflow-hidden p-2">
          <Image
            src={FOTOS.pantallaCaja.src}
            alt={FOTOS.pantallaCaja.alt}
            width={FOTOS.pantallaCaja.ancho}
            height={FOTOS.pantallaCaja.alto}
            sizes="(min-width: 1152px) 1120px, 100vw"
            className="h-auto w-full rounded-xl"
          />
        </Reveal>
        <div className="mt-6 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center gap-4">
            <Image
              src={FOTOS.celularHoy.src}
              alt={FOTOS.celularHoy.alt}
              width={FOTOS.celularHoy.ancho}
              height={FOTOS.celularHoy.alto}
              sizes="(min-width: 640px) 220px, 42vw"
              className="h-auto w-[42vw] max-w-[220px] rounded-xl border border-line"
            />
            <Image
              src={FOTOS.celularChat.src}
              alt={FOTOS.celularChat.alt}
              width={FOTOS.celularChat.ancho}
              height={FOTOS.celularChat.alto}
              sizes="(min-width: 640px) 220px, 42vw"
              className="h-auto w-[42vw] max-w-[220px] rounded-xl border border-line"
            />
          </div>
          <ul className="space-y-4">
            {APP_VISTAS.map((v) => (
              <li key={v.titulo} className="card p-5">
                <h3 className="font-semibold">{v.titulo}</h3>
                <p className="mt-1 text-sm text-mute">{v.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </Seccion>

      {/* Estudio de video */}
      <Seccion eyebrow="Estudio de video" titulo="Tu contenido, editado por la IA" sub={ESTUDIO_VIDEO.intro}>
        <p className="mb-6 inline-block rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm">
          {ESTUDIO_VIDEO.disponibilidad}
        </p>
        <ul className="grid gap-4 md:grid-cols-3">
          {ESTUDIO_VIDEO.herramientas.map((h, i) => (
            <li key={h.titulo} className="card p-5">
              <Num n={i + 1} />
              <h3 className="mt-2 text-lg font-semibold">{h.titulo}</h3>
              <p className="mt-1 text-sm text-mute">{h.texto}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="card p-5">
            <h3 className="font-semibold">Clips listos para publicar</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {ESTUDIO_VIDEO.clipsListos.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Ideal para</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-mute">
              {ESTUDIO_VIDEO.idealPara.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-sm text-mute">{TEXTO_BORRADO_CLIPS}</p>
        <h3 className="mt-10 text-xl font-semibold">Conectada a trustfarm.online</h3>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {CAJAS_WEB.map((c) => (
            <li key={c.titulo} className="card p-5">
              <h4 className="font-semibold">{c.titulo}</h4>
              <p className="mt-1 text-sm text-mute">{c.texto}</p>
            </li>
          ))}
        </ul>
      </Seccion>

      {/* El equipo */}
      <Seccion eyebrow="El equipo · Mini PC TRUST" titulo="Pequeña por fuera, potente por dentro" sub={EQUIPO.intro}>
        <ul className="grid gap-4 sm:grid-cols-3">
          {EQUIPO.fotos.map((f) => (
            <li key={f.src}>
              <figure className="card overflow-hidden">
                <Image
                  src={f.src}
                  alt={f.alt}
                  width={f.ancho}
                  height={f.alto}
                  sizes="(min-width: 1152px) 360px, (min-width: 640px) 33vw, 100vw"
                  className="h-auto w-full"
                />
                <figcaption className="p-3 text-xs text-mute">{f.pie}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-mute">{EQUIPO.medidas}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {EQUIPO.versiones.map((v) => (
            <div key={v.titulo} className="card p-5">
              <p className="eyebrow">Versión</p>
              <h3 className="mt-1 text-lg font-semibold">{v.titulo}</h3>
              <p className="text-brand">{v.chip}</p>
              <ul className="mt-3 space-y-2 text-sm text-mute">
                {v.datos.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Seccion>

      {/* Funciona donde tú vendes */}
      <Seccion
        eyebrow="En tu negocio"
        titulo="Funciona donde tú vendes"
        sub="En la caja de tu bodega, el mostrador de tu restaurante, la recepción de tu salón o el escritorio donde grabas tu contenido."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {USOS.map((u) => (
            <li key={u.titulo}>
              <figure className="card overflow-hidden">
                <Image
                  src={u.src}
                  alt={u.alt}
                  width={u.ancho}
                  height={u.alto}
                  sizes="(min-width: 1152px) 560px, (min-width: 640px) 50vw, 100vw"
                  className="h-auto w-full"
                />
                <figcaption className="p-4 font-semibold">{u.titulo}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
        <p className="eyebrow mt-8">Para qué negocios</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {NEGOCIOS.map((n) => (
            <li key={n} className="chip">
              {n}
            </li>
          ))}
        </ul>
      </Seccion>

      {/* Planes */}
      <Seccion
        id="planes"
        eyebrow="Planes · Mini PC + vendedor IA"
        titulo="Elige tu plan"
        sub={`Reserva tu equipo hoy con $${RESERVA_USD}; se descuentan del precio y el saldo lo pagas al coordinar la entrega. La mensualidad empieza cuando activas tu caja. Envíos solo a Perú por ahora. Entrega en ${ENTREGA_TEXTO}.`}
      >
        <div className="grid gap-8 pt-3 md:grid-cols-3">
          {PLANES.filter((p) => p.activo).map((p) => (
            <PlanCard key={p.id} plan={p} ventaAbierta={abierta} />
          ))}
        </div>
        <p className="mt-8 max-w-3xl text-sm text-mute">{FRASE_MENSUALIDAD}</p>
        <p className="mt-2 max-w-3xl text-sm text-mute">{TEXTO_ACTUALIZACIONES}</p>
        <p className="mt-2 max-w-3xl text-sm text-mute">
          Guardamos tu tarjeta, con tu permiso, para cobrar la mensualidad cuando actives tu caja.
        </p>
      </Seccion>

      {/* Control + FAQ */}
      <Seccion eyebrow="Tú tienes el control" titulo="Vende solo, pero con tus reglas">
        <ul className="grid gap-3 md:grid-cols-2">
          {CONTROL.map((c) => (
            <li key={c} className="card flex gap-2 p-4 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-10 text-xl font-semibold">Preguntas frecuentes</h3>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <div key={f.q} className="card p-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-sm text-mute">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Seccion>

      {/* Cierre */}
      <section aria-labelledby="contacto-t" className="mx-auto max-w-6xl px-4 py-14">
        <div className="card grid items-center gap-6 overflow-hidden md:grid-cols-2">
          <Image
            src={FOTOS.cierre.src}
            alt={FOTOS.cierre.alt}
            width={FOTOS.cierre.ancho}
            height={FOTOS.cierre.alto}
            sizes="(min-width: 1152px) 560px, (min-width: 768px) 50vw, 100vw"
            className="h-auto w-full"
          />
          <div className="p-6">
            <h2 id="contacto-t" className="text-3xl font-black tracking-tight">
              Quiero mi asistente
            </h2>
            <p className="mt-3 text-mute">
              Oficina en {CONTACTO.oficina} · TikTok {CONTACTO.tiktok}
            </p>
            <a href={CONTACTO.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-6">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp {CONTACTO.whatsapp}
            </a>
            {reclamos && (
              <p className="mt-6 text-sm">
                <a href={reclamos} target="_blank" rel="noopener noreferrer" className="text-mute underline hover:text-ink">
                  Libro de Reclamaciones
                </a>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
