// Almacén y Cloudflare simulados en memoria para las pruebas del lado cliente (no es una prueba).
import type { CajaCliente, ClienteDeps, ClienteStore, ResultadoVincular } from '../app/lib/cajas/cliente-servicio.ts'

export function crearClienteMem(ahora: { t: Date }) {
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
  }
  let n = 0
  const store: ClienteStore = {
    async contarFallosVincular(userId, desde) { return m.fallos.filter(f => f.userId === userId && f.creado >= desde).length },
    async registrarFalloVincular(userId) { m.fallos.push({ userId, creado: ahora.t.toISOString() }) },
    async contarCajas(o) { return m.cajas.filter(c => c.ownerId === o).length },
    async contarExitosVincular(userId, desde) { return m.exitos.filter(f => f.userId === userId && f.creado >= desde).length },
    async registrarExitoVincular(userId) { m.exitos.push({ userId, creado: ahora.t.toISOString() }) },
    async buscarRegistroVinculable(c) { return m.vinculables.has(c) ? { id: 'reg-' + c } : null },
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
    async listarTodasLasCajas(desde, limite) {
      return [...m.cajas].sort((a, b) => (b.creadaEn ?? '').localeCompare(a.creadaEn ?? '')).slice(desde, desde + limite)
    },
  }
  let t = 0
  let s = 0
  const deps: ClienteDeps = {
    store,
    now: () => ahora.t,
    env: { dominio: 'cajas.test', paseKeyPrivada: '' },
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
