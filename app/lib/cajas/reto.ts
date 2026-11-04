// Reto de «Continuar con Google» en la mini PC: dice qué cuenta inició sesión y dura poco. Solo viaja a la propia máquina,
// y solo la caja, con su secreto, puede canjearlo. Sin tabla nueva: va firmado con una clave derivada de la del pase.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const VIDA_SEG = 120

const claveDe = (clave: string) => createHash('sha256').update(`reto-conectar:${clave}`).digest()
const firmar = (cuerpo: string, clave: string) => createHmac('sha256', claveDe(clave)).update(cuerpo).digest('base64url')

export function firmarReto(o: { sub: string; email: string | null; now: Date; clave: string }): string {
  const cuerpo = Buffer.from(JSON.stringify({ sub: o.sub, email: o.email, exp: Math.floor(o.now.getTime() / 1000) + VIDA_SEG })).toString('base64url')
  return `${cuerpo}.${firmar(cuerpo, o.clave)}`
}

export function verificarReto(reto: unknown, o: { now: Date; clave: string }): { sub: string; email: string | null } | null {
  if (typeof reto !== 'string') return null
  const partes = reto.split('.')
  if (partes.length !== 2) return null
  const [cuerpo, firma] = partes
  const esperada = Buffer.from(firmar(cuerpo, o.clave))
  const recibida = Buffer.from(firma)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    const p = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
    if (typeof p.sub !== 'string' || !p.sub || typeof p.exp !== 'number') return null
    if (p.exp < o.now.getTime() / 1000) return null
    return { sub: p.sub, email: typeof p.email === 'string' ? p.email : null }
  } catch {
    return null
  }
}
