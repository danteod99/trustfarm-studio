import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  captionDe, costoTrabajo, ejecutarVuelta, limaDia, migracionMarcoPendiente, opcionesMarco, recogerRun, refCobro, runKeyPerfil, validarConfig,
  type Candidato, type DepsRecoger, type DepsVuelta, type EntregaNueva, type JobParaRecoger, type ToolLoop, type ToolRun,
} from '../app/lib/bucles-core.ts'

const NOW = new Date('2026-11-17T14:05:00Z') // 09:05 en Lima, martes
const PRECIOS = { clips: 5, clipsVariacion: 8, perfil: 3, perfilVariacion: 5 }

function loop(over: Partial<ToolLoop> = {}): ToolLoop {
  return {
    id: 'L1', owner: 'U1', site: 'studio', tool: 'multiclip', name: 'x', params: { kind: 'channel' }, variacion: null, pantalla: null, estilo: null,
    days: [0, 1, 2, 3, 4, 5, 6], hora: 9, minuto: 0, daily_cap: 2, max_per_run: 2, status: 'active', last_error: null,
    consecutive_failures: 0, next_run_at: NOW.toISOString(), last_run_at: null, cursor: {}, ...over,
  }
}

/** Mundo en memoria para ejecutarVuelta. */
function mundo(opts: { cands?: Candidato[]; saldo?: number; hoy?: number; encolarFalla?: boolean; fuenteFalla?: boolean } = {}) {
  const runs = new Map<string, ToolRun>()
  const cobros: Array<{ ref: string; n: number }> = []
  const reembolsos: Array<{ ref: string; n: number }> = []
  const ledger = new Set<string>()
  let saldo = opts.saldo ?? 100
  let ids = 0
  const bucle: Record<string, unknown> = {}
  const deps: DepsVuelta = {
    contarHoy: async () => opts.hoy ?? [...runs.values()].filter((r) => r.status !== 'failed' && r.status !== 'empty').length,
    candidatos: async (_l, _d, lim) => {
      if (opts.fuenteFalla) throw new Error('feed caído')
      return (opts.cands ?? []).slice(0, lim)
    },
    reservarRun: async (l, c, _d, credits, ref) => {
      const k = `${l.id}|${c.runKey}`
      const ex = runs.get(k)
      if (ex) return { run: ex, nueva: false }
      const run: ToolRun = { id: `R${++ids}`, loop_id: l.id, owner: l.owner, run_key: c.runKey, source_ref: c.sourceRef, job_id: null, status: 'creating', credits, cobro_ref: ref }
      runs.set(k, run)
      return { run, nueva: true }
    },
    liberarRun: async (id) => { for (const [k, r] of runs) if (r.id === id) runs.delete(k) },
    yaCobrado: async (_o, ref) => ledger.has(ref),
    cobrar: async (_o, n, ref) => {
      if (saldo < n) return { ok: false, sinSaldo: true, error: 'insuficiente' }
      saldo -= n; ledger.add(ref); cobros.push({ ref, n })
      return { ok: true }
    },
    encolar: async (_l, c) => {
      if (opts.encolarFalla) throw new Error('railway caído')
      return { jobId: `J-${c.runKey}` }
    },
    reembolsar: async (_o, n, ref) => { saldo += n; reembolsos.push({ ref, n }) },
    marcarRun: async (id, p) => { for (const r of runs.values()) if (r.id === id) Object.assign(r, p) },
    guardarBucle: async (_id, p) => { Object.assign(bucle, p) },
  }
  return { deps, runs, cobros, reembolsos, bucle, saldo: () => saldo }
}

const cands = (...ids: string[]): Candidato[] => ids.map((id) => ({ runKey: id, sourceRef: id, nombre: id }))

test('validarConfig: normaliza horario, topes y fuerza 1 trabajo por vuelta en perfil', () => {
  const r = validarConfig('perfil', { days: [1, 1, 3, 9, 'x'], hora: 30, minuto: -4, daily_cap: 99, max_per_run: 4, variacion: 'pantalla_real', pantalla: 'tv' })
  assert.ok(r.ok)
  if (r.ok) {
    assert.deepEqual(r.value.days, [1, 3])
    assert.equal(r.value.hora, 23)
    assert.equal(r.value.minuto, 0)
    assert.equal(r.value.daily_cap, 5) // no admin
    assert.equal(r.value.max_per_run, 1)
    assert.equal(r.value.pantalla, 'tv')
  }
  const sin = validarConfig('multiclip', { days: [] })
  assert.equal(sin.ok, false)
  const m = validarConfig('multiclip', { max_per_run: 9, pantalla: 'tv' })
  if (m.ok) { assert.equal(m.value.max_per_run, 5); assert.equal(m.value.pantalla, null) } // pantalla solo con variación
  const adm = validarConfig('multiclip', { daily_cap: 50 }, true)
  if (adm.ok) assert.equal(adm.value.daily_cap, 10)
})

