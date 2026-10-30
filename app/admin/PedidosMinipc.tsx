"use client";

import { useEffect, useRef, useState } from "react";
import type { PedidoVista } from "@/app/lib/minipc-admin";
import type { EstadoPedido } from "@/app/lib/minipc-pedidos";
// Reutiliza la tabla de transiciones del servidor: solo se muestran acciones válidas.
import { validarCambioEstado } from "@/app/lib/minipc-pedidos";

const ETIQUETA: Record<EstadoPedido, string> = {
  pagado: "Pagado",
  revisar: "Revisar",
  enviado: "Enviado",
  entregado: "Entregado",
  reembolsado: "Reembolsado",
  cancelado: "Cancelado",
};

const COLOR: Record<EstadoPedido, string> = {
  pagado: "bg-sky-500/15 text-sky-300",
  revisar: "bg-red-500/15 text-red-400",
  enviado: "bg-amber-500/15 text-amber-300",
  entregado: "bg-emerald-500/15 text-emerald-300",
  reembolsado: "bg-zinc-500/20 text-zinc-300",
  cancelado: "bg-zinc-500/20 text-zinc-400",
};

type Accion = "enviado" | "entregado" | "cancelado" | "reembolsado";
const ACCIONES: { estado: Accion; texto: string }[] = [
  { estado: "enviado", texto: "Marcar enviado" },
  { estado: "entregado", texto: "Marcar entregado" },
  { estado: "cancelado", texto: "Cancelar" },
  { estado: "reembolsado", texto: "Reembolsado" },
];

async function leerError(r: Response): Promise<string> {
  try {
    const d = await r.json();
    if (d && typeof d.error === "string") return d.error;
  } catch {
    /* respuesta que no es JSON */
  }
  return `Algo salió mal (${r.status}).`;
}

