// Quién da soporte: una lista propia, aparte de ADMIN_EMAILS. Da acceso a las cajas de los clientes.
export function isSoporteEmail(email?: string | null): boolean {
  if (!email) return false
  const lista = (process.env.SOPORTE_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return lista.includes(email.toLowerCase())
}
