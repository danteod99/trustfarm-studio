// Correo de la cuenta a la que va dirigida una caja: siempre se guarda y se compara en minúsculas y sin espacios.
const FORMA_CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const MAX_CORREO = 254

/** El correo normalizado, o null si no parece un correo. */
export function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const limpio = v.trim().toLowerCase()
  return limpio.length <= MAX_CORREO && FORMA_CORREO.test(limpio) ? limpio : null
}

/** cl***@gmail.com: basta para que el cliente reconozca su cuenta, sin mostrarle el correo completo a otra persona. */
export function enmascararCorreo(correo: string): string {
  const [local, dominio] = correo.split('@')
  return `${local.slice(0, 2)}***@${dominio}`
}
