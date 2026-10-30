import Link from "next/link";
import { BRAND } from "@/app/lib/brand";
import { paginaVisible } from "@/app/lib/minipc";

export default function Footer() {
  const minipcVisible = paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: process.env.NEXT_PUBLIC_MINIPC_VISIBLE });
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-mute sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {BRAND.legalEntity}. Todos los derechos reservados.
        </p>
        <div className="flex flex-wrap gap-4">
          {minipcVisible && <Link href="/minipc" className="hover:text-ink">Mini PC</Link>}
          <Link href="/terminos" className="hover:text-ink">Términos</Link>
          <Link href="/privacidad" className="hover:text-ink">Privacidad</Link>
          <Link href="/reembolsos" className="hover:text-ink">Reembolsos</Link>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-ink">{BRAND.supportEmail}</a>
        </div>
      </div>
    </footer>
  );
}
