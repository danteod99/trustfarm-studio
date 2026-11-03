// Almacén y Cloudflare simulados en memoria para las pruebas del lado cliente (no es una prueba).
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import type { CajaCliente, ClienteDeps, ClienteStore, ResultadoVincular } from '../app/lib/cajas/cliente-servicio.ts'

export function crearClienteMem(ahora: { t: Date }, opts: { vinculoAbierto?: boolean } = {}) {
  const m = {
    exitos: [] as { userId: string; creado: string }[],
    fallos: [] as { userId: string; creado: string }[],
    // Códigos vinculables conocidos (normalizados).
    vinculables: new Set<string>(),
    cajas: [] as CajaCliente[],
    forzarVincular: [] as ResultadoVincular[], // respuestas forzadas, en orden
    vincularLlamadas: 0,
    tunelesCreados: [] as { tunnelId: string; slug: string }[],
    tunelesVivos: new Set<string>(),
    crearFalla: false,
    borrarFalla: false,
    desvincularFalla: false,
    eventos: [] as string[],
    renombres: [] as { cajaId: string; nombre: string }[],
    // Estudio: gasto de hoy por caja y registro de las consultas (para comprobar desde cuándo se pide)
    gasto: {} as Record<string, number>,
    gastoConsultas: [] as { ids: string[]; desdeIso: string }[],
    // Caja de fábrica: llaves de activación (solo hash), creaciones por administrador y respuestas forzadas de `preparar`
    activaciones: [] as { cajaId: string; llaveHash: string; venceEn: string; usadaEn?: string }[],
    creaciones: [] as { adminId: string; creado: string }[],
    prepararForzado: [] as Array<{ ok: false; motivo: 'slug_repetido' | 'limite_preparadas' | 'error' }>,
    // Códigos de asociación de cajas preparadas (normalizados) -> caja
    codigosPreparadas: new Map<string, string>(),
    reclamarForzado: [] as Array<{ ok: false; motivo: 'codigo_invalido' | 'error' }>,
    liberadas: [] as string[],
    liberarFalla: false,
    // Caja asignada a una cuenta: correo validado en la mini PC por código, y cajas que ya tienen una mini PC unida
    emailsValidados: new Map<string, string>(),
    conRegistro: new Set<string>(),
    asignarFalla: false,
    vincularAsignadaLlamadas: 0,
    // Cuentas registradas (buscador del panel de administración)
    cuentas: [] as { id: string; email: string; con_google: boolean }[],
    busquedas: [] as string[],
  }
  let n = 0
  const store: ClienteStore = {
    async contarFallosVincular(userId, desde) { return m.fallos.filter(f => f.userId === userId && f.creado >= desde).length },
    async registrarFalloVincular(userId) { m.fallos.push({ userId, creado: ahora.t.toISOString() }) },
    async contarCajas(o) { return m.cajas.filter(c => c.ownerId === o).length },
    async contarExitosVincular(userId, desde) { return m.exitos.filter(f => f.userId === userId && f.creado >= desde).length },
    async registrarExitoVincular(userId) { m.exitos.push({ userId, creado: ahora.t.toISOString() }) },
    async buscarRegistroVinculable(c) { return m.vinculables.has(c) ? { id: 'reg-' + c, emailValidado: m.emailsValidados.get(c) ?? null } : null },
    async vincularAsignada(o) {
      m.vincularAsignadaLlamadas++
      if (!m.vinculables.has(o.codigo) || m.emailsValidados.get(o.codigo) !== o.email) return { ok: false, motivo: 'codigo_invalido' }
      const libre = m.cajas.filter((c) => c.ownerId === null && c.emailAsignado === o.email && !m.conRegistro.has(c.id)).sort((a, b) => (a.creadaEn ?? '').localeCompare(b.creadaEn ?? ''))[0]
      if (!libre) return { ok: false, motivo: 'sin_caja_asignada' }
      libre.ownerId = o.ownerId
      libre.nombre = o.nombre
      m.conRegistro.add(libre.id)
      m.vinculables.delete(o.codigo)
      return { ok: true, cajaId: libre.id }
    },
    async asignarEmail(cajaId, email) {
      if (m.asignarFalla) throw new Error('boom')
      const c = m.cajas.find((x) => x.id === cajaId)
      if (c) c.emailAsignado = email
    },
    async contarCajasConEmail(email) { return m.cajas.filter((c) => c.emailAsignado === email).length },
    async buscarCuentas(texto) { m.busquedas.push(texto); return m.cuentas.filter((c) => c.email.includes(texto.toLowerCase())) },
    async cuentaPorId(id) { const c = m.cuentas.find((x) => x.id === id); return c ? { email: c.email } : null },
    async vincular(o) {
      m.vincularLlamadas++
      const forzado = m.forzarVincular.shift()
      if (forzado) return forzado
      if (!m.vinculables.has(o.codigo)) return { ok: false, motivo: 'codigo_invalido' }
      m.vinculables.delete(o.codigo)
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
      m.cajas.push({ id, ownerId: o.ownerId, nombre: o.nombre, slug: o.slug, tunnelId: o.tunnelId, lastSeen: null })
      return { ok: true, cajaId: id }
    },
    async listarCajas(o) { return m.cajas.filter(c => c.ownerId === o) },
    async obtenerCaja(id) { return m.cajas.find(c => c.id === id) ?? null },
    async renombrarCaja(id, nombre) { m.renombres.push({ cajaId: id, nombre }); const c = m.cajas.find(x => x.id === id); if (c) c.nombre = nombre },
    async desvincularCaja(id) {
      m.eventos.push('desvincular')
      if (m.desvincularFalla) throw new Error('boom')
      m.cajas = m.cajas.filter(c => c.id !== id)
    },
    async fijarTope(id, tope) { const c = m.cajas.find(x => x.id === id); if (!c) return false; c.topeDiario = tope; return true },
    async gastoHoyPorCajas(ids, desdeIso) { m.gastoConsultas.push({ ids: [...ids], desdeIso }); return Object.fromEntries(ids.map(i => [i, m.gasto[i] ?? 0])) },
    async contarPreparadasSinDueno() { return m.cajas.filter((c) => c.ownerId === null && c.creadaPor).length },
    async contarCreacionesAdmin(adminId, desde) { return m.creaciones.filter((x) => x.adminId === adminId && x.creado >= desde).length },
    async registrarCreacionAdmin(adminId) { m.creaciones.push({ adminId, creado: ahora.t.toISOString() }) },
    async preparar(o) {
      const forzado = m.prepararForzado.shift()
      if (forzado) return forzado
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
      m.cajas.push({ id, ownerId: null, nombre: 'Mi caja', slug: o.slug, tunnelId: o.tunnelId, lastSeen: null, etiqueta: o.etiqueta, activada: false })
      m.activaciones.push({ cajaId: id, llaveHash: o.llaveHash, venceEn: o.venceEn })
      return { ok: true, cajaId: id }
    },
    async nuevaLlave(cajaId, llaveHash, venceEn) {
      if (!m.cajas.some((c) => c.id === cajaId)) return false
      m.activaciones = m.activaciones.filter((a) => !(a.cajaId === cajaId && !a.usadaEn))
      m.activaciones.push({ cajaId, llaveHash, venceEn })
      return true
    },
    async buscarCajaPreparadaPorCodigo(codigo) {
      const cajaId = m.codigosPreparadas.get(codigo)
      const c = cajaId ? m.cajas.find((x) => x.id === cajaId) : undefined
      return c && c.ownerId === null ? { cajaId: c.id, emailAsignado: c.emailAsignado ?? null } : null
    },
    async reclamar(o) {
      const forzado = m.reclamarForzado.shift()
      if (forzado) return forzado
      const cajaId = m.codigosPreparadas.get(o.codigo)
      const c = cajaId ? m.cajas.find((x) => x.id === cajaId) : undefined
      if (!c || c.ownerId !== null) return { ok: false, motivo: 'codigo_invalido' }
      c.ownerId = o.ownerId
      c.nombre = o.nombre
      m.codigosPreparadas.delete(o.codigo)
      return { ok: true, cajaId: c.id }
    },
    async liberarCaja(id) {
      m.eventos.push('liberar')
      if (m.liberarFalla) throw new Error('boom')
      const c = m.cajas.find((x) => x.id === id)
      if (c) c.ownerId = null
      m.liberadas.push(id)
    },
    async listarTodasLasCajas(desde, limite) {
      return [...m.cajas].sort((a, b) => (b.creadaEn ?? '').localeCompare(a.creadaEn ?? '')).slice(desde, desde + limite)
    },
  }
  let t = 0
  let s = 0
  const deps: ClienteDeps = {
    store,
    now: () => ahora.t,
    env: { dominio: 'cajas.test', paseKeyPrivada: '', vinculoAbierto: opts.vinculoAbierto ?? true },
    cloudflare: {
      async crearTunel(slug) {
        m.eventos.push('crear')
        if (m.crearFalla) throw new Error('cf secreto-token-123')
        const tunnelId = `11111111-1111-4111-8111-${String(++t).padStart(12, '0')}`
        m.tunelesCreados.push({ tunnelId, slug })
        m.tunelesVivos.add(tunnelId)
        return { tunnelId, tunnelToken: 'TOKEN-SECRETO', hostname: `${slug}.cajas.test` }
      },
      async borrarTunel(tunnelId) {
        m.eventos.push('borrar')
        if (m.borrarFalla) throw new Error('boom')
        m.tunelesVivos.delete(tunnelId)
      },
    },
    nuevoSlug: () => 'slug' + String(++s).padStart(4, '0'),
  }
  return { m, deps }
}
