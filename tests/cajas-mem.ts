// Almacén en memoria simulado para las pruebas del servicio de cajas (no es una prueba).
import type { CajasStore, ServicioDeps } from '../app/lib/cajas/servicio.ts'

export interface Reg { id: string; codigo: string; secretoHash: string; expiraEn: string; version: string; ip: string; estado: string; cajaId: string | null }
export interface CajaMem { id: string; slug: string; tunnelId: string; ownerId: string }

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
      return r ? { id: r.id, secretoHash: r.secretoHash, estado: r.estado as 'pendiente' | 'vinculada' | 'desvinculada', expiraEn: r.expiraEn, cajaId: r.cajaId } : null
    },
    async obtenerCaja(id) { return m.cajas.find(c => c.id === id) ?? null },
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
