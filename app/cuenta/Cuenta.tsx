"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Coins, CreditCard, Film, Image as ImageIcon, KeyRound, Loader2, LogOut, Receipt, Trash2, UserRound, Users } from "lucide-react";
import { BRAND } from "@/app/lib/brand";
import { createBrowserSupabase } from "@/app/lib/supabase/browser";

interface Tarjeta {
  id: string;
  marca: string;
  ultimos4: string;
  vence: string;
  principal: boolean;
}

interface Props {
  email: string;
  desde: string;
  conGoogle: boolean;
  conClave: boolean;
  saldo: number;
  plan: { periodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  conteo: { imagenes: number; videos: number; personajes: number };
}

const MARCA: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express", diners: "Diners Club", discover: "Discover", jcb: "JCB", unionpay: "UnionPay" };

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" }) : "");

function Seccion({ id, titulo, icono, children }: { id?: string; titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        {icono} {titulo}
      </h2>
      {children}
    </section>
  );
}

export default function Cuenta({ email, desde, conGoogle, conClave, saldo, plan, conteo }: Props) {
  const params = useSearchParams();
  const [tarjetas, setTarjetas] = useState<Tarjeta[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(params.get("tarjeta") === "ok" ? "Tarjeta agregada." : null);
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [claveMsg, setClaveMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargarTarjetas = useCallback(async () => {
    const r = await fetch("/api/cuenta/tarjetas", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setTarjetas(d.tarjetas);
    else {
      setTarjetas([]);
      setError(d.error || "No se pudieron cargar tus tarjetas.");
    }
  }, []);

  useEffect(() => {
    void cargarTarjetas();
  }, [cargarTarjetas]);

  /** Llama a una ruta que devuelve { url } de Stripe y abre esa página. */
  async function irAStripe(ruta: string, clave: string, body?: object) {
    setOcupado(clave);
    setError(null);
    const r = await fetch(ruta, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const d = await r.json().catch(() => ({}));
    if (d.url) window.location.href = d.url;
    else {
      setError(d.error || "No se pudo continuar.");
      setOcupado(null);
    }
  }

  async function tarjeta(id: string, metodo: "PATCH" | "DELETE") {
    if (metodo === "DELETE" && !window.confirm("¿Quitar esta tarjeta de tu cuenta?")) return;
    setOcupado(id + metodo);
    setError(null);
    setAviso(null);
    const r = await fetch(`/api/cuenta/tarjetas/${id}`, { method: metodo });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || "No se pudo actualizar la tarjeta.");
    else setAviso(metodo === "DELETE" ? "Tarjeta quitada." : "Tarjeta principal actualizada.");
    await cargarTarjetas();
    setOcupado(null);
  }

  async function cambiarClave(e: React.FormEvent) {
    e.preventDefault();
    setClaveMsg(null);
    if (clave.length < 8) return setClaveMsg({ ok: false, texto: "Usa al menos 8 caracteres." });
    if (clave !== clave2) return setClaveMsg({ ok: false, texto: "Las contraseñas no coinciden." });
    setOcupado("clave");
    const { error } = await createBrowserSupabase().auth.updateUser({ password: clave });
    setOcupado(null);
    if (error) setClaveMsg({ ok: false, texto: /reauth|recent/i.test(error.message) ? "Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo." : error.message });
    else {
      setClave("");
      setClave2("");
      setClaveMsg({ ok: true, texto: "Contraseña guardada." });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-black">Mi cuenta</h1>
      <p className="mt-1 text-sm text-mute">{email}</p>

      {(error || aviso) && (
        <p className={`mt-4 rounded-lg border px-4 py-3 text-sm ${error ? "border-rosa/40 text-error" : "border-turquesa/40 text-ok"}`}>
          {error || aviso}
        </p>
      )}

      <div className="mt-6 grid gap-5">
        <Seccion titulo="Perfil" icono={<UserRound size={18} className="text-brand-2" />}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-mute">Correo</dt>
              <dd className="break-all">{email}</dd>
            </div>
            <div>
              <dt className="text-mute">Cliente desde</dt>
              <dd>{fecha(desde)}</dd>
            </div>
            <div>
              <dt className="text-mute">Cómo entras</dt>
              <dd>{[conGoogle && "Google", conClave && "Correo y contraseña"].filter(Boolean).join(" · ") || "Correo"}</dd>
            </div>
          </dl>

          <form onSubmit={cambiarClave} className="mt-6 border-t border-line pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound size={15} /> {conClave ? "Cambiar contraseña" : "Crear contraseña"}
            </h3>
            {!conClave && <p className="mt-1 text-xs text-mute">Así también podrás entrar con tu correo, sin Google.</p>}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={clave} onChange={(e) => setClave(e.target.value)} className="input" />
              <input type="password" autoComplete="new-password" placeholder="Repite la contraseña" value={clave2} onChange={(e) => setClave2(e.target.value)} className="input" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={ocupado === "clave" || !clave} className="btn-ghost">
                {ocupado === "clave" ? <Loader2 size={15} className="animate-spin" /> : null} Guardar contraseña
              </button>
              {claveMsg && <span className={`text-sm ${claveMsg.ok ? "text-ok" : "text-error"}`}>{claveMsg.texto}</span>}
            </div>
          </form>
        </Seccion>

        <Seccion titulo="Créditos y plan" icono={<Coins size={18} className="text-brand-2" />}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-3xl font-extrabold">{saldo.toLocaleString("es")}</p>
              <p className="text-sm text-mute">créditos disponibles</p>
            </div>
            <Link href="/creditos" className="btn-primary">
              Comprar créditos
            </Link>
          </div>
          <p className="mt-4 text-sm text-mute">
            {plan
              ? plan.cancelAtPeriodEnd
                ? `Plan mensual activo hasta el ${fecha(plan.periodEnd)} (no se renovará).`
                : `Plan mensual activo. Se renueva el ${fecha(plan.periodEnd)}.`
              : "No tienes plan mensual."}{" "}
            <Link href="/creditos" className="text-brand-2 hover:underline">
              Ver movimientos y planes
            </Link>
          </p>
        </Seccion>

        <Seccion id="pagos" titulo="Métodos de pago" icono={<CreditCard size={18} className="text-brand-2" />}>
          {tarjetas === null ? (
            <p className="text-sm text-mute">Cargando…</p>
          ) : !tarjetas.length ? (
            <p className="text-sm text-mute">No tienes tarjetas guardadas. Agrega una para pagar más rápido tus créditos y tu plan.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {tarjetas.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {MARCA[t.marca] ?? t.marca} •••• {t.ultimos4}
                      {t.principal && <span className="chip chip-on ml-2 !py-0.5 text-xs">Principal</span>}
                    </p>
                    <p className="text-xs text-mute">Vence {t.vence}</p>
                  </div>
                  <div className="flex gap-2">
                    {!t.principal && (
                      <button onClick={() => tarjeta(t.id, "PATCH")} disabled={!!ocupado} className="btn-ghost !px-3 !py-1.5 text-xs">
                        {ocupado === t.id + "PATCH" ? <Loader2 size={13} className="animate-spin" /> : null} Usar como principal
                      </button>
                    )}
                    <button onClick={() => tarjeta(t.id, "DELETE")} disabled={!!ocupado} aria-label="Quitar tarjeta" className="btn-ghost !px-3 !py-1.5 text-xs">
                      {ocupado === t.id + "DELETE" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Quitar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={() => irAStripe("/api/cuenta/tarjetas", "agregar")} disabled={!!ocupado} className="btn-primary">
              {ocupado === "agregar" ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} Agregar tarjeta
            </button>
            <button onClick={() => irAStripe("/api/suscripcion/portal", "portal", { desde: "cuenta" })} disabled={!!ocupado} className="btn-ghost">
              {ocupado === "portal" ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />} Facturas y recibos
            </button>
          </div>
          <p className="mt-3 text-xs text-mute">Los datos de tu tarjeta los guarda Stripe; nosotros nunca vemos el número completo.</p>
        </Seccion>

        <Seccion titulo="Lo que has creado" icono={<ImageIcon size={18} className="text-brand-2" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { href: "/galeria", n: conteo.imagenes, label: "Imágenes", icono: <ImageIcon size={16} /> },
              { href: "/galeria", n: conteo.videos, label: "Videos", icono: <Film size={16} /> },
              { href: "/estudio", n: conteo.personajes, label: "Personajes y estilos", icono: <Users size={16} /> },
            ].map((c) => (
              <Link key={c.label} href={c.href} className="rounded-xl border border-line p-4 hover:border-brand">
                <p className="flex items-center gap-2 text-sm text-mute">
                  {c.icono} {c.label}
                </p>
                <p className="mt-1 text-2xl font-bold">{c.n.toLocaleString("es")}</p>
              </Link>
            ))}
          </div>
          <Link href="/galeria" className="mt-4 inline-block text-sm text-brand-2 hover:underline">
            Abrir mi galería →
          </Link>
        </Seccion>

        <Seccion id="api" titulo="API" icono={<KeyRound size={18} className="text-brand-2" />}>
          <p className="text-sm text-mute">
            Usa Trust Studio desde tu propio código: genera imágenes y videos, consulta tu saldo y lanza flujos con una clave de API. Cada llamada descuenta de tus créditos.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/desarrolladores" className="btn-primary">
              <KeyRound size={15} /> Crear y gestionar claves de API
            </Link>
          </div>
        </Seccion>

        <Seccion titulo="Sesión" icono={<LogOut size={18} className="text-brand-2" />}>
          <div className="flex flex-wrap gap-3">
            <form action="/auth/salir" method="post">
              <button type="submit" className="btn-primary">
                <LogOut size={15} /> Cerrar sesión
              </button>
            </form>
            <form action="/auth/salir" method="post">
              <input type="hidden" name="todas" value="1" />
              <button type="submit" className="btn-ghost">
                Cerrar sesión en todos mis dispositivos
              </button>
            </form>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-mute">
            <CheckCircle2 size={13} /> ¿Quieres borrar tu cuenta y todo lo que creaste? Escríbenos a{" "}
            <a href={`mailto:${BRAND.supportEmail}`} className="text-brand-2 hover:underline">
              {BRAND.supportEmail}
            </a>
          </p>
        </Seccion>
      </div>
    </div>
  );
}
