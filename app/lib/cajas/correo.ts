// Correo de la cuenta a la que va dirigida una caja: siempre se guarda y se compara en minúsculas y sin espacios.
const FORMA_CORREO = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/
const MAX_CORREO = 254

/** El correo normalizado, o null si no parece un correo. */
export function normalizarCorreo(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const limpio = v.trim().toLowerCase()
  if (limpio.length > MAX_CORREO || !FORMA_CORREO.test(limpio)) return null
  // En Gmail juan.perez, juanperez y juanperez+tienda son la misma cuenta: se escriben de cualquier forma al comprar
  const [local, dominio] = limpio.split('@')
  if (dominio !== 'gmail.com' && dominio !== 'googlemail.com') return limpio
  const base = local.split('+')[0].replaceAll('.', '')
  return base ? `${base}@gmail.com` : null
}

interface Identidad { provider?: string; identity_data?: { email?: unknown; email_verified?: unknown } | null }

/**
 * El correo que Google confirma para esta sesión, o null si no entró con Google. El `email` de la cuenta no sirve para decidir de quién
 * es una caja: quien se registra con contraseña puede escribir un correo ajeno.
 */
export function correoDeGoogle(usuario: { identities?: Identidad[] | null }): string | null {
  const google = usuario.identities?.find((i) => i.provider === 'google' && i.identity_data?.email_verified !== false)
  return normalizarCorreo(google?.identity_data?.email)
}

/** cl***@gmail.com: basta para que el cliente reconozca su cuenta, sin mostrarle el correo completo a otra persona. */
export function enmascararCorreo(correo: string): string {
  const [local, dominio] = correo.split('@')
  return `${local.slice(0, 2)}***@${dominio}`
}
