"use client";

import { SKOOL_COMUNIDAD_URL, eventoComunidad } from "@/app/lib/comunidad";

export default function BotonUnirme({ className }: { className: string }) {
  return (
    <a
      href={SKOOL_COMUNIDAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => eventoComunidad("InitiateCheckout")}
    >
      Unirme a la comunidad
    </a>
  );
}
