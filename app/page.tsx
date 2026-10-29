import Link from "next/link";
import { ArrowRight, Clapperboard, Coins, ImageIcon, Languages, ShieldCheck, Sparkles } from "lucide-react";
import { MODELS, PACKS, creditCost } from "@/app/lib/catalog";
import { BRAND } from "@/app/lib/brand";

function exampleCost(id: string) {
  const m = MODELS.find((x) => x.id === id)!;
  if (m.kind === "image") return `${creditCost(m, { aspect: "1:1" })} créditos / imagen`;
  const d = Math.max(...(m.durations ?? [8]));
  const r = m.resolutions?.[0] ?? "720p";
  return `${creditCost(m, { aspect: "9:16", duration: d, resolution: r })} créditos / clip ${d} s ${r}`;
}

const FAQ = [
  {
    q: "¿Cómo funcionan los créditos?",
    a: "Compras un paquete una sola vez y cada generación descuenta créditos según el modelo, la duración y la resolución. No hay suscripción ni cobros automáticos.",
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
    a: "No. Tus créditos quedan en tu cuenta hasta que los uses.",
  },
  {
    q: "¿Cómo pago?",
    a: "Con tarjeta de crédito o débito de cualquier país a través de Stripe. Los precios están en dólares (USD).",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-96 max-w-3xl rounded-full bg-brand/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-mute">
            <Sparkles size={13} className="text-brand-2" /> Veo 3.1 · Nano Banana · Wan 2.2 · Qwen-Image
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Imágenes y videos con IA, <span className="text-brand-2">en minutos</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-mute">
            Escribe lo que imaginas en español y obtén videos con audio y fotos de calidad profesional para tus anuncios,
            redes y proyectos. Pagas solo por lo que generas.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/entrar?modo=registro" className="btn-primary !px-6 !py-3 text-base">
              Empezar a crear <ArrowRight size={17} />
            </Link>
            <Link href="#precios" className="btn-ghost !px-6 !py-3 text-base">
              Ver precios
            </Link>
          </div>
        </div>
      </section>

      {/* Beneficios */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Clapperboard, t: "Video con audio", d: "Clips de hasta 8 s con sonido, diálogo y lip-sync usando Veo 3.1." },
          { icon: ImageIcon, t: "Imagen → video", d: "Sube una foto de tu producto y anímala manteniendo cada detalle." },
          { icon: Languages, t: "Todo en español", d: "Escribe tus ideas en español; la plataforma y el soporte también lo están." },
          { icon: Coins, t: "Sin suscripción", d: "Créditos prepagados que no vencen. Si algo falla, te los devolvemos." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="card p-5">
            <Icon size={20} className="text-brand-2" />
            <h3 className="mt-3 font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-mute">{d}</p>
          </div>
        ))}
      </section>

      {/* Modelos */}
      <section className="mx-auto mt-24 max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold">Los mejores modelos en un solo lugar</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-mute">
          Elige el modelo según lo que necesites: calidad máxima, velocidad o el menor costo.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.map((m) => (
            <div key={m.id} className="card flex flex-col p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-mute">
                  {m.kind === "video" ? "Video" : "Imagen"}
                </span>
                {m.badge && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-medium text-brand-2">{m.badge}</span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{m.name}</h3>
              <p className="mt-1 flex-1 text-sm text-mute">{m.tagline}</p>
              <p className="mt-4 text-sm font-medium text-ink">{exampleCost(m.id)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="mx-auto mt-24 max-w-6xl scroll-mt-24 px-4">
        <h2 className="text-center text-3xl font-bold">Paquetes de créditos</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-mute">
          Pago único en USD. Mientras más grande el paquete, más créditos de regalo.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PACKS.map((p) => (
            <div key={p.id} className={`card relative flex flex-col p-6 ${p.popular ? "border-brand" : ""}`}>
              {p.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-xs font-semibold text-white">
                  Más elegido
                </span>
              )}
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-3 text-4xl font-extrabold">${p.priceUsd}</p>
              <p className="mt-1 text-sm text-mute">
                {p.credits.toLocaleString("es")} créditos {p.bonus && <span className="text-brand-2">({p.bonus})</span>}
              </p>
              <ul className="mt-5 flex-1 space-y-1.5 text-sm text-mute">
                <li>≈ {Math.floor(p.credits / 14)} videos Veo Lite 8 s 1080p</li>
                <li>≈ {Math.floor(p.credits / 3)} imágenes Nano Banana 2</li>
              </ul>
              <Link href="/entrar?modo=registro&next=/creditos" className={`mt-6 ${p.popular ? "btn-primary" : "btn-ghost"}`}>
                Comprar
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-sm text-mute">
          <ShieldCheck size={15} /> Pago seguro con Stripe. Los créditos no vencen.
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-24 max-w-3xl px-4">
        <h2 className="text-center text-3xl font-bold">Preguntas frecuentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-5">
              <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-mute">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-4xl px-4">
        <div className="card bg-gradient-to-br from-brand/20 to-transparent p-10 text-center">
          <h2 className="text-3xl font-bold">Tu próxima idea, en video</h2>
          <p className="mt-3 text-mute">Crea tu cuenta y empieza a generar con {BRAND.name}.</p>
          <Link href="/entrar?modo=registro" className="btn-primary mt-6 !px-6 !py-3">
            Crear cuenta <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
