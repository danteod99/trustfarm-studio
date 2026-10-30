import Link from "next/link";
import { BRAND } from "@/app/lib/brand";

/**
 * Logo TRUST — el mismo wordmark de trustmind.online (Michroma ≈ Eurostile Extended, con trazo
 * para engrosarlo, en currentColor) + "Studio" para distinguir el producto.
 */
export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <Link href="/" aria-label={BRAND.name} className="flex items-baseline gap-2 text-ink">
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-michroma), 'Eurostile', 'Orbitron', sans-serif",
          fontSize: size,
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1,
          WebkitTextStroke: `${Math.max(0.3, size * 0.022)}px currentColor`,
          whiteSpace: "nowrap",
        }}
      >
        TRUST
      </span>
      <span className="text-sm font-semibold tracking-wide text-brand-2">Studio</span>
    </Link>
  );
}
