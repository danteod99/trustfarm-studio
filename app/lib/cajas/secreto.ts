import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Llave de la caja: 32 bytes aleatorios en base64url (sin relleno). */
export function generarSecreto(): string {
  return randomBytes(32).toString('base64url')
}

/** La central guarda solo este hash (SHA-256 hex), nunca el secreto. */
export function hashSecreto(secreto: string): string {
  return createHash('sha256').update(secreto, 'utf8').digest('hex')
}

/** Comparación en tiempo constante; false si las longitudes difieren. */
export function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}
