"use client";

import { useCallback, useEffect, useState } from "react";

interface Ticket {
  id: string;
  asunto: string;
  abierto_por: "cliente" | "soporte";
  estado: "abierto" | "en_atencion" | "cerrado";
  nivel: "app" | "sistema" | null;
  minutos: number | null;
  aceptado_en: string | null;
  vence_en: string | null;
  permiso_abierto: boolean;
  creado_en: string;
  cliente: string | null;
  caja: { id: string; slug: string | null };
}

interface CajaSimple { id: string; nombre: string; owner_id: string | null }

const NIVEL = { app: "Solo la app", sistema: "App y sistema (administrador)" } as const;

function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  if (minutos < 1440) return `${Math.round((minutos / 60) * 10) / 10} h`;
  return `${Math.round((minutos / 1440) * 10) / 10} días`;
}

function restante(venceEn: string): string {
  const ms = Date.parse(venceEn) - Date.now();
  if (ms <= 0) return "vencido";
  return duracion(Math.max(1, Math.ceil(ms / 60_000)));
}

export default function SoporteAdmin() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [cajas, setCajas] = useState<CajaSimple[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [comando, setComando] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [cajaNueva, setCajaNueva] = useState("");
  const [motivo, setMotivo] = useState("");

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/soporte", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error ?? "No se pudieron leer los tickets.");
      else {
        setTickets(d.tickets ?? []);
        setError(null);
      }
    } catch {
      setError("No se pudo conectar.");
    }
  }, []);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 30_000);
    fetch("/api/admin/cajas?pagina=0", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCajas((d.cajas ?? []).filter((c: CajaSimple) => c.owner_id)))
      .catch(() => {});
    return () => clearInterval(t);
  }, [cargar]);

  async function accion(clave: string, cuerpo: object): Promise<Record<string, unknown> | null> {
    setOcupado(clave);
    setError(null);
    try {
      const r = await fetch("/api/admin/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "No se pudo completar la acción.");
        return null;
      }
      await cargar();
      return d;
    } catch {
      setError("No se pudo conectar.");
      return null;
    } finally {
      setOcupado(null);
    }
  }

  async function entrarApp(t: Ticket) {
    const d = await accion(`entrar-${t.id}`, { accion: "entrar_app", ticket_id: t.id });
    if (d && typeof d.url === "string") window.open(d.url, "_blank", "noopener,noreferrer");
  }

  async function verComando(t: Ticket) {
    const d = await accion(`ssh-${t.id}`, { accion: "comando_ssh", ticket_id: t.id });
    if (d && typeof d.comando === "string") {
      setComando(d.comando);
      setCopiado(false);
    }
  }

  async function copiar() {
    if (!comando) return;
    try {
      await navigator.clipboard.writeText(comando);
      setCopiado(true);
    } catch {
      setError("No se pudo copiar: selecciona el comando y cópialo a mano.");
    }
  }

  async function cerrarTicket(t: Ticket) {
    const nota = window.prompt("Nota de cierre para el cliente (opcional):", "");
    if (nota === null) return;
    await accion(`cerrar-${t.id}`, { accion: "cerrar_ticket", ticket_id: t.id, nota });
  }

  async function abrirTicket(e: React.FormEvent) {
    e.preventDefault();
    const d = await accion("nuevo", { accion: "crear", caja_id: cajaNueva, asunto: motivo });
    if (d) {
      setMotivo("");
      setCajaNueva("");
    }
  }

  const porAceptar = (t: Ticket) => t.permiso_abierto && !t.aceptado_en;
  const activo = (t: Ticket) => t.permiso_abierto && Boolean(t.aceptado_en) && Boolean(t.vence_en);

  return (
    <section id="soporte" className="card p-5">
      <h2 className="font-semibold">Soporte</h2>
      <p className="mt-1 text-sm text-mute">Solo se entra a una caja con el permiso de su dueño, por el tiempo que él eligió. El tiempo empieza a correr al aceptar.</p>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      {comando && (
        <div className="mt-4 rounded-lg border border-line p-3">
          <p className="text-sm">Corre este comando en tu PC. Te pedirá la frase de paso de tu llave.</p>
          <code className="mt-2 block overflow-x-auto whitespace-nowrap text-xs">{comando}</code>
          <div className="mt-2 flex gap-2">
            <button className="btn-ghost !px-3 !py-1.5" onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
            <button className="btn-ghost !px-3 !py-1.5" onClick={() => setComando(null)}>Cerrar</button>
          </div>
        </div>
      )}

      {tickets.length === 0 && !error && <p className="mt-4 text-sm text-mute">No hay tickets abiertos.</p>}

      <ul className="mt-4 space-y-3">
        {tickets.map((t) => (
          <li key={t.id} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{t.cliente ?? "Cliente"} · {t.caja.slug ?? t.caja.id}</span>
              <span className="text-xs text-mute">
                {t.abierto_por === "soporte" ? "Abierto por soporte" : "Abierto por el cliente"} · {new Date(t.creado_en).toLocaleString("es")}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{t.asunto}</p>

            <p className="mt-2 text-sm text-mute">
              {!t.permiso_abierto && "Sin permiso del cliente."}
              {porAceptar(t) && t.nivel && t.minutos && `Permiso por aceptar: ${NIVEL[t.nivel]}, ${duracion(t.minutos)}.`}
              {activo(t) && t.nivel && t.vence_en && `Acceso activo: ${NIVEL[t.nivel]}, queda ${restante(t.vence_en)}.`}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {porAceptar(t) && (
                <button className="btn-primary !px-3 !py-1.5" disabled={ocupado !== null} onClick={() => accion(`aceptar-${t.id}`, { accion: "aceptar", ticket_id: t.id })}>
                  Aceptar
                </button>
              )}
              {activo(t) && (
                <button className="btn-ghost !px-3 !py-1.5" disabled={ocupado !== null} onClick={() => entrarApp(t)}>Entrar a la app</button>
              )}
              {activo(t) && t.nivel === "sistema" && (
                <button className="btn-ghost !px-3 !py-1.5" disabled={ocupado !== null} onClick={() => verComando(t)}>Ver comando SSH</button>
              )}
              {t.permiso_abierto && (
                <button className="btn-ghost !px-3 !py-1.5" disabled={ocupado !== null} onClick={() => accion(`acceso-${t.id}`, { accion: "cerrar_acceso", ticket_id: t.id })}>
                  Cerrar acceso
                </button>
              )}
              <button className="btn-ghost !px-3 !py-1.5" disabled={ocupado !== null} onClick={() => cerrarTicket(t)}>Cerrar ticket</button>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={abrirTicket} className="mt-5 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
        <select className="input" required value={cajaNueva} onChange={(e) => setCajaNueva(e.target.value)}>
          <option value="">Elige una caja</option>
          {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input className="input" required maxLength={2000} placeholder="Motivo: el cliente lo verá" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <button className="btn-ghost" disabled={ocupado !== null}>Abrir ticket</button>
      </form>
    </section>
  );
}
