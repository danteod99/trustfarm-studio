import Image from "next/image";
import type { Metadata } from "next";
import BotonUnirme from "./BotonUnirme";
import PixelComunidad from "./PixelComunidad";

const TITULO = "Artificial Humans: tu ecosistema de multiposting";
const DESCRIPCION =
  "Comunidad en Skool para aprender a crear y operar tu granja de celulares, con multiclipping e IA.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/comunidad" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/comunidad", images: ["/comunidad/portada.jpg"] },
};

const CONTENIDO = [
  { titulo: "Granjas físicas y digitales", texto: "Cómo crear tu granja de celulares y ponerla a operar." },
  { titulo: "Software TrustFarm", texto: "Cómo controlar y automatizar tu granja desde el software." },
  { titulo: "Automatización con Claude Code", texto: "Cómo usar IA para automatizar la operación de tu granja." },
  { titulo: "Software con Claude Code", texto: "Cómo crear y vender tus propias herramientas." },
];

const BONOS = ["20 cursos adicionales", "Sesiones 1 a 1 con Dante"];

export default function ComunidadPage() {
  return (
    <div className="overflow-x-clip">
      <PixelComunidad />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-8 pt-12 lg:grid-cols-2 lg:pt-20">
        <div>
          <p className="eyebrow">Comunidad Artificial Humans</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Aprende a crear y operar tu granja de celulares
          </h1>
          <p className="mt-4 text-mute">
            Tu ecosistema de multiposting: granjas de celulares, multiclipping e IA, en una comunidad en Skool con Dante
            Oliveros.
          </p>
          <div className="mt-8">
            <BotonUnirme className="btn-primary" />
          </div>
          <p className="mt-3 text-sm text-mute">US$ 39 al mes · Más de 750 miembros · Te lleva a Skool</p>
        </div>
        <Image
          src="/comunidad/portada.jpg"
          alt="Dante Oliveros con una granja de celulares abierta"
          width={1400}
          height={788}
          priority
          className="h-auto w-full rounded-xl"
        />
      </section>
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-3xl font-bold tracking-tight">Qué hay dentro</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CONTENIDO.map((c) => (
            <div key={c.titulo} className="rounded-xl border border-line bg-panel p-5">
              <h3 className="font-semibold">{c.titulo}</h3>
              <p className="mt-2 text-sm text-mute">{c.texto}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-10 text-2xl font-bold tracking-tight">Además</h2>
        <ul className="mt-3 list-disc pl-5 text-mute">
          {BONOS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <div className="mt-8">
          <BotonUnirme className="btn-primary" />
        </div>
      </section>
    </div>
  );
}
