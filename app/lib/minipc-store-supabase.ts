import { supabaseAdmin } from "@/app/lib/supabase/admin";
import { errorGenerico } from "./minipc-errores.ts";
import type { Envio, EstadoPedido, NuevoPedido, PedidoFila, PedidosStore } from "./minipc-pedidos.ts";

// Almacén de pedidos de la mini PC sobre la tabla pedidos_minipc (supabase/05_pedidos_minipc.sql).
// Los errores de Supabase nunca se propagan ni se registran con su texto: pueden traer datos personales.

const TABLA = "pedidos_minipc";
const ERROR_GUARDAR = "No pude guardar el pedido.";
const ERROR_LEER = "No pude leer los pedidos.";
const ERROR_ACTUALIZAR = "No pude actualizar el pedido.";

type Fila = Record<string, unknown>;
type PatchEstado = { estado: EstadoPedido; seguimiento?: string | null; enviadoEn?: string | null; entregadoEn?: string | null };

function aInsert(p: NuevoPedido): Fila {
  return {
    user_id: p.userId,
    plan_id: p.planId,
    stripe_session_id: p.stripeSessionId,
    stripe_payment_intent: p.stripePaymentIntent,
    stripe_customer: p.stripeCustomer,
    monto_centavos: p.montoCentavos,
    moneda: p.moneda,
    estado: p.estado,
    envio: p.envio,
    telefono: p.telefono,
    email: p.email,
    nota_revision: p.notaRevision,
  };
}

function aFila(r: Fila): PedidoFila {
  return {
    id: r.id as string,
    userId: (r.user_id as string | null) ?? null,
    planId: (r.plan_id as string | null) ?? null,
    stripeSessionId: r.stripe_session_id as string,
    stripePaymentIntent: (r.stripe_payment_intent as string | null) ?? null,
    stripeCustomer: (r.stripe_customer as string | null) ?? null,
    montoCentavos: Number(r.monto_centavos),
    moneda: r.moneda as string,
    estado: r.estado as EstadoPedido,
    envio: (r.envio as Envio | null) ?? null,
    telefono: (r.telefono as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    notaRevision: (r.nota_revision as string | null) ?? null,
    seguimiento: (r.seguimiento as string | null) ?? null,
    // timestamptz llega de PostgREST como texto ISO.
    creado: String(r.creado),
    enviadoEn: r.enviado_en == null ? null : String(r.enviado_en),
    entregadoEn: r.entregado_en == null ? null : String(r.entregado_en),
  };
}

function aPatch(patch: PatchEstado): Fila {
  const o: Fila = { estado: patch.estado };
  if (patch.seguimiento !== undefined) o.seguimiento = patch.seguimiento;
  if (patch.enviadoEn !== undefined) o.enviado_en = patch.enviadoEn;
  if (patch.entregadoEn !== undefined) o.entregado_en = patch.entregadoEn;
  return o;
}

type Decision = "duplicado" | "reintentar" | "fallo";

/** Clasifica el error de un insert por su código SQLSTATE (nunca por el mensaje). */
function decidirError(code: string | undefined): Decision {
  if (code === "23505") return "duplicado";
  // 23503: user_id ya no existe (FK). 22P02: user_id no es un uuid válido.
  if (code === "23503" || code === "22P02") return "reintentar";
  return "fallo";
}

/** Pedido de respaldo sin usuario: un pago cobrado no debe quedarse sin pedido. */
function sinUsuario(p: NuevoPedido): NuevoPedido {
  const nota = p.notaRevision ? `${p.notaRevision}; usuario inexistente` : "usuario inexistente";
  return { ...p, userId: null, estado: "revisar", notaRevision: nota };
}

export function pedidosStoreSupabase(): PedidosStore {
  return {
    async guardarSiNoExiste(p) {
      const db = supabaseAdmin();
      const { error } = await db.from(TABLA).insert(aInsert(p));
      if (!error) return "creado";
      const d = decidirError(error.code);
      if (d === "duplicado") return "duplicado";
      if (d === "fallo") throw new Error(errorGenerico(ERROR_GUARDAR, error));

      const { error: error2 } = await db.from(TABLA).insert(aInsert(sinUsuario(p)));
      if (!error2) return "creado";
      if (error2.code === "23505") return "duplicado";
      throw new Error(errorGenerico(ERROR_GUARDAR, error2));
    },

    async obtener(id) {
      const { data, error } = await supabaseAdmin().from(TABLA).select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(errorGenerico(ERROR_LEER, error));
      return data ? aFila(data as Fila) : null;
    },

    async actualizarEstado(id, patch, estadoEsperado) {
      const { data, error } = await supabaseAdmin()
        .from(TABLA)
        .update(aPatch(patch))
        .eq("id", id)
        .eq("estado", estadoEsperado)
        .select("id");
      if (error) throw new Error(errorGenerico(ERROR_ACTUALIZAR, error));
      return Array.isArray(data) && data.length === 1;
    },

    async listar(desde, limite) {
      const { data, error } = await supabaseAdmin()
        .from(TABLA)
        .select("*")
        .order("creado", { ascending: false })
        .range(desde, desde + limite - 1);
      if (error) throw new Error(errorGenerico(ERROR_LEER, error));
      return (data ?? []).map((r) => aFila(r as Fila));
    },
  };
}
