// Lista paginada de cajas para el panel de administración (lógica pura, probada con el almacén simulado).
import { direccion, encendida, type ClienteDeps } from './cliente-servicio.ts'
import { TOPE_DIARIO_POR_DEFECTO, inicioDiaLima } from './estudio-tope.ts'
import { RESUMEN_VACIO, alertasCaja, diaDesde, resumirConsumo } from '../ia/alertas.ts'

export const TAM_PAGINA_ADMIN = 100

export interface CajaAdmin {
  id: string; nombre: string; owner_id: string | null; direccion: string
  estado: 'encendida' | 'apagada'; ultima_senal: string | null; version: string | null; vinculada_en: string | null
  /** Tope diario del Estudio y lo gastado hoy (día de Lima). */
  tope_diario: number; gastado_hoy: number
  /** Caja de fábrica: etiqueta interna, si tiene dueño y si la caja ya se activó con su llave. */
  etiqueta: string | null; asignacion: 'preparada' | 'asignada'; activada: boolean
  /** Correo de la cuenta a la que va dirigida (null = sin asignar). */
  email_asignado: string | null
  /** IA: créditos cobrados y costo real de Anthropic este mes, señales de uso raro, bloqueo y tope de chats. */
  ia_creditos_mes: number; ia_costo_mes_usd: number; ia_alertas: string[]; ia_bloqueada: boolean; tope_diario_ia: number
}

/** Pide `limite + 1` filas para saber si hay otra página. Nunca expone tunnel_id. */
export async function paginaAdminCajas(deps: ClienteDeps, pagina: number): Promise<{ cajas: CajaAdmin[]; hay_mas: boolean }> {
  const p = Number.isInteger(pagina) && pagina > 0 && pagina < 1_000_000 ? pagina : 0
  const filas = await deps.store.listarTodasLasCajas(p * TAM_PAGINA_ADMIN, TAM_PAGINA_ADMIN + 1)
  const visibles = filas.slice(0, TAM_PAGINA_ADMIN)
  const inicioHoy = inicioDiaLima(deps.now()).toISOString()
  const gasto = visibles.length ? await deps.store.gastoHoyPorCajas(visibles.map(c => c.id), inicioHoy) : {}
  const hoy = inicioHoy.slice(0, 10)
  const consumo = resumirConsumo(visibles.length ? await deps.store.consumoIa(visibles.map(c => c.id), diaDesde(hoy)) : [], hoy)
  return {
    hay_mas: filas.length > TAM_PAGINA_ADMIN,
    cajas: visibles.map(c => {
      const ia = consumo[c.id] ?? RESUMEN_VACIO
      return {
      id: c.id, nombre: c.nombre, owner_id: c.ownerId, direccion: direccion(c, deps),
      estado: encendida(c, deps) ? 'encendida' : 'apagada', ultima_senal: c.lastSeen,
      version: c.version ?? null, vinculada_en: c.creadaEn ?? null,
      tope_diario: c.topeDiario ?? TOPE_DIARIO_POR_DEFECTO, gastado_hoy: gasto[c.id] ?? 0,
      etiqueta: c.etiqueta ?? null, asignacion: c.ownerId === null ? 'preparada' : 'asignada', activada: c.activada ?? false,
      email_asignado: c.emailAsignado ?? null,
      ia_creditos_mes: Math.round(ia.creditosMes * 10) / 10, ia_costo_mes_usd: Math.round(ia.costoMesUsd * 100) / 100,
      ia_alertas: alertasCaja(ia), ia_bloqueada: c.iaBloqueada ?? false, tope_diario_ia: c.topeDiarioIa ?? 100,
      }
    }),
  }
}

export const TOPE_MAXIMO = 10_000

/** Bloquea la IA de una caja o cambia su tope diario de chats. */
export async function fijarIaAdmin(
  deps: ClienteDeps,
  { cajaId, bloqueada, topeIa }: { cajaId: string; bloqueada?: unknown; topeIa?: unknown },
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  const o: { bloqueada?: boolean; topeIa?: number } = {}
  if (bloqueada !== undefined) {
    if (typeof bloqueada !== 'boolean') return { ok: false, status: 400, error: 'Solicitud inválida.' }
    o.bloqueada = bloqueada
  }
  if (topeIa !== undefined) {
    if (typeof topeIa !== 'number' || !Number.isInteger(topeIa) || topeIa < 0 || topeIa > TOPE_MAXIMO) {
      return { ok: false, status: 400, error: `El tope debe ser un número entero entre 0 y ${TOPE_MAXIMO}.` }
    }
    o.topeIa = topeIa
  }
  if (o.bloqueada === undefined && o.topeIa === undefined) return { ok: false, status: 400, error: 'Nada que cambiar.' }
  return (await deps.store.fijarIa(cajaId, o)) ? { ok: true } : { ok: false, status: 404, error: 'No encontré esa caja.' }
}

/** Cambia el tope diario de una caja. Solo enteros de 0 a 10000 (0 = la caja no puede gastar). */
export async function fijarTopeAdmin(
  deps: ClienteDeps,
  { cajaId, tope }: { cajaId: string; tope: unknown },
): Promise<{ ok: true } | { ok: false; status: 400 | 404; error: string }> {
  if (typeof tope !== 'number' || !Number.isInteger(tope) || tope < 0 || tope > TOPE_MAXIMO) {
    return { ok: false, status: 400, error: `El tope debe ser un número entero entre 0 y ${TOPE_MAXIMO}.` }
  }
  return (await deps.store.fijarTope(cajaId, tope)) ? { ok: true } : { ok: false, status: 404, error: 'No encontré esa caja.' }
}
