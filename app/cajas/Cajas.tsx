"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Caja {
  id: string;
  nombre: string;
  direccion: string;
  estado: "encendida" | "apagada";
  ultima_senal: string | null;
  ia_creditos_hoy?: number;
  ia_creditos_mes?: number;
}

const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const REFRESCO_MS = 30_000;
const SALDO_BAJO = 20;
const ERR_RED = "No se pudo conectar. Revisa tu internet e inténtalo de nuevo.";

function haceCuanto(iso: string | null): string {
  if (!iso) return "sin señal todavía";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "sin señal todavía";
  const min = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (min < 1) return "vista hace un momento";
  if (min < 60) return `vista hace ${min} ${min === 1 ? "minuto" : "minutos"}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vista hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  return `vista hace ${d} ${d === 1 ? "día" : "días"}`;
}

async function errorDe(r: Response, defecto: string): Promise<string> {
  try {
    const d = await r.json();
    return typeof d?.error === "string" ? d.error : defecto;
  } catch {
    return defecto;
  }
}

function TarjetaCaja({ caja, alCambiar }: { caja: Caja; alCambiar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(caja.nombre);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encendida = caja.estado === "encendida";

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    const limpio = nombre.trim();
    if (limpio.length < 1 || limpio.length > 60) {
      setError("El nombre debe tener entre 1 y 60 caracteres.");
      return;
    }
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(`/api/cajas/${caja.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: limpio }),
      });
      if (!r.ok) setError(await errorDe(r, "No se pudo renombrar la caja."));
      else {
        setEditando(false);
        alCambiar();
      }
    } catch {
      setError(ERR_RED);
    }
    setOcupado(false);
  }

  async function abrir() {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(`/api/cajas/${caja.id}/abrir`, { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        if (typeof d?.url === "string") {
          window.location.assign(d.url);
          return; // queda deshabilitado mientras navega
        }
        setError("No se pudo abrir la caja. Inténtalo de nuevo.");
      } else setError(await errorDe(r, "No se pudo abrir la caja."));
    } catch {
      setError(ERR_RED);
    }
    setOcupado(false);
  }

  async function quitar() {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      const r = await fetch(`/api/cajas/${caja.id}`, { method: "DELETE" });
      if (!r.ok) {
        setError(await errorDe(r, "No se pudo quitar la caja."));
        setOcupado(false);
        return;
      }
      alCambiar();
    } catch {
      setError(ERR_RED);
      setOcupado(false);
    }
  }

  return (
    <li className="card p-4">
      {editando ? (
        <form onSubmit={guardar} className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor={`n-${caja.id}`}>
            Nombre de la caja
          </label>
          <input id={`n-${caja.id}`} className="input" maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          <div className="flex gap-2">
            <button className={`btn-primary !py-2 ${FOCO}`} disabled={ocupado}>
              Guardar
            </button>
            <button
              type="button"
              className={`btn-ghost !py-2 ${FOCO}`}
              disabled={ocupado}
              onClick={() => {
                setEditando(false);
                setNombre(caja.nombre);
                setError(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words font-semibold">{caja.nombre}</h2>
            <p className="break-all text-xs text-mute">{caja.direccion}</p>
          </div>
          <button className={`rounded-lg px-2 py-1 text-xs text-mute hover:text-ink ${FOCO}`} onClick={() => setEditando(true)}>
            Renombrar
          </button>
        </div>
      )}

      <p className="mt-3 flex items-center gap-2 text-sm">
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${encendida ? "bg-ok" : "bg-rosa"}`} />
        {encendida ? <span className="text-ok">Encendida</span> : <span className="text-mute">Apagada · {haceCuanto(caja.ultima_senal)}</span>}
      </p>

      {confirmando ? (
        <div role="alertdialog" aria-label="Confirmar quitar caja" className="mt-4 rounded-xl border border-line bg-panel-2 p-3 text-sm">
          <p>¿Quitar «{caja.nombre}» de tu cuenta?</p>
          <p className="mt-1 text-mute">Tu caja volverá a pedir un código nuevo en su pantalla. No pierde sus datos.</p>
          <div className="mt-3 flex gap-2">
            <button className={`btn-primary !bg-terracota !py-2 !text-hueso hover:!bg-terracota/85 ${FOCO}`} disabled={ocupado} onClick={quitar}>
              {ocupado ? "Quitando…" : "Sí, quitar"}
            </button>
            <button className={`btn-ghost !py-2 ${FOCO}`} disabled={ocupado} onClick={() => setConfirmando(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button className={`btn-primary flex-1 !py-2 sm:flex-none ${FOCO}`} disabled={!encendida || ocupado} onClick={abrir}>
            {ocupado ? "Abriendo…" : "Abrir"}
          </button>
          <button className={`btn-ghost !py-2 ${FOCO}`} disabled={ocupado} onClick={() => setConfirmando(true)}>
            Quitar
          </button>
        </div>
      )}
      {!encendida && !confirmando && <p className="mt-2 text-xs text-mute">Enciende tu caja para poder abrirla.</p>}
      {typeof caja.ia_creditos_mes === "number" && (
        <p className="mt-2 text-xs text-mute">IA: {caja.ia_creditos_hoy ?? 0} créditos hoy · {caja.ia_creditos_mes} este mes</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}
    </li>
  );
}

export default function Cajas() {
  const [cajas, setCajas] = useState<Caja[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [errorVincular, setErrorVincular] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [delQr, setDelQr] = useState<string | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const enVuelo = useRef(false);

  const cargar = useCallback(async () => {
    if (enVuelo.current) return;
    enVuelo.current = true;
    try {
      const r = await fetch("/api/cajas", { cache: "no-store" });
      if (!r.ok) {
        setErrorLista(await errorDe(r, "No se pudieron leer tus cajas."));
      } else {
        const d = await r.json();
        setCajas(Array.isArray(d?.cajas) ? d.cajas : []);
        setSaldo(typeof d?.saldo === "number" ? d.saldo : null);
        setRestantes(typeof d?.ia_respuestas_restantes === "number" ? d.ia_respuestas_restantes : null);
        setErrorLista(null);
      }
    } catch {
      setErrorLista(ERR_RED);
    }
    enVuelo.current = false;
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") cargar();
    }, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  async function enviarCodigo(valor: string) {
    setVinculando(true);
    setErrorVincular(null);
    setExito(false);
    try {
      const r = await fetch("/api/cajas/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: valor }),
      });
      if (!r.ok) setErrorVincular(await errorDe(r, "No se pudo vincular la caja. Inténtalo de nuevo."));
      else {
        setCodigo("");
        setExito(true);
        await cargar();
      }
    } catch {
      setErrorVincular(ERR_RED);
    }
    setVinculando(false);
  }

  function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!vinculando) void enviarCodigo(codigo);
  }

  // El QR de la mini PC trae /cajas?codigo=XXXX-XXXX. NUNCA vincula solo: un enlace recibido por mensaje podría unir tu caja
  // a la mini PC de otra persona. Se pregunta y se confirma mirando la pantalla de la propia mini PC.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("codigo");
    if (!c) return;
    window.history.replaceState(null, "", "/cajas");
    setCodigo(c);
    setDelQr(c);
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-black">Mis cajas</h1>

      {saldo !== null && (
        <section className={`card p-4 text-sm ${saldo < SALDO_BAJO ? "border-amber-400" : ""}`}>
          <p>
            Tu saldo: <b>{saldo} créditos</b>
            {restantes !== null && <span className="text-mute"> · te alcanza para unas {restantes} respuestas de tu vendedor</span>}
          </p>
          {saldo < SALDO_BAJO && (
            <p className="mt-1 text-amber-400">
              Te quedan pocos créditos. Sin saldo, tu vendedor deja de responder con IA.{" "}
              <a className="underline" href="/creditos">Recargar</a>
            </p>
          )}
          <p className="mt-1 text-xs text-mute">El vendedor funciona con inteligencia artificial y puede equivocarse: revisa lo importante.</p>
        </section>
      )}

      {delQr && !exito && (
        <section className="card border-brand p-5">
          <h2 className="font-semibold">¿Vincular esta mini PC a tu cuenta?</h2>
          <p className="mt-1 text-sm text-mute">Confirma solo si tienes tu mini PC enfrente y su pantalla muestra este código. Si te llegó un enlace por mensaje, no lo confirmes.</p>
          <p className="mt-3 font-mono text-2xl font-bold tracking-wider">{delQr.toUpperCase()}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={`btn-primary ${FOCO}`} disabled={vinculando} onClick={() => void enviarCodigo(delQr)}>
              {vinculando ? "Vinculando…" : "Sí, es mi mini PC"}
            </button>
            <button className={`btn-ghost ${FOCO}`} disabled={vinculando} onClick={() => { setDelQr(null); setCodigo(""); setErrorVincular(null); }}>
              Cancelar
            </button>
          </div>
          {errorVincular && (
            <p role="alert" className="mt-3 text-sm text-error">
              {errorVincular}
            </p>
          )}
        </section>
      )}

      {cajas === null && !errorLista && (
        <p className="text-sm text-mute" role="status">
          Cargando tus cajas…
        </p>
      )}

      {errorLista && (
        <div className="card p-4 text-sm" role="alert">
          <p className="text-error">{errorLista}</p>
          <button className={`btn-ghost mt-3 !py-2 ${FOCO}`} onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}

      {cajas !== null && cajas.length === 0 && !errorLista && (
        <div className="card p-5 text-sm">
          <p className="font-semibold">Todavía no tienes cajas vinculadas.</p>
          <p className="mt-1 text-mute">Enciende tu mini PC con una pantalla conectada, escribe en ella tu correo de Google y escanea el QR que aparece.</p>
        </div>
      )}

      {cajas !== null && cajas.length > 0 && (
        <ul className="space-y-3">
          {cajas.map((c) => (
            <TarjetaCaja key={c.id} caja={c} alCambiar={cargar} />
          ))}
        </ul>
      )}

      <section className="card p-5">
        <h2 className="font-semibold">Agregar caja</h2>
        <p className="mt-1 text-sm text-mute">Escribe tu correo de Google en la pantalla de tu mini PC y escanea el QR, o escribe aquí el código que aparece junto a él.</p>
        <form onSubmit={vincular} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="codigo-caja" className="mb-1 block text-xs text-mute">
              Código de la caja
            </label>
            <input
              id="codigo-caja"
              className="input uppercase"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="ABCD-2345"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </div>
          <button className={`btn-primary sm:self-end ${FOCO}`} disabled={vinculando || !codigo.trim()}>
            {vinculando ? "Vinculando…" : "Vincular"}
          </button>
        </form>
        {errorVincular && !delQr && (
          <p role="alert" className="mt-3 text-sm text-error">
            {errorVincular}
          </p>
        )}
        {exito && (
          <p role="status" className="mt-3 text-sm text-ok">
            Listo: tu caja quedó vinculada.
          </p>
        )}
      </section>
    </div>
  );
}
