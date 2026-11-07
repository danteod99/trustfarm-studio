import Link from "next/link";
import { BRAND } from "@/app/lib/brand";

/**
 * Logo TRUST del look afro house: sol ocre + "TRUST" en Fraunces negra + "Studio" escrito a mano (Gochi Hand).
 * Más chico en celular para que la barra no se desborde.
 */
export default function Logo() {
  return (
    <Link href="/" aria-label={BRAND.name} className="flex shrink-0 items-center gap-1 text-ink sm:gap-1.5">
      <span aria-hidden className="block h-2.5 w-2.5 shrink-0 rounded-full bg-ocre shadow-[0_0_14px_2px_color-mix(in_srgb,var(--color-ocre)_45%,transparent)] sm:h-3 sm:w-3" />
      <span aria-hidden className="whitespace-nowrap font-display text-[17px] font-black leading-none tracking-[0.06em] sm:text-[22px]">
        TRUST
      </span>
      <span aria-hidden className="mano inline-block -rotate-[5deg] whitespace-nowrap text-[16px] leading-none text-ocre sm:text-[20px]">
        Studio
      </span>
    </Link>
  );
}
