import Image from "next/image";
import type { Showcase } from "@/app/lib/showcase";

/** Muestra un ejemplo de la portada: video en bucle (mudo) o imagen optimizada. */
export default function Media({ item, className = "", priority = false }: { item: Showcase; className?: string; priority?: boolean }) {
  if (item.video) {
    return (
      <video
        src={item.video}
        poster={item.src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={item.alt}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  return (
    <Image
      src={item.src}
      alt={item.alt}
      fill
      priority={priority}
      sizes="(max-width: 768px) 90vw, 400px"
      className={`object-cover ${className}`}
    />
  );
}
