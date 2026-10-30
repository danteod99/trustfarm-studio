// Construye las dependencias reales de forma perezosa (dentro de la petición, no al importar),
// para que `next build` no falle cuando faltan variables de entorno.
import { crearCloudflare } from '../cloudflare'
import { supabaseStore } from './store-supabase'
import type { ServicioDeps } from './servicio'

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ERROR_NO_CONFIGURADO = { error: 'El servicio de cajas no está configurado.' }

/** Devuelve las dependencias o null si falta alguna variable (sin nombrarla). */
export function depsReales(): ServicioDeps | null {
  const e = process.env
  const token = e.CF_API_TOKEN, accountId = e.CF_ACCOUNT_ID, zoneId = e.CF_ZONE_ID, dominio = e.DOMINIO_CAJAS
  const paseKeyPublica = e.PASE_PUBLIC_KEY
  if (!token || !accountId || !zoneId || !dominio || !paseKeyPublica) return null
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return null
  return {
    store: supabaseStore(),
    now: () => new Date(),
    env: { dominio, paseKeyPublica },
    cloudflare: crearCloudflare({ token, accountId, zoneId, dominio }),
  }
}

/** Extrae el secreto de `Authorization: Bearer <secreto>`; null si falta o está mal formado. */
export function leerBearer(req: Request): string | null {
  const h = req.headers.get('authorization')
  const m = h ? /^Bearer\s+(\S+)$/i.exec(h.trim()) : null
  return m ? m[1] : null
}