test('costoTrabajo y límites de Lima', () => {
  assert.equal(costoTrabajo('perfil', null, PRECIOS, false), 3)
  assert.equal(costoTrabajo('perfil', 'pantalla_real', PRECIOS, false), 5)
  assert.equal(costoTrabajo('multiclip', null, PRECIOS, false), 5)
  assert.equal(costoTrabajo('multiclip', 'pantalla_real', PRECIOS, false), 8)
  assert.equal(costoTrabajo('multiclip', 'pantalla_real', PRECIOS, true), 0)
  assert.equal(limaDia(new Date('2026-11-17T04:59:00Z')), '2026-11-16') // 23:59 del 16 en Lima
  assert.equal(limaDia(new Date('2026-11-17T05:00:00Z')), '2026-11-17')
  assert.equal(runKeyPerfil('2026-11-17', 9, 5), '2026-11-17@09:05')
})

test('vuelta normal: cobra ANTES de encolar, una vez por trabajo, y calcula la próxima vuelta (mañana 09:00 Lima)', async () => {
  const w = mundo({ cands: cands('a', 'b') })
  const orden: string[] = []
  const enc = w.deps.encolar
  w.deps.encolar = async (...a) => { orden.push(`encolar:${w.cobros.length}`); return enc(...a) }
  const r = await ejecutarVuelta(loop(), w.deps, NOW, 5)
  assert.deepEqual(r, { lanzados: 2, fallos: 0, motivo: 'ok' })
  assert.deepEqual(w.cobros.map((c) => c.ref), [refCobro('L1', 'a'), refCobro('L1', 'b')])
  assert.deepEqual(orden, ['encolar:1', 'encolar:2']) // cuando se encola el 1º ya hay 1 cobro; el 2º, 2
  assert.equal(w.saldo(), 90)
  assert.equal(w.bucle.next_run_at, '2026-11-18T14:00:00.000Z')
  assert.equal(w.bucle.last_error, null)
  assert.ok([...w.runs.values()].every((x) => x.status === 'running' && x.job_id))
})

test('tope diario: si ya se llegó, no cobra ni encola; y recorta max_per_run al cupo que queda', async () => {
  const a = mundo({ cands: cands('a'), hoy: 2 })
  const r1 = await ejecutarVuelta(loop(), a.deps, NOW, 5)
  assert.equal(r1.motivo, 'tope_diario')
  assert.equal(a.cobros.length, 0)
  assert.equal(a.bucle.next_run_at, '2026-11-18T14:00:00.000Z')
  const b = mundo({ cands: cands('a', 'b', 'c'), hoy: 1 })
  const r2 = await ejecutarVuelta(loop({ max_per_run: 5 }), b.deps, NOW, 5)
  assert.equal(r2.lanzados, 1) // cap 2, ya hubo 1
})

test('sin saldo: libera la reserva (el video no se quema), pausa a no_credits y corta', async () => {
  const w = mundo({ cands: cands('a', 'b'), saldo: 7 })
  const r = await ejecutarVuelta(loop(), w.deps, NOW, 5)
  assert.equal(r.lanzados, 1) // alcanzó para el primero
  assert.equal(r.motivo, 'sin_saldo')
  assert.equal(w.bucle.status, 'no_credits')
  assert.match(String(w.bucle.last_error), /Sin créditos/)
  assert.equal(w.runs.has('L1|b'), false) // la reserva del 2º se liberó: se podrá reintentar al reanudar
  assert.equal(w.runs.has('L1|a'), true)
})

test('idempotencia: repetir la misma vuelta (reclamo vencido) no cobra ni encola dos veces', async () => {
  const w = mundo({ cands: cands('a') })
  await ejecutarVuelta(loop(), w.deps, NOW, 5)
  await ejecutarVuelta(loop(), w.deps, NOW, 5)
  assert.equal(w.cobros.length, 1)
  assert.equal(w.runs.size, 1)
  assert.equal(w.saldo(), 95)
})

