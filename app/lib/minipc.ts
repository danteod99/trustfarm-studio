// Catálogo de planes de la mini PC (TRUST Assistant): fuente única.
// Sin imports con alias ni enum: lo ejecuta Node directo (strip-types).

export type PlanId = 'basico' | 'pro' | 'negocio'

export interface Plan {
  id: PlanId
  nombre: string
  subtitulo: string
  precioUsd: number
  mensualUsd: number
  equipo: string
  memoria: string
  idealPara: string
  incluye: string[]
  recomendado: boolean
  activo: boolean
}

export const PLANES: Plan[] = [
  {
    id: 'basico',
    nombre: 'Básico',
    subtitulo: 'Para empezar',
    precioUsd: 490,
    mensualUsd: 39,
    equipo: 'Intel N150',
    memoria: '12 GB RAM · 128 GB SSD',
    idealPara: 'Bodegas y negocios chicos',
    incluye: ['Vendedor IA + CRM', '1 número de WhatsApp', 'Resumen diario', 'Soporte Lima'],
    recomendado: false,
    activo: true,
  },
  {
    id: 'pro',
    nombre: 'Pro',
    subtitulo: 'Vende + video',
    precioUsd: 790,
    mensualUsd: 79,
    equipo: 'AMD Ryzen 7 7735HS',
    memoria: '24 GB RAM · 512 GB SSD',
    idealPara: 'Negocios que venden y publican',
    incluye: ['Todo lo del Básico', 'Vendedor + estudio de video', 'Multiclipping y variaciones', 'Catálogo cargado por nosotros'],
    recomendado: true,
    activo: true,
  },
  {
    id: 'negocio',
    nombre: 'Negocio',
    subtitulo: 'Alto volumen',
    precioUsd: 1290,
    mensualUsd: 129,
    equipo: 'AMD Ryzen 7 7735HS',
    memoria: '24 GB RAM · 1 TB SSD',
    idealPara: 'Alto volumen y agencias',
    incluye: ['Todo lo del Pro', 'Más espacio para videos', 'Capacitación para tu equipo', 'Soporte prioritario'],
    recomendado: false,
    activo: true,
  },
]

export function getPlan(id: unknown): Plan | undefined {
  if (typeof id !== 'string') return undefined
  return PLANES.find((p) => p.id === id)
}

export function precioCentavos(p: Plan): number {
  return Math.round(p.precioUsd * 100)
}

// Por ahora se vende como reserva: se paga RESERVA_USD y se descuenta del precio del equipo.
export const RESERVA_USD = 20

export function reservaCentavos(): number {
  return Math.round(RESERVA_USD * 100)
}

export function saldoUsd(p: Plan): number {
  return p.precioUsd - RESERVA_USD
}

export const PAISES_ENVIO: readonly string[] = ['PE']
export const ENTREGA_TEXTO = '5 a 7 días'

export const CONTACTO: { whatsapp: string; whatsappUrl: string; oficina: string; tiktok: string } = {
  whatsapp: '+51 970 912 014',
  whatsappUrl: 'https://wa.me/51970912014',
  oficina: 'Pueblo Libre, Lima',
  tiktok: '@trust.peru',
}

export function libroReclamacionesUrl(env: { NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL?: string }): string | null {
  const url = env.NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL
  return typeof url === 'string' && url.startsWith('https://') ? url : null
}

export function ventaAbierta(env: { MINIPC_VENTA_ACTIVA?: string }): boolean {
  return env.MINIPC_VENTA_ACTIVA === '1'
}

export function paginaVisible(env: { NEXT_PUBLIC_MINIPC_VISIBLE?: string }): boolean {
  return env.NEXT_PUBLIC_MINIPC_VISIBLE === '1'
}
