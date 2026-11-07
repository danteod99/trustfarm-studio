import Link from "next/link";
import Logo from "@/app/components/Logo";
import FranjaBogolan from "@/app/components/FranjaBogolan";
import { getUser, isAdminEmail } from "@/app/lib/auth";
import { getBalance } from "@/app/lib/credits";
import { paginaVisible } from "@/app/lib/minipc";
import { CircleUserRound, CreditCard, Images, KeyRound, Lightbulb, LogOut, Menu, Settings } from "lucide-react";
import SaldoCreditos from "@/app/components/SaldoCreditos";
import CerrarMenus from "@/app/components/CerrarMenus";

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
          <Link href="/granjas" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
            Granjas
          </Link>
          {user ? (
            <>
              {/* Resaltado en azul claro: es la sección principal. */}
              <Link
                href="/estudio"
                className="hidden rounded-lg border border-neutral-100/40 bg-neutral-100/15 px-3 py-1.5 font-semibold text-neutral-200 shadow-[0_0_12px_rgba(255,255,255,0.25)] transition hover:bg-neutral-100/25 hover:text-neutral-200 lg:block"
              >
                Estudio
              </Link>
              <Link href="/galeria" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                Galería
              </Link>
              <Link href="/flujos" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                Flujos
              </Link>
              <Link href="/editar" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                Editar
              </Link>
              <Link href="/granja" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                Modo Granja
              </Link>
              <Link href="/cajas" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-mute hover:text-ink sm:block">
                Mis cajas
              </Link>
              {minipcVisible && (
                <Link href="/minipc" className="hidden whitespace-nowrap rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                  Mini PC
                </Link>
              )}
              {isAdminEmail(user.email) && (
                <Link href="/admin" className="hidden rounded-lg px-3 py-2 text-mute hover:text-ink lg:block">
                  Admin
                </Link>
              )}
              <SaldoCreditos inicial={balance} />
              <details data-menu className="relative">
                <summary aria-label="Mi cuenta" className="flex cursor-pointer list-none items-center rounded-lg p-2 text-mute hover:text-ink [&::-webkit-details-marker]:hidden">
                  <CircleUserRound size={20} />
                </summary>
                <div className="absolute right-0 top-full mt-2 flex w-60 flex-col rounded-xl border border-line bg-panel p-1.5 shadow-xl">
                  <p className="truncate px-3 py-2 text-xs text-mute">{user.email}</p>
                  {[
                    { href: "/cuenta", label: "Mi cuenta", Icono: Settings },
                    { href: "/galeria", label: "Mis creaciones", Icono: Images },
                    { href: "/cuenta#pagos", label: "Métodos de pago", Icono: CreditCard },
                    { href: "/desarrolladores", label: "API y claves", Icono: KeyRound },
                  ].map(({ href, label, Icono }) => (
                    <Link key={href} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-mute hover:bg-panel-2 hover:text-ink">
                      <Icono size={15} /> {label}
                    </Link>
                  ))}
                  <form action="/auth/salir" method="post" className="mt-1 border-t border-line pt-1">
                    <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-mute hover:bg-panel-2 hover:text-ink">
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </form>
                </div>
              </details>
              {/* Debajo de lg los links secundarios van en un menú desplegable. */}
              <details data-menu className="relative lg:hidden">
                <summary aria-label="Menú" className="flex cursor-pointer list-none items-center rounded-lg p-2 text-mute hover:text-ink [&::-webkit-details-marker]:hidden">
                  <Menu size={18} />
                </summary>
                <div className="absolute right-0 top-full mt-2 flex w-48 flex-col rounded-xl border border-line bg-panel p-1.5 shadow-xl">
                  {[
                    ["/estudio", "Estudio"],
                    ["/galeria", "Galería"],
                    ["/flujos", "Flujos"],
                    ["/editar", "Editar"],
                    ["/granja", "Modo Granja"],
                    ["/cajas", "Mis cajas"],
                    ["/granjas", "Granjas"],
                    ...(minipcVisible ? [["/minipc", "Mini PC"]] : []),
                    ...(isAdminEmail(user.email) ? [["/admin", "Admin"]] : []),
                  ].map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      className={
                        href === "/estudio"
                          ? "rounded-lg bg-neutral-100/15 px-3 py-2 font-semibold text-neutral-200 hover:bg-neutral-100/25"
                          : "rounded-lg px-3 py-2 text-mute hover:bg-panel-2 hover:text-ink"
                      }
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
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
              <Link
                href="/entrar?modo=registro"
                aria-label="Crear cuenta"
                className="shrink-0 transition hover:scale-105 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/boton-crear-cuenta.png" alt="Crear cuenta" style={{ height: 46, width: "auto" }} />
              </Link>
            </>
          )}
        </nav>
      </div>
      <FranjaBogolan alto={10} className="!opacity-50" />
      {user && <CerrarMenus />}
    </header>
  );
}
