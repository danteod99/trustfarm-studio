import Link from "next/link";
import Logo from "@/app/components/Logo";
import { getUser, isAdminEmail } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";
import { paginaVisible } from "@/app/lib/minipc";
import { Coins, Lightbulb } from "lucide-react";

export default async function Header() {
  const user = await getUser();
  const balance = user ? await getBalance(user.id) : 0;
  const minipcVisible = paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: process.env.NEXT_PUBLIC_MINIPC_VISIBLE });
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/ideas" aria-label="Ideas" className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-mute hover:text-ink sm:px-3">
            <Lightbulb size={15} className="text-brand-2" /> <span className="hidden sm:inline">Ideas</span>
          </Link>
          <Link href="/granjas" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink md:block">
            Granjas
          </Link>
          {user ? (
            <>
              <Link href="/estudio" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Estudio
              </Link>
              <Link href="/galeria" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Galería
              </Link>
              <Link href="/flujos" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Flujos
              </Link>
              <Link href="/editar" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Editar
              </Link>
              <Link href="/granja" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-mute hover:text-ink md:block">
                Modo Granja
              </Link>
              <Link href="/cajas" className="rounded-lg px-2 py-2 text-mute hover:text-ink sm:px-3">
                Mis cajas
              </Link>
              {minipcVisible && (
                <Link href="/minipc" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                  Mini PC
                </Link>
              )}
              {isAdminEmail(user.email) && (
                <Link href="/admin" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                  Admin
                </Link>
              )}
              <Link href="/creditos" className="btn-ghost !py-2">
                <Coins size={15} className="text-brand-2" />
                {balance} créditos
              </Link>
            </>
          ) : (
            <>
              <Link href="/#precios" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Precios
              </Link>
              {minipcVisible && (
                <Link href="/minipc" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                  Mini PC
                </Link>
              )}
              <Link href="/entrar" className="rounded-lg px-2 py-2 text-mute hover:text-ink sm:px-3">
                Entrar
              </Link>
              <Link href="/entrar?modo=registro" className="btn-primary !py-2">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