test('reintento tras caída entre reservar y encolar: reanuda sin volver a cobrar si el libro ya tiene el ref', async () => {
  const w = mundo({ cands: cands('a') })
  // Estado dejado por un tick que murió después de cobrar: run en "creating" y ref ya en el libro.
  const run: ToolRun = { id: 'R9', loop_id: 'L1', owner: 'U1', run_key: 'a', source_ref: 'a', job_id: null, status: 'creating', credits: 5, cobro_ref: refCobro('L1', 'a') }
  w.runs.set('L1|a', run)
  const antes = w.saldo()
  await w.deps.cobrar('U1', 5, refCobro('L1', 'a'))
  const r = await ejecutarVuelta(loop(), w.deps, NOW, 5)
  assert.equal(r.lanzados, 1)
  assert.equal(w.cobros.length, 1) // solo el de la preparación del test
  assert.equal(w.saldo(), antes - 5)
  assert.equal(run.status, 'running')
})

test('encolar falla: reembolsa con el mismo ref, la vuelta queda failed y cuenta un fallo', async () => {
  const w = mundo({ cands: cands('a'), encolarFalla: true })
  const r = await ejecutarVuelta(loop({ consecutive_failures: 0 }), w.deps, NOW, 5)
  assert.equal(r.fallos, 1)
  assert.deepEqual(w.reembolsos, [{ ref: refCobro('L1', 'a'), n: 5 }])
  assert.equal(w.saldo(), 100)
  assert.equal(w.runs.get('L1|a')?.status, 'failed')
  assert.equal(w.bucle.consecutive_failures, 1)
  assert.equal(w.bucle.status, 'active')
})

test('pausa tras 3 fallos seguidos (los acumulados cuentan)', async () => {
  const w = mundo({ cands: cands('a'), encolarFalla: true })
  const r = await ejecutarVuelta(loop({ consecutive_failures: 2 }), w.deps, NOW, 5)
  assert.equal(r.motivo, 'pausado_por_fallos')
  assert.equal(w.bucle.status, 'error')
  assert.equal(w.bucle.consecutive_failures, 3)
})

test('fuente caída (feed): no cobra, suma fallo, y a la 3ª pasa a error', async () => {
  const w = mundo({ fuenteFalla: true })
  const r = await ejecutarVuelta(loop({ consecutive_failures: 2 }), w.deps, NOW, 5)
  assert.equal(r.motivo, 'pausado_por_fallos')
  assert.equal(w.cobros.length, 0)
  assert.equal(w.bucle.status, 'error')
  assert.match(String(w.bucle.last_error), /feed caído/)
})

test('sin novedades: no cobra, avanza el reloj y limpia el error', async () => {
  const w = mundo({ cands: [] })
  const r = await ejecutarVuelta(loop({ last_error: 'viejo' }), w.deps, NOW, 5)
  assert.equal(r.motivo, 'sin_novedades')
  assert.equal(w.bucle.last_error, null)
  assert.equal(w.bucle.next_run_at, '2026-11-18T14:00:00.000Z')
})

test('admin (costo 0): no toca la billetera', async () => {
  const w = mundo({ cands: cands('a') })
  await ejecutarVuelta(loop(), w.deps, NOW, 0)
  assert.equal(w.cobros.length, 0)
  assert.equal(w.runs.get('L1|a')?.status, 'running')
})

test('link de un solo video: se procesa una vez y el bucle queda en pausa', async () => {
  const w = mundo({ cands: cands('a') })
  const r = await ejecutarVuelta(loop({ params: { kind: 'video' } }), w.deps, NOW, 5)
  assert.equal(r.motivo, 'video_unico')
  assert.equal(w.bucle.status, 'paused')
})

// ───────── recogerRun ─────────

