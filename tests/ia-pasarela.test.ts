// La pasarela de IA: autenticar la caja, frenar sin saldo o sobre el tope, llamar a Anthropic y cobrar lo consumido.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { atenderMensajes, consultarEstadoIa, type DepsIA } from '../app/lib/ia/pasarela.ts'
import { hashSecreto } from '../app/lib/cajas/secreto.ts'
import { crearDeps } from './cajas-mem.ts'

const T0 = new Date('2026-11-03T17:00:00Z')
const REG = '00000000-0000-4000-8000-000000000001'
const CAJA = 'caja-1'
const DUENO = 'dueno-1'
const SECRETO = 'secreto-de-la-caja-123'
const LLAVE = `${REG}.${SECRETO}`
const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'
const CUERPO = { model: HAIKU, max_tokens: 1024, system: 'PROMPT-SECRETO', messages: [{ role: 'user', content: 'MENSAJE-PRIVADO' }] }
const RESPUESTA = { id: 'msg_1', content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 1000, output_tokens: 100 } }

function entorno(o: { saldo?: number; bloqueada?: boolean; topeIa?: number; tope?: number; activa?: boolean; correo?: string } = {}) {
  const ahora = { t: new Date(T0) }
  const { m, deps: servicio } = crearDeps(ahora)
  m.cajas.push({ id: CAJA, slug: 's', tunnelId: 't', ownerId: DUENO })
  m.emails[DUENO] = o.correo ?? 'cliente@gmail.com'
  m.registros.push({ id: REG, codigo: 'AAAABBBB', secretoHash: hashSecreto(SECRETO), expiraEn: T0.toISOString(), version: '1', ip: 'x', estado: 'vinculada', cajaId: CAJA })
  const e = {
    m, ahora,
    saldo: o.saldo ?? 50,
    gastoIa: {} as Record<string, number>,
    gastoEstudio: 0,
    registros: [] as any[],
    llamadas: [] as any[],
    respuesta: RESPUESTA as unknown,
    fallo: null as null | { status?: number; message: string },
    registrarFalla: false,
  }
  const deps: DepsIA = {
    servicio,
    activa: o.activa ?? true,
    esAdmin: (c) => c === 'admin@trust.pe',
    anthropic: {
      async crear(params) {
        e.llamadas.push(params)
        if (e.fallo) throw Object.assign(new Error(e.fallo.message), { status: e.fallo.status })
        return e.respuesta
      },
    },
    store: {
      async estadoCaja() { return { bloqueada: o.bloqueada ?? false, topeIa: o.topeIa ?? 100, tope: o.tope ?? 100 } },
      async saldo() { return e.saldo },
      async gastoIaHoy(_c, _d, modelo) { return e.gastoIa[modelo] ?? 0 },
      async gastoEstudioHoy() { return e.gastoEstudio },
      async registrar(r) {
        if (e.registrarFalla) throw new Error('falla la base')
        e.registros.push(r)
        return { saldo: e.saldo, cobrados: 0 }
      },
    },
  }
  const pedir = (cuerpo: unknown = CUERPO, llave: string | null = LLAVE, ip = '1.2.3.4') => atenderMensajes(deps, { llave, ip, cuerpo })
  return { e, deps, pedir }
}
const tipo = (r: { body: object }) => (r.body as { error?: { type?: string } }).error?.type

test('llave ausente, mal formada o con secreto malo: 401 y no llama a Anthropic', async () => {
  const { e, pedir } = entorno()
  for (const mala of [null, '', 'sin-punto', `${REG}.`, `.${SECRETO}`, `no-uuid.${SECRETO}`, `${REG}.secreto-malo`]) {
    const r = await pedir(CUERPO, mala)
    assert.equal(r.status, 401, String(mala))
  }
  assert.equal(e.llamadas.length, 0)
})

