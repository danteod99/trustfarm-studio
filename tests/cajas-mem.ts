// Almacén en memoria simulado para las pruebas del servicio de cajas (no es una prueba).
import type { CajasStore, ServicioDeps } from '../app/lib/cajas/servicio.ts'

export interface Reg { id: string; codigo: string; secretoHash: string; expiraEn: string; version: string; ip: string; estado: string; cajaId: string | null }
export interface CajaMem { id: string; slug: string; tunnelId: string; ownerId: string | null }

export function crearMem(reloj: () => Date = () => new Date()) {
  const m = {
    intentos: [] as { clave: string; creado: string }[],
    registros: [] as Reg[],
    cajas: [] as CajaMem[],
    emails: {} as Record<string, string>,
    toques: [] as { cajaId: string; version: string; ahora: string }[],
    limpiezas: [] as string[],
    forzarDuplicados: 0,
    intentosCrear: 0,
    fallaLimpieza: false,
    emailLookups: 0,
    // Caja de fábrica: llaves de activación (solo hash) y cuántas veces se llegó al almacén a activar
    activaciones: [] as { cajaId: string; llaveHash: string; venceEn: string; usadaEn?: string }[],
    activarLlamadas: 0,
  }
  const store: CajasStore = {
    async contarIntentos(clave, desdeIso) { return m.intentos.filter(i => i.clave === clave && i.creado >= desdeIso).length },
    async registrarIntento(clave) { m.intentos.push({ clave, creado: reloj().toISOString() }) },
    async crearRegistro(r) {
      m.intentosCrear++
      if (m.forzarDuplicados > 0) { m.forzarDuplicados--; return 'codigo_duplicado' }
      if (m.registros.some(x => x.codigo === r.codigo)) return 'codigo_duplicado'
      const id = `00000000-0000-4000-8000-${String(m.registros.length + 1).padStart(12, '0')}`
      m.registros.push({ id, codigo: r.codigo, secretoHash: r.secretoHash, expiraEn: r.expiraEn, version: r.version, ip: r.ip, estado: 'pendiente', cajaId: null })
      return { id }
    },
    async buscarRegistro(id) {
      const r = m.registros.find(x => x.id === id)
      return r ? { id: r.id, secretoHash: r.secretoHash, estado: r.estado as 'pendiente' | 'vinculada' | 'desvinculada', expiraEn: r.expiraEn, cajaId: r.cajaId, codigo: r.codigo || null } : null
    },
    async obtenerCaja(id) { return m.cajas.find(c => c.id === id) ?? null },
    async activar(o) {
      m.activarLlamadas++
      const ahoraIso = reloj().toISOString()
      const a = m.activaciones.find(x => x.llaveHash === o.llaveHash && !x.usadaEn && x.venceEn > ahoraIso)
      if (!a) return 'llave_invalida'
      if (m.registros.some(x => x.codigo === o.codigo && x.cajaId !== a.cajaId)) return 'codigo_duplicado'
      a.usadaEn = ahoraIso
      let reg = m.registros.find(x => x.cajaId === a.cajaId)
      if (reg) {
        Object.assign(reg, { secretoHash: o.secretoHash, codigo: o.codigo, expiraEn: o.expiraEn, estado: 'vinculada', version: o.version, ip: o.ip })
      } else {
        const id = `00000000-0000-4000-8000-${String(m.registros.length + 1).padStart(12, '0')}`
        reg = { id, codigo: o.codigo, secretoHash: o.secretoHash, expiraEn: o.expiraEn, version: o.version, ip: o.ip, estado: 'vinculada', cajaId: a.cajaId }
        m.registros.push(reg)
      }
      return { registroId: reg.id, cajaId: a.cajaId }
    },
    async nuevoCodigo(registroId, codigo, expiraEn) {
      const reg = m.registros.find(x => x.id === registroId)
      const caja = reg?.cajaId ? m.cajas.find(c => c.id === reg.cajaId) : undefined
      if (!reg || !caja || caja.ownerId !== null) return false
      if (m.registros.some(x => x.codigo === codigo && x.id !== reg.id)) return 'codigo_duplicado'
      reg.codigo = codigo
      reg.expiraEn = expiraEn
      return true
    },
    async obtenerEmailDueno(o) { m.emailLookups++; return m.emails[o] ?? null },
    async tocarCaja(cajaId, version, ahora) { m.toques.push({ cajaId, version, ahora }) },
    async borrarRegistrosVencidos(antes) { if (m.fallaLimpieza) throw new Error('boom'); m.limpiezas.push('r:' + antes) },
    async borrarIntentosViejos(antes) { if (m.fallaLimpieza) throw new Error('boom'); m.limpiezas.push('i:' + antes) },
  }
  return { m, store }
}

export function crearDeps(ahora: { t: Date }) {
  const { m, store } = crearMem(() => ahora.t)
  const deps: ServicioDeps = {
    store,
    now: () => ahora.t,
    env: { dominio: 'cajas.test', paseKeyPublica: 'PUBKEY' },
    cloudflare: { obtenerTokenTunel: async (t: string) => 'tok-' + t },
  }
  return { m, deps }
}
