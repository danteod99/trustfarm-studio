// Dependencias reales de la pasarela, perezosas (dentro de la petición) para que `next build` no falle sin variables de entorno.
import Anthropic from '@anthropic-ai/sdk'
import { isAdminEmail } from '../auth'
import { getBalance } from '../credits'
import { depsReales } from '../cajas/deps'
import { supabaseAdmin } from '../supabase/admin'
import { TOPE_DIARIO_POR_DEFECTO } from '../cajas/estudio-tope'
import type { DepsIA } from './pasarela'

/** null si falta alguna variable (sin nombrarla en la respuesta). */
export function depsIAReales(): DepsIA | null {
  const servicio = depsReales()
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!servicio || !apiKey) return null
  // Sin reintentos aquí: los hace el SDK de la caja, que recibe el mismo estado de error
  const cliente = new Anthropic({ apiKey, maxRetries: 0, timeout: 110_000 })
  const db = () => supabaseAdmin()
  return {
    servicio,
    activa: process.env.IA_PASARELA_ACTIVA === '1',
    esAdmin: isAdminEmail,
    anthropic: {
      crear: (params) => cliente.messages.create(params as unknown as Anthropic.MessageCreateParamsNonStreaming),
    },
    store: {
      async estadoCaja(cajaId) {
        const { data, error } = await db().from('cajas').select('ia_bloqueada, tope_diario_ia, tope_diario').eq('id', cajaId).maybeSingle()
        if (error || !data) throw new Error('No se pudo leer la caja.')
        return { bloqueada: data.ia_bloqueada === true, topeIa: data.tope_diario_ia ?? 100, tope: data.tope_diario ?? TOPE_DIARIO_POR_DEFECTO }
      },
      saldo: getBalance,
      async gastoIaHoy(cajaId, dia, modelo) {
        const { data, error } = await db().rpc('caja_ia_gasto_hoy', { p_caja: cajaId, p_dia: dia, p_modelo: modelo })
        if (error) throw new Error('No se pudo leer el gasto de la caja.')
        return Number(data) || 0
      },
      async gastoEstudioHoy(cajaId, desdeIso) {
        const { data, error } = await db().rpc('caja_gasto_hoy', { p_caja: cajaId, p_desde: desdeIso })
        if (error) throw new Error('No se pudo leer el gasto de la caja.')
        return Number(data) || 0
      },
      async registrar(r) {
        const { data, error } = await db().rpc('caja_ia_registrar', {
          p_caja: r.cajaId, p_user: r.userId, p_dia: r.dia, p_modelo: r.modelo,
          p_entrada: r.entrada, p_salida: r.salida, p_cache_lectura: r.cacheLectura, p_cache_escritura: r.cacheEscritura,
          p_costo_microusd: r.costoMicroUsd, p_microcreditos: r.microcreditos, p_ip_hash: r.ipHash, p_cobrar: r.cobrar,
        })
        if (error) throw new Error('No se pudo registrar el consumo.')
        const fila = (data as Array<{ saldo: number; cobrados: number }> | null)?.[0]
        return { saldo: Number(fila?.saldo) || 0, cobrados: Number(fila?.cobrados) || 0 }
      },
    },
  }
}