export default function PedidosMinipc() {
  const [pedidos, setPedidos] = useState<PedidoVista[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [pagina, setPagina] = useState(0); // siguiente página por pedir
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inicial, setInicial] = useState(true);
  const enCurso = useRef(false);

  const [confirmando, setConfirmando] = useState<{ id: string; estado: Accion } | null>(null);
  const [seguimientos, setSeguimientos] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [errorFila, setErrorFila] = useState<{ id: string; msg: string } | null>(null);

  async function cargar(p: number) {
    if (enCurso.current) return;
    enCurso.current = true;
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/pedidos-minipc?pagina=${p}`, { cache: "no-store" });
      if (!r.ok) {
        setError(await leerError(r));
        return;
      }
      const d: { pedidos: PedidoVista[]; hay_mas: boolean } = await r.json();
      setPedidos((prev) => {
        const vistos = new Set(prev.map((x) => x.id));
        return [...prev, ...d.pedidos.filter((x) => !vistos.has(x.id))];
      });
      setHayMas(d.hay_mas);
      setPagina(p + 1);
    } catch {
      setError("No pude cargar los pedidos. Revisa tu conexión.");
    } finally {
      enCurso.current = false;
      setCargando(false);
      setInicial(false);
    }
  }

  useEffect(() => {
    cargar(0);
  }, []);

  async function aplicar(p: PedidoVista, estado: Accion) {
    if (guardando) return;
    setGuardando(p.id);
    setErrorFila(null);
    const seguimiento = estado === "enviado" ? (seguimientos[p.id] ?? "").trim() : undefined;
    try {
      const r = await fetch(`/api/admin/pedidos-minipc/${encodeURIComponent(p.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seguimiento ? { estado, seguimiento } : { estado }),
      });
      if (!r.ok) {
        setErrorFila({ id: p.id, msg: await leerError(r) });
        return;
      }
      setPedidos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, estado, seguimiento: seguimiento ? seguimiento : x.seguimiento } : x)),
      );
      setConfirmando(null);
    } catch {
      setErrorFila({ id: p.id, msg: "No pude actualizar el pedido. Revisa tu conexión." });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold">Pedidos de la mini PC</h2>
      <p className="mt-1 text-sm text-mute">Los pedidos en rojo (Revisar) llegaron con datos que no cuadran: míralos antes de enviar.</p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {inicial && cargando && <p className="mt-3 text-sm text-mute">Cargando…</p>}
      {!inicial && !error && pedidos.length === 0 && <p className="mt-3 text-sm text-mute">Todavía no hay pedidos.</p>}

      <ul className="mt-4 space-y-3">
        {pedidos.map((p) => {
          const acciones = ACCIONES.filter((a) => validarCambioEstado(p.estado, a.estado));
          const confirma = confirmando?.id === p.id ? confirmando.estado : null;
          const ocupado = guardando === p.id;
          return (
            <li key={p.id} className={`rounded-xl border p-4 text-sm ${p.estado === "revisar" ? "border-red-500/50" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR[p.estado]}`}>{ETIQUETA[p.estado]}</span>
                <span className="font-medium">{p.plan_id ?? "Plan desconocido"}</span>
                <span className="font-semibold">
                  US$ {p.monto_usd.toFixed(2)}
                  {p.moneda && p.moneda.toLowerCase() !== "usd" ? ` (${p.moneda.toUpperCase()})` : ""}
                </span>
                <span className="text-mute">{new Date(p.creado).toLocaleString("es")}</span>
              </div>

              {p.estado === "revisar" && (
                <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-red-300">Motivo: {p.nota_revision || "sin detalle"}</p>
              )}

              <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <div><dt className="inline text-mute">Nombre: </dt><dd className="inline">{p.nombre || "—"}</dd></div>
                <div><dt className="inline text-mute">Teléfono: </dt><dd className="inline">{p.telefono || "—"}</dd></div>
                <div><dt className="inline text-mute">Dirección: </dt><dd className="inline">{p.direccion || "—"}</dd></div>
                <div><dt className="inline text-mute">Email: </dt><dd className="inline break-all">{p.email || "—"}</dd></div>
                <div>
                  <dt className="inline text-mute">Ciudad / región / país: </dt>
                  <dd className="inline">{[p.ciudad, p.region, p.pais].filter(Boolean).join(" / ") || "—"}</dd>
                </div>
                {p.seguimiento && (
                  <div><dt className="inline text-mute">Seguimiento: </dt><dd className="inline break-all">{p.seguimiento}</dd></div>
                )}
                {p.stripe_payment_intent && (
                  <div className="sm:col-span-2">
                    <dt className="inline text-mute">Pago en Stripe: </dt>
                    <dd className="inline break-all">{p.stripe_payment_intent}</dd>
                  </div>
                )}
              </dl>

              {acciones.length > 0 && !confirma && (
                <div className="mt-3 space-y-2">
                  {validarCambioEstado(p.estado, "enviado") && (
                    <input
                      className="input"
                      maxLength={120}
                      placeholder="Seguimiento (opcional, para Marcar enviado)"
                      value={seguimientos[p.id] ?? ""}
                      onChange={(e) => setSeguimientos((s) => ({ ...s, [p.id]: e.target.value }))}
                    />
                  )}
                  <div className="flex flex-wrap gap-2">
                    {acciones.map((a) => (
                      <button
                        key={a.estado}
                        type="button"
                        className="btn-ghost"
                        disabled={guardando !== null}
                        onClick={() => {
                          setErrorFila(null);
                          setConfirmando({ id: p.id, estado: a.estado });
                        }}
                      >
                        {a.texto}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {confirma && (
                <div className="mt-3 rounded-lg border border-line p-3">
                  <p>
                    ¿Seguro que quieres pasar este pedido a «{ETIQUETA[confirma]}»?
                    {confirma === "reembolsado" && " El dinero se devuelve a mano en Stripe."}
                    {confirma === "cancelado" && " No devuelve el dinero. Es final y sin retorno; para devolverlo usa Reembolsado."}
                    {confirma === "reembolsado" && " No se puede deshacer."}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-primary" disabled={ocupado} onClick={() => aplicar(p, confirma)}>
                      {ocupado ? "Guardando…" : "Sí, confirmar"}
                    </button>
                    <button type="button" className="btn-ghost" disabled={ocupado} onClick={() => setConfirmando(null)}>
                      No
                    </button>
                  </div>
                </div>
              )}

              {errorFila?.id === p.id && <p className="mt-2 text-red-400">{errorFila.msg}</p>}
            </li>
          );
        })}
      </ul>

      {hayMas && (
        <button type="button" className="btn-ghost mt-4" disabled={cargando} onClick={() => cargar(pagina)}>
          {cargando ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </section>
  );
}
