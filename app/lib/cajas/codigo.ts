import { randomInt } from 'node:crypto'

// Sin 0, O, 1, I, L para evitar confusiones al dictar o leer el código.
export const CODIGO_ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LONGITUD = 8

/** Código de vinculación "XXXX-XXXX". randomInt descarta valores sesgados (sin sesgo de módulo). */
export function generarCodigo(): string {
  let s = ''
  for (let i = 0; i < LONGITUD; i++) s += CODIGO_ALFABETO[randomInt(CODIGO_ALFABETO.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

/** Devuelve los 8 caracteres en mayúsculas sin guion, o null si no es un código válido. */
export function normalizarCodigo(entrada: string): string | null {
  if (typeof entrada !== 'string') return null
  const limpio = entrada.toUpperCase().replace(/[-\s]/g, '')
  if (limpio.length !== LONGITUD) return null
  for (const ch of limpio) if (!CODIGO_ALFABETO.includes(ch)) return null
  return limpio
}