test('caja bloqueada desde el panel: 401; caja sin dueño: 401', async () => {
  const a = entorno({ bloqueada: true })
  assert.equal((await a.pedir()).status, 401)
  assert.equal(a.e.llamadas.length, 0)
  const b = entorno()
  b.e.m.cajas[0].ownerId = null
  assert.equal((await b.pedir()).status, 401)
  assert.equal(b.e.llamadas.length, 0)
})

test('interruptor apagado: 503 sin llamar a Anthropic', async () => {
  const { e, pedir } = entorno({ activa: false })
  assert.equal((await pedir()).status, 503)
  assert.equal(e.llamadas.length, 0)
})

test('cuerpo que no es del asistente: 400 sin llamar a Anthropic', async () => {
  const { e, pedir } = entorno()
  assert.equal((await pedir({ ...CUERPO, model: 'claude-opus-5-5' })).status, 400)
  assert.equal(e.llamadas.length, 0)
})

test('sin saldo: 402 sin_saldo, sin llamar a Anthropic', async () => {
  const { e, pedir } = entorno({ saldo: 0 })
  const r = await pedir()
  assert.equal(r.status, 402)
  assert.equal(tipo(r), 'sin_saldo')
  assert.equal(e.llamadas.length, 0)
})

test('topes: chats con el suyo; video con el del Estudio; gastar en el Estudio no frena los chats', async () => {
  const chat = entorno({ topeIa: 10 })
  chat.e.gastoIa[HAIKU] = 10_000_000 // 10 créditos
  const r = await chat.pedir()
  assert.equal(r.status, 402)
  assert.equal(tipo(r), 'tope_diario')
  assert.equal((await chat.pedir({ ...CUERPO, model: SONNET })).status, 200, 'el tope de chats no frena el video')

  const estudio = entorno({ tope: 10 })
  estudio.e.gastoEstudio = 10
  assert.equal((await estudio.pedir()).status, 200, 'el gasto del Estudio no frena los chats')
  assert.equal(tipo(await estudio.pedir({ ...CUERPO, model: SONNET })), 'tope_diario')

  const video = entorno({ tope: 10 })
  video.e.gastoEstudio = 6
  video.e.gastoIa[SONNET] = 4_000_000
  assert.equal(tipo(await video.pedir({ ...CUERPO, model: SONNET })), 'tope_diario', 'Estudio y video suman')
  video.e.gastoIa[SONNET] = 3_999_999
  assert.equal((await video.pedir({ ...CUERPO, model: SONNET })).status, 200)
})

test('éxito: pasa solo lo permitido, devuelve la respuesta intacta y registra el consumo', async () => {
  const { e, pedir } = entorno()
  const r = await pedir({ ...CUERPO, temperature: 1, thinking: { type: 'enabled' } })
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, RESPUESTA)
  assert.deepEqual(Object.keys(e.llamadas[0]).sort(), ['max_tokens', 'messages', 'model', 'system'])
  assert.equal(e.registros.length, 1)
  const g = e.registros[0]
  assert.equal(g.cajaId, CAJA)
  assert.equal(g.userId, DUENO)
  assert.equal(g.dia, '2026-11-03')
  assert.equal(g.modelo, HAIKU)
  assert.equal(g.entrada, 1000)
  assert.equal(g.salida, 100)
  assert.equal(g.costoMicroUsd, 150) // 1000 × $0.10/M + 100 × $0.50/M
  assert.equal(g.microcreditos, 3750)
  assert.equal(g.cobrar, true)
  assert.match(g.ipHash, /^[0-9a-f]{64}$/)
  assert.ok(!JSON.stringify(g).includes('1.2.3.4'), 'no guarda la IP')
})

test('el día es el de Lima: a las 3 a. m. UTC todavía es el día anterior', async () => {
  const { e, pedir } = entorno()
  e.ahora.t = new Date('2026-11-04T03:00:00Z')
  await pedir()
  assert.equal(e.registros[0].dia, '2026-11-03')
})

