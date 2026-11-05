// Cliente mínimo de la API de Cloudflare para los túneles de las cajas.
// Nunca se incluyen el token de la API ni el token del túnel en mensajes de error ni en logs:
// los errores llevan solo la operación, el estado HTTP y el código numérico de Cloudflare.

const API = 'https://api.cloudflare.com/client/v4'
const SERVICIO_CAJA = 'http://localhost:8080'
const SERVICIO_SOPORTE = 'ssh://localhost:22'
/** Contrato: el slug de una caja son 8 caracteres [a-z0-9]. */
export const SLUG_REGEX = /^[a-z0-9]{8}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Tiempo límite de cada llamada a Cloudflare. */
export const CLOUDFLARE_TIMEOUT_MS = 10_000

function validarSlug(slug: string) {
  if (typeof slug !== 'string' || !SLUG_REGEX.test(slug)) throw new Error('El identificador de la caja no es válido para su túnel.')
}
function validarTunnelId(id: string) {
  if (typeof id !== 'string' || !UUID_REGEX.test(id)) throw new Error('El identificador del túnel no es válido.')
}

export interface CloudflareEnv {
  token: string
  accountId: string
  zoneId: string
  dominio: string
}

interface RegistroDns { id: string; name?: string; type?: string; content?: string }

export function crearCloudflare(env: CloudflareEnv, fetchFn: typeof fetch = fetch, timeoutMs: number = CLOUDFLARE_TIMEOUT_MS) {
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
        signal: AbortSignal.timeout(timeoutMs),
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
  const hostnameSoporteDe = (slug: string) => `soporte-${slug}.${env.dominio}`

  async function obtenerTokenTunel(tunnelId: string): Promise<string> {
    validarTunnelId(tunnelId)
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
    validarSlug(slug)
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
    validarSlug(slug)
    validarTunnelId(tunnelId)
    const hostname = hostnameDe(slug)
    const destino = `${tunnelId}.cfargotunnel.com`.toLowerCase()
    const registros: RegistroDns[] | null = await llamar(
      'buscar registro DNS', 'GET', `/zones/${zona}/dns_records?name=${encodeURIComponent(hostname)}`,
    )
    for (const r of Array.isArray(registros) ? registros : []) {
      // Solo el CNAME de esta caja: nombre exacto, tipo CNAME y apuntando a ESTE túnel
      if (
        r?.id && r.type === 'CNAME'
        && typeof r.name === 'string' && r.name.toLowerCase() === hostname.toLowerCase()
        && typeof r.content === 'string' && r.content.toLowerCase() === destino
      ) await borrarDns(r.id)
    }
    // Un túnel con conectores activos no se puede borrar: se limpian primero
    await llamar('limpiar conexiones del túnel', 'DELETE', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/connections`, undefined, true)
    await borrarSoloTunel(tunnelId)
  }

  // Registros de la dirección de soporte que apuntan a ESTE túnel
  async function dnsSoporte(tunnelId: string, slug: string): Promise<RegistroDns[]> {
    const nombre = hostnameSoporteDe(slug).toLowerCase()
    const destino = `${tunnelId}.cfargotunnel.com`.toLowerCase()
    const registros: RegistroDns[] | null = await llamar(
      'buscar registro DNS', 'GET', `/zones/${zona}/dns_records?name=${encodeURIComponent(nombre)}`,
    )
    return (Array.isArray(registros) ? registros : []).filter((r) => r?.id && r.type === 'CNAME'
      && typeof r.name === 'string' && r.name.toLowerCase() === nombre
      && typeof r.content === 'string' && r.content.toLowerCase() === destino)
  }

  /** Mientras dura un acceso de sistema, la caja recibe SSH por su túnel. Devuelve la dirección. */
  async function abrirRutaSoporte(tunnelId: string, slug: string): Promise<string> {
    validarSlug(slug)
    validarTunnelId(tunnelId)
    const nombre = hostnameSoporteDe(slug)
    await llamar('configurar túnel', 'PUT', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`, {
      config: { ingress: [{ hostname: hostnameDe(slug), service: SERVICIO_CAJA }, { hostname: nombre, service: SERVICIO_SOPORTE }, { service: 'http_status:404' }] },
    })
    if ((await dnsSoporte(tunnelId, slug)).length === 0) {
      await llamar('crear registro DNS', 'POST', `/zones/${zona}/dns_records`, {
        type: 'CNAME',
        name: nombre,
        content: `${tunnelId}.cfargotunnel.com`,
        proxied: true,
      })
    }
    return nombre
  }

  async function cerrarRutaSoporte(tunnelId: string, slug: string): Promise<void> {
    validarSlug(slug)
    validarTunnelId(tunnelId)
    await llamar('configurar túnel', 'PUT', `/accounts/${cuenta}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`, {
      config: { ingress: [{ hostname: hostnameDe(slug), service: SERVICIO_CAJA }, { service: 'http_status:404' }] },
    })
    for (const r of await dnsSoporte(tunnelId, slug)) await borrarDns(r.id)
  }

  return { crearTunel, obtenerTokenTunel, borrarTunel, abrirRutaSoporte, cerrarRutaSoporte }
}
