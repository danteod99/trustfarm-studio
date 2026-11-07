import Link from "next/link";
import { BRAND } from "@/app/lib/brand";

/** Logo KARIBU 2.1 (blanco sobre transparente; el alto manda y el ancho sale solo). */
export default function Logo({ size = 18 }: { size?: number }) {
  const alto = Math.round(size * 3.1);
  return (
    <Link href="/" aria-label={BRAND.name} className="flex shrink-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/karibu-logo-sm.png" alt="Karibu 2.1" height={alto} style={{ height: alto, width: "auto" }} />
    </Link>
  );
}