function recogida(over: { existentes?: string[]; falla?: string } = {}) {
  const copias: Array<[string, string]> = []
  const textos = new Map<string, string>()
  const entregas: EntregaNueva[] = []
  const reembolsos: string[] = []
  const runs: Record<string, unknown> = {}
  const bucle: Record<string, unknown> = {}
  const deps: DepsRecoger = {
    refsExistentes: async (_l, refs) => new Set(refs.filter((r) => (over.existentes ?? []).includes(r))),
    copiar: async (d, h) => { if (over.falla) throw new Error(over.falla); copias.push([d, h]) },
    subirTexto: async (p, t) => { textos.set(p, t) },
    insertarEntrega: async (e) => { if (entregas.some((x) => x.source_ref === e.source_ref)) return false; entregas.push(e); return true },
    reembolsar: async (_o, _n, ref) => { reembolsos.push(ref) },
    marcarRun: async (_id, p) => { Object.assign(runs, p) },
    guardarBucle: async (_id, p) => { Object.assign(bucle, p) },
  }
  return { deps, copias, textos, entregas, reembolsos, runs, bucle }
}
const run = (over: Partial<ToolRun> = {}): ToolRun => ({ id: 'R1', loop_id: 'L1', owner: 'U1', run_key: 'vid1', source_ref: 'vid1', job_id: 'J1', status: 'running', credits: 5, cobro_ref: 'loop:L1:vid1', ...over })
const listo = (clips: JobParaRecoger['result']): JobParaRecoger => ({ id: 'J1', status: 'listo', error: null, result: clips })

test('recoger: copia cada clip a deliveries/ con .txt gemelo, resetea fallos y guarda lo visto', async () => {
  const r = recogida()
  const job = listo({ clips: [
    { index: 1, file: 'out/J1/01.mp4', titulo: 'Titulo 1', hook: 'Gancho' },
    { index: 2, file: 'out/J1/02.mp4', titulo: 'Titulo 2', hook: '' },
  ] })
  const fin = await recogerRun(loop({ consecutive_failures: 2 }), run(), job, r.deps, NOW)
  assert.equal(fin, true)
  assert.deepEqual(r.copias, [['out/J1/01.mp4', 'deliveries/U1/L1/vid1_1.mp4'], ['out/J1/02.mp4', 'deliveries/U1/L1/vid1_2.mp4']])
  assert.equal(r.textos.get('deliveries/U1/L1/vid1_1.txt'), 'Titulo 1\nGancho')
  assert.equal(r.entregas.length, 2)
  assert.equal(r.entregas[0].expires_at, '2026-11-24T14:05:00.000Z') // 7 días
  assert.equal(r.runs.status, 'done')
  assert.equal(r.bucle.consecutive_failures, 0)
  assert.deepEqual((r.bucle.cursor as { seen: string[] }).seen, ['vid1'])
  assert.equal(r.reembolsos.length, 0)
})

test('recoger perfil: source_ref = id de TikTok, caption = el del video, y se marcan como vistos', async () => {
  const r = recogida()
  const l = loop({ tool: 'perfil', params: { handle: 'x' } })
  const job = listo({ clips: [{ index: 1, file: 'out/J1/01.mp4', tiktok_id: '7300000000000000001', caption: 'mi caption #fyp', titulo: 'otro' }] })
  await recogerRun(l, run({ run_key: '2026-11-17@09:00', source_ref: '@x' }), job, r.deps, NOW)
  assert.equal(r.entregas[0].source_ref, '7300000000000000001')
  assert.equal(r.entregas[0].caption, 'mi caption #fyp')
  assert.deepEqual((r.bucle.cursor as { seen: string[] }).seen, ['7300000000000000001'])
})

test('recoger: nada nuevo (todo repetido) = reembolso completo, vuelta empty y NO es fallo', async () => {
  const r = recogida({ existentes: ['7300000000000000001'] })
  const l = loop({ tool: 'perfil', consecutive_failures: 1 })
  const job = listo({ clips: [{ index: 1, file: 'out/J1/01.mp4', tiktok_id: '7300000000000000001' }] })
  await recogerRun(l, run({ run_key: 'k' }), job, r.deps, NOW)
  assert.equal(r.runs.status, 'empty')
  assert.deepEqual(r.reembolsos, ['loop:L1:vid1'])
  assert.equal(r.entregas.length, 0)
  assert.equal(r.bucle.consecutive_failures, undefined) // no se toca
  assert.equal(r.bucle.last_error, null)
})

test('recoger: job con error = reembolso, run failed, +1 fallo; el 3º pausa el bucle; el video roto no se reintenta', async () => {
  const r = recogida()
  const job: JobParaRecoger = { id: 'J1', status: 'error', error: 'YouTube bloqueó la descarga', result: null }
  await recogerRun(loop({ consecutive_failures: 2 }), run(), job, r.deps, NOW)
  assert.equal(r.runs.status, 'failed')
  assert.deepEqual(r.reembolsos, ['loop:L1:vid1'])
  assert.equal(r.bucle.consecutive_failures, 3)
  assert.equal(r.bucle.status, 'error')
  assert.deepEqual((r.bucle.cursor as { seen: string[] }).seen, ['vid1'])
})

