import Link from "next/link";
import { Clapperboard, Copy, Film, Radio, Scissors } from "lucide-react";
import SpotlightCard from "@/app/components/fx/SpotlightCard";
import { EDITAR_PRECIOS } from "@/app/lib/editar";
import { EN_VIVO_CREDITOS } from "@/app/lib/en-vivo";

export const metadata = { title: "Editar" };

const TOOLS = [
  {
    href: "/editar/variaciones",
    icon: <Copy size={20} />,
    title: "Variaciones únicas",
    text: "Convierte un video en 5, 20 o 50 versiones distintas (color, brillo, tono, volumen) para publicarlo en muchas cuentas sin que se vea repetido.",
    price: "Gratis · corre en tu computadora",
    extra: `Subtítulos automáticos opcionales: ${EDITAR_PRECIOS.transcripcion + EDITAR_PRECIOS.detectarSubs} créditos por video`,
  },
  {
    href: "/editar/cortos",
    icon: <Scissors size={20} />,
    title: "Editor de cortos",
    text: "Sube tu video hablado y te lo devolvemos sin silencios ni retomas, con subtítulos estilo TikTok y el volumen parejo.",
    price: `${EDITAR_PRECIOS.transcripcion} créditos la transcripción`,
    extra: `+${EDITAR_PRECIOS.retomas} créditos si cortamos las retomas con IA · cortar silencios es gratis`,
  },
  {
    href: "/editar/clips",
    icon: <Clapperboard size={20} />,
    title: "Multiclipping",
    text: "Sube un video largo o pega un link de YouTube (podcast, clase, tutorial, gameplay) y la IA lo identifica y saca los mejores momentos en clips verticales con subtítulos y título. En tutoriales y gameplay con webcam, la persona va arriba y la pantalla abajo.",
    price: `${EDITAR_PRECIOS.clips} créditos por video`,
    extra: "Se procesa en la nube · hasta 15 clips por video",
  },
  {
    href: "/editar/en-vivo",
    icon: <Radio size={20} />,
    title: "Clipeo en vivo",
    text: "Pega el link de un en vivo de YouTube, Twitch o Kick (ideal para podcast). Mientras lo ves, la IA lo transcribe en tiempo real y corta sola los mejores momentos. También puedes clipear al instante con un botón.",
    price: `${EN_VIVO_CREDITOS} créditos cada 10 minutos`,
    extra: "Clips en MP4 vertical o normal · transcripción descargable",
  },
  {
    href: "/editar/unir",
    icon: <Film size={20} />,
    title: "Unir escenas",
    text: "Junta tus videos de 8 s en una sola historia: elige cuál va primero, cuál después, mira la vista previa y descárgala en un solo MP4.",
    price: "Gratis · corre en tu computadora",
    extra: "Hasta 30 escenas · ajusta solo los tamaños distintos",
  },
];

export default function EditarPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="eyebrow">Herramientas de edición</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Editar</h1>
      <p className="mt-2 max-w-2xl text-mute">
        Deja tus videos listos para publicar en todas tus cuentas. Puedes subir un archivo o usar los videos que ya generaste en tu galería.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="group block">
            <SpotlightCard spotlightColor="rgba(34, 211, 238, 0.22)" className="flex h-full flex-col !rounded-2xl !p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand/40 bg-brand/10 text-brand-2">{t.icon}</div>
              <h2 className="mt-4 text-lg font-semibold">{t.title}</h2>
              <p className="mt-2 flex-1 text-sm text-mute">{t.text}</p>
              <p className="mt-4 text-sm font-semibold text-brand-2">{t.price}</p>
              <p className="mt-1 text-xs text-mute">{t.extra}</p>
              <span className="btn-primary mt-5 w-full">Abrir</span>
            </SpotlightCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