test('cuenta administradora: pasa sin saldo y sin topes, y registra sin cobrar', async () => {
  const { e, pedir } = entorno({ saldo: 0, topeIa: 0, correo: 'admin@trust.pe' })
  assert.equal((await pedir()).status, 200)
  assert.equal(e.registros[0].cobrar, false)
})

test('Anthropic con 429 o 500: mismo estado a la caja, sin cobrar y sin copiar su texto de error', async () => {
  for (const status of [429, 500, 529]) {
    const { e, pedir } = entorno()
    e.fallo = { status, message: 'detalle interno de la cuenta sk-ant-xxx' }
    const r = await pedir()
    assert.equal(r.status, status)
    assert.ok(!JSON.stringify(r.body).includes('sk-ant'), 'no filtra detalles')
    assert.equal(e.registros.length, 0)
  }
  const red = entorno()
  red.e.fallo = { message: 'ECONNRESET' }
  assert.equal((await red.pedir()).status, 502)
})

test('llave del negocio vencida o sin permiso: 502 a la caja, no 401: el problema no es de la caja', async () => {
  for (const status of [401, 403, 404]) {
    const { e, pedir } = entorno()
    e.fallo = { status, message: 'invalid x-api-key' }
    const r = await pedir()
    assert.equal(r.status, 502, String(status))
    assert.equal(tipo(r), 'api_error')
  }
})

test('foco: Anthropic respondió pero el cobro falló: la caja recibe su respuesta y el registro no lleva la conversación', async (t) => {
  const { e, pedir } = entorno()
  e.registrarFalla = true
  const escrito: string[] = []
  t.mock.method(console, 'error', (...a: unknown[]) => { escrito.push(a.map(String).join(' ')) })
  const r = await pedir()
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, RESPUESTA)
  assert.ok(escrito.length > 0, 'deja rastro del fallo')
  assert.ok(escrito.every((l) => !l.includes('MENSAJE-PRIVADO') && !l.includes('PROMPT-SECRETO')))
})

test('nunca escribe la conversación en los registros, ni siquiera cuando falla', async (t) => {
  const escrito: string[] = []
  for (const m of ['log', 'info', 'warn', 'error'] as const) t.mock.method(console, m, (...a: unknown[]) => { escrito.push(a.map(String).join(' ')) })
  const a = entorno()
  await a.pedir()
  const b = entorno()
  b.e.fallo = { status: 500, message: 'x' }
  await b.pedir()
  assert.ok(escrito.every((l) => !l.includes('MENSAJE-PRIVADO') && !l.includes('PROMPT-SECRETO')))
})

test('sin usage en la respuesta: no rompe y registra cero', async () => {
  const { e, pedir } = entorno()
  e.respuesta = { id: 'x', content: [] }
  assert.equal((await pedir()).status, 200)
  assert.equal(e.registros[0].microcreditos, 0)
})

test('consultarEstadoIa: dice si puede y por qué no; con llave mala 401', async () => {
  const bien = entorno({ saldo: 7 })
  assert.deepEqual((await consultarEstadoIa(bien.deps, { llave: LLAVE })).body, { puede: true, motivo: 'ok', saldo: 7 })
  const sin = entorno({ saldo: 0 })
  assert.deepEqual((await consultarEstadoIa(sin.deps, { llave: LLAVE })).body, { puede: false, motivo: 'sin_saldo', saldo: 0 })
  const tope = entorno({ topeIa: 1 })
  tope.e.gastoIa[HAIKU] = 1_000_000
  assert.deepEqual((await consultarEstadoIa(tope.deps, { llave: LLAVE })).body, { puede: false, motivo: 'tope_diario', saldo: 50 })
  assert.equal((await consultarEstadoIa(bien.deps, { llave: 'mala' })).status, 401)
  assert.equal((await consultarEstadoIa(entorno({ bloqueada: true }).deps, { llave: LLAVE })).status, 401)
  assert.equal((await consultarEstadoIa(entorno({ activa: false }).deps, { llave: LLAVE })).status, 503)
})