test('recoger: trabajo borrado o expirado cuenta como fallo con reembolso; en curso devuelve false', async () => {
  const a = recogida()
  assert.equal(await recogerRun(loop(), run(), null, a.deps, NOW), true)
  assert.equal(a.runs.status, 'failed')
  const b = recogida()
  assert.equal(await recogerRun(loop(), run(), { id: 'J1', status: 'procesando', error: null, result: null }, b.deps, NOW), false)
  assert.equal(b.reembolsos.length, 0)
  const c = recogida()
  assert.equal(await recogerRun(loop(), run(), { id: 'J1', status: 'listo', error: null, result: { clips: [] }, expired: true }, c.deps, NOW), true)
  assert.equal(c.runs.status, 'failed')
})

test('recoger: si la copia falla en todos los clips = fallo con reembolso (no entregas fantasma)', async () => {
  const r = recogida({ falla: 'storage 500' })
  const job = listo({ clips: [{ index: 1, file: 'out/J1/01.mp4', titulo: 't' }] })
  await recogerRun(loop(), run(), job, r.deps, NOW)
  assert.equal(r.runs.status, 'failed')
  assert.equal(r.entregas.length, 0)
  assert.equal(r.reembolsos.length, 1)
})

test('captionDe: caption propio > título + gancho', () => {
  assert.equal(captionDe({ index: 1, file: 'f', caption: ' hola ', titulo: 't' }), 'hola')
  assert.equal(captionDe({ index: 1, file: 'f', titulo: 't', hook: 'h' }), 't\nh')
  assert.equal(captionDe({ index: 1, file: 'f' }), '')
})

test('validarConfig: variación marco con estilo en lista blanca y sin pantalla', () => {
  const r = validarConfig('perfil', { variacion: 'marco', estilo: 'color', pantalla: 'tv' })
  assert.ok(r.ok)
  if (r.ok) { assert.equal(r.value.variacion, 'marco'); assert.equal(r.value.estilo, 'color'); assert.equal(r.value.pantalla, null) }
  const raro = validarConfig('perfil', { variacion: 'marco', estilo: 'zzz' })
  if (raro.ok) assert.equal(raro.value.estilo, 'mixto')
  const pr = validarConfig('perfil', { variacion: 'pantalla_real', pantalla: 'tv', estilo: 'blur' })
  if (pr.ok) { assert.equal(pr.value.estilo, null); assert.equal(pr.value.pantalla, 'tv') } // pantalla_real intacto
  const ninguna = validarConfig('multiclip', { estilo: 'blur' })
  if (ninguna.ok) { assert.equal(ninguna.value.variacion, null); assert.equal(ninguna.value.estilo, null) }
  assert.equal(costoTrabajo('perfil', 'marco', PRECIOS, false), 5)
})

test('opcionesMarco: perfil usa estilo, multiclip marco_estilo (su estilo ya es el de subtítulos)', () => {
  assert.deepEqual(opcionesMarco({ tool: 'perfil', estilo: 'blur' }), { estilo: 'blur' })
  assert.deepEqual(opcionesMarco({ tool: 'multiclip', estilo: 'marco' }), { marco_estilo: 'marco' })
  assert.deepEqual(opcionesMarco({ tool: 'perfil' }), { estilo: 'mixto' }) // sin migración 09: columna ausente
  assert.deepEqual(opcionesMarco({ tool: 'perfil', estilo: 'x' as never }), { estilo: 'mixto' })
})

test('migracionMarcoPendiente: reconoce columna/CHECK ausentes y no otros errores', () => {
  assert.equal(migracionMarcoPendiente({ code: '23514', message: 'violates check constraint "tool_loops_variacion_check"' }), true)
  assert.equal(migracionMarcoPendiente({ code: '42703', message: 'column "estilo" of relation "tool_loops" does not exist' }), true)
  assert.equal(migracionMarcoPendiente({ code: 'PGRST204', message: "Could not find the 'estilo' column of 'tool_loops' in the schema cache" }), true)
  assert.equal(migracionMarcoPendiente({ code: '23505', message: 'duplicate key' }), false)
  assert.equal(migracionMarcoPendiente(null), false)
})
