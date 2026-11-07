"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GenerationCard from "@/app/components/GenerationCard";
import { useGenerations } from "@/app/components/useGenerations";

const FILTERS = [
  { id: "", label: "Todo" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Imágenes" },
];

export default function Gallery() {
  const router = useRouter();
  const [kind, setKind] = useState("");
  const { items, loading } = useGenerations(`?limit=60${kind ? `&kind=${kind}` : ""}`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Galería</h1>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setKind(f.id)} className={`chip ${kind === f.id ? "chip-on" : ""}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-6 text-sm text-mute">Descarga tus archivos: los enlaces se renuevan cada vez que abres la galería.</p>
      {loading && !items.length ? (
        <p className="text-mute">Cargando…</p>
      ) : !items.length ? (
        <div className="card p-12 text-center text-mute">
          Aún no has generado nada.{" "}
          <Link href="/estudio" className="text-brand-2 hover:underline">
            Ir al estudio
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((g) => (
            <GenerationCard
              key={g.id}
              g={g}
              onAnimate={(x) => router.push(`/estudio?animar=${x.id}`)}
              onSaveCharacter={(x) => router.push(`/estudio?personaje=${x.id}`)}
              onContinue={(x) => router.push(`/estudio?continuar=${x.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
