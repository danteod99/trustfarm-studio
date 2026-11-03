// Resumen del consumo de IA por caja y señales de que una llave se está usando fuera de su mini PC. Lógica pura.
export interface FilaConsumo {
  caja_id: string
  dia: string
  modelo: string
  solicitudes: number
  costo_microusd: number
  creditos_micro: number
  cambios_ip: number
}

export interface ResumenIa {
  creditosHoy: number
  creditosMes: number
  costoMesUsd: number
  solicitudesMes: number
  cambiosIpHoy: number
  /** Promedio diario de créditos de los 7 días anteriores a hoy. */
  mediaDiaria7d: number
}

const DIA_MS = 86_400_000
const MICRO = 1_000_000
const CAMBIOS_IP_ALERTA = 5
const CREDITOS_MINIMOS_ALERTA = 20
const VECES_LO_NORMAL = 3
const MIN_SOLICITUDES_ESTIMADO = 10

const restarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) - n * DIA_MS).toISOString().slice(0, 10)

/** Desde qué día hay que leer para poder resumir: el primero del mes o 7 días atrás, lo que sea antes. */
export function diaDesde(hoy: string): string {
  const mes = `${hoy.slice(0, 7)}-01`
  const semana = restarDias(hoy, 7)
  return mes < semana ? mes : semana
}

export const RESUMEN_VACIO: ResumenIa = { creditosHoy: 0, creditosMes: 0, costoMesUsd: 0, solicitudesMes: 0, cambiosIpHoy: 0, mediaDiaria7d: 0 }

export function resumirConsumo(filas: FilaConsumo[], hoy: string): Record<string, ResumenIa> {
  const semana = restarDias(hoy, 7)
  const mes = hoy.slice(0, 7)
  const acum: Record<string, { hoy: number; mes: number; costo: number; solicitudes: number; ip: number; semana: number }> = {}
  for (const f of filas) {
    const a = (acum[f.caja_id] ??= { hoy: 0, mes: 0, costo: 0, solicitudes: 0, ip: 0, semana: 0 })
    if (f.dia === hoy) {
      a.hoy += f.creditos_micro
      a.ip += f.cambios_ip
    }
    if (f.dia.startsWith(mes)) {
      a.mes += f.creditos_micro
      a.costo += f.costo_microusd
      a.solicitudes += f.solicitudes
    }
    if (f.dia >= semana && f.dia < hoy) a.semana += f.creditos_micro
  }
  return Object.fromEntries(Object.entries(acum).map(([id, a]) => [id, {
    creditosHoy: a.hoy / MICRO,
    creditosMes: a.mes / MICRO,
    costoMesUsd: a.costo / MICRO,
    solicitudesMes: a.solicitudes,
    cambiosIpHoy: a.ip,
    mediaDiaria7d: a.semana / MICRO / 7,
  }]))
}

export function alertasCaja(c: Pick<ResumenIa, 'cambiosIpHoy' | 'creditosHoy' | 'mediaDiaria7d'>): string[] {
  const alertas: string[] = []
  if (c.cambiosIpHoy >= CAMBIOS_IP_ALERTA) alertas.push('Cambia mucho de red')
  if (c.creditosHoy >= CREDITOS_MINIMOS_ALERTA && c.creditosHoy >= VECES_LO_NORMAL * c.mediaDiaria7d) alertas.push('Consumo fuera de lo normal')
  return alertas
}

/** Estimado para el cliente; sin suficiente historia no se inventa un número. */
export function respuestasRestantes(saldo: number, c: Pick<ResumenIa, 'creditosMes' | 'solicitudesMes'>): number | null {
  if (c.solicitudesMes < MIN_SOLICITUDES_ESTIMADO || c.creditosMes <= 0) return null
  return Math.floor(saldo / (c.creditosMes / c.solicitudesMes))
}
