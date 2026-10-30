// Cliente mínimo de la API de Cloudflare para los túneles de las cajas.
// Nunca se incluyen el token de la API ni el token del túnel en mensajes de error ni en logs:
// los errores llevan solo la operación, el estado HTTP y el código numérico de Cloudflare.

const API = 'https://api.cloudflare.com/client/v4'
const SERVICIO_CAJA = 'http://localhost:8080'
const SLUG_VALIDO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export interface CloudflareEnv {
  token: string
  accountId: string
  zoneId: string
  dominio: string
}

interface RegistroDns { id: string; name?: string }

export function crearCloudflare(env: CloudflareEnv, fetchFn: typeof fetch = fetch) {
  const cuenta = encodeURIComponent(env.accountId)
  const zona = encodeURIComponent(env.zoneId)

  // Devuelve `result`, o `null` si la respuesta es 404 y se permitió (idempotencia)
  async function llamar(
    operacion: string,
    metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
    permitir404 = false,
  ): Promise<any> {
    let res: Response
    try {
      res = await fetchFn(`${API}${ruta}`, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${env.token}`,
          ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      })
    } catch {
      throw new Error(`No se pudo contactar con Cloudflare (${operacion}).`)
    }
    if (res.status === 404 && permitir404) return null

    let json: any = null
    try { json = await res.json() } catch { /* cuerpo no JSON */ }

    if (!res.ok || !json || json.success !== true) {
      const codigo = Array.isArray(json?.errors) && typeof json.errors[0]?.code === 'number' ? json.errors[0].code : null
      throw new Error(
        `Cloudflare rechazó la operación (${operacion}). Estado ${res.status}${codigo !== null ? `, código ${codigo}` : ''}.`,
      )
    }
    return json.result
  }

  const hostnameDe = (slug: string) => `${slug}.${env.dominio}`

  async function obtenerTokenTunel(tunnelId: string): Promise<string> {
    const token = await llamar('obtener token del túnel', 'GET', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/token`)
    if (typeof token !== 'string' || !token) throw new Error('Cloudflare rechazó la operación (obtener token del túnel). Respuesta inesperada.')
    return token
  }

  async function borrarDns(dnsId: string) {
    await llamar('borrar registro DNS', 'DELETE', `/zones/${zona}/dns_records/${encodeURIComponent(dnsId)}`, undefined, true)
  }

  async function borrarSoloTunel(tunnelId: string) {
    await llamar('borrar túnel', 'DELETE', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}`, undefined, true)
  }

  async function crearTunel(slug: string): Promise<{ tunnelId: string; tunnelToken: string; hostname: string }> {
    if (!SLUG_VALIDO.test(slug)) throw new Error('El identificador de la caja no es válido para crear su túnel.')
    const hostname = hostnameDe(slug)

    const creado = await llamar('crear túnel', 'POST', `/accounts/${cuenta}/cfd_tunnel`, { name: `caja-${slug}`, config_src: 'cloudflare' })
    const tunnelId: string | undefined = creado?.id
    if (typeof tunnelId !== 'string' || !tunnelId) throw new Error('Cloudflare rechazó la operación (crear túnel). Respuesta inesperada.')

    let dnsId: string | undefined
    try {
      await llamar('configurar túnel', 'PUT', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`, {
        config: { ingress: [{ hostname, service: SERVICIO_CAJA }, { service: 'http_status:404' }] },
      })
      const dns = await llamar('crear registro DNS', 'POST', `/zones/${zona}/dns_records`, {
        type: 'CNAME',
        name: hostname,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true,
      })
      dnsId = dns?.id
      const tunnelToken = await obtenerTokenTunel(tunnelId)
      return { tunnelId, tunnelToken, hostname }
    } catch (errorOriginal) {
      // Rollback: si falla, se ignora para no tapar el error original
      if (dnsId) { try { await borrarDns(dnsId) } catch { /* ignorado */ } }
      try { await borrarSoloTunel(tunnelId) } catch { /* ignorado */ }
      throw errorOriginal
    }
  }

  async function borrarTunel(tunnelId: string, slug: string): Promise<void> {
    const hostname = hostnameDe(slug)
    const registros: RegistroDns[] | null = await llamar(
      'buscar registro DNS', 'GET', `/zones/${zona}/dns_records?name=${encodeURIComponent(hostname)}`,
    )
    for (const r of Array.isArray(registros) ? registros : []) {
      // Solo el registro exacto de esta caja
      if (r?.id && typeof r.name === 'string' && r.name.toLowerCase() === hostname.toLowerCase()) await borrarDns(r.id)
    }
    // Un túnel con conectores activos no se puede borrar: se limpian primero
    await llamar('limpiar conexiones del túnel', 'DELETE', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/connections`, undefined, true)
    await borrarSoloTunel(tunnelId)
  }

  return { crearTunel, obtenerTokenTunel, borrarTunel }
}
