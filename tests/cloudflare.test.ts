import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearCloudflare } from '../app/lib/cloudflare.ts'

const TOKEN_API = 'cf-api-token-SECRETO-123'
const TOKEN_TUNEL = 'tunel-token-SECRETO-456'
const env = { token: TOKEN_API, accountId: 'acc1', zoneId: 'zone1', dominio: 'cajas.ejemplo.test' }
const BASE = 'https://api.cloudflare.com/client/v4'

type Llamada = { method: string; url: string; headers: Record<string, string>; body: unknown }
type Resp = { status?: number; body?: unknown } | Error

function ok(result: unknown): Resp { return { status: 200, body: { success: true, errors: [], messages: [], result } } }
function falla(status: number, code = 1000, message = 'malo'): Resp {
  return { status, body: { success: false, errors: [{ code, message }], messages: [], result: null } }
}

// fetch simulado con cola de respuestas; sin respuestas => la prueba falla (nunca hay red real)
function simulado(cola: Resp[]) {
  const llamadas: Llamada[] = []
  const fetchFn = (async (url: any, init: any = {}) => {
    llamadas.push({
      method: init.method ?? 'GET',
      url: String(url),
      headers: init.headers ?? {},
      body: init.body ? JSON.parse(init.body) : undefined,
    })
    const r = cola.shift()
    if (!r) throw new Error('TEST: fetch simulado sin respuestas en cola (llamada inesperada)')
    if (r instanceof Error) throw r
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch
  return { fetchFn, llamadas, cola }
}

const resumen = (l: Llamada[]) => l.map((c) => `${c.method} ${c.url.replace(BASE, '')}`)

function espiarLogs() {
  const msgs: string[] = []
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
  for (const k of Object.keys(orig) as (keyof typeof orig)[]) console[k] = (...a: unknown[]) => { msgs.push(a.map(String).join(' ')) }
  return { msgs, restaurar: () => Object.assign(console, orig) }
}

test('crearTunel: túnel, configuración, DNS, token en orden con método, ruta y cuerpo exactos', async () => {
  const s = simulado([ok({ id: 'tun-1' }), ok({ version: 1 }), ok({ id: 'dns-1' }), ok(TOKEN_TUNEL)])
  const cf = crearCloudflare(env, s.fetchFn)
  const r = await cf.crearTunel('abril')
  assert.deepEqual(r, { tunnelId: 'tun-1', tunnelToken: TOKEN_TUNEL, hostname: 'abril.cajas.ejemplo.test' })
  assert.deepEqual(resumen(s.llamadas), [
    'POST /accounts/acc1/cfd_tunnel',
    'PUT /accounts/acc1/cfd_tunnel/tun-1/configurations',
    'POST /zones/zone1/dns_records',
    'GET /accounts/acc1/cfd_tunnel/tun-1/token',
  ])
  const [t, c, d, k] = s.llamadas
  assert.deepEqual(t.body, { name: 'caja-abril', config_src: 'cloudflare' })
  assert.deepEqual(c.body, {
    config: { ingress: [{ hostname: 'abril.cajas.ejemplo.test', service: 'http://localhost:8080' }, { service: 'http_status:404' }] },
  })
  assert.deepEqual(d.body, { type: 'CNAME', name: 'abril.cajas.ejemplo.test', content: 'tun-1.cfargotunnel.com', proxied: true })
  assert.equal(k.body, undefined)
  for (const l of s.llamadas) {
    assert.equal(l.headers['Authorization'], `Bearer ${TOKEN_API}`)
  }
  assert.equal(s.cola.length, 0)
})

test('crearTunel: si la configuración falla borra el túnel y lanza el error original', async () => {
  const s = simulado([ok({ id: 'tun-1' }), falla(400, 1001, 'config mala'), ok({ id: 'tun-1' })])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril'), /configurar/)
  assert.deepEqual(resumen(s.llamadas).slice(2), ['DELETE /accounts/acc1/cfd_tunnel/tun-1'])
  assert.equal(s.llamadas.length, 3)
})

test('crearTunel: si el DNS falla borra el túnel; si el rollback falla no tapa el error original', async () => {
  const s = simulado([ok({ id: 'tun-1' }), ok({}), falla(409, 81057, 'ya existe'), falla(500), falla(500)])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril'), (e: Error) => /DNS/.test(e.message) && /409/.test(e.message) && !/borrar/.test(e.message))
  assert.ok(resumen(s.llamadas).includes('DELETE /accounts/acc1/cfd_tunnel/tun-1'))
})

test('crearTunel: si el token falla borra DNS creado y túnel', async () => {
  const s = simulado([ok({ id: 'tun-1' }), ok({}), ok({ id: 'dns-1' }), falla(500), ok({ id: 'dns-1' }), ok({}), ok({})])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril'), /token/)
  const r = resumen(s.llamadas).slice(4)
  assert.ok(r.includes('DELETE /zones/zone1/dns_records/dns-1'))
  assert.ok(r.includes('DELETE /accounts/acc1/cfd_tunnel/tun-1'))
})

test('crearTunel: si falla crear el túnel no hay rollback', async () => {
  const s = simulado([falla(403, 10000, 'sin permiso')])
  await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel('abril'), /crear túnel/)
  assert.equal(s.llamadas.length, 1)
})

test('crearTunel: rechaza slug inválido sin llamar a Cloudflare', async () => {
  const s = simulado([])
  for (const slug of ['', 'A.b', 'a b', 'a/b', '-x']) await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel(slug))
  assert.equal(s.llamadas.length, 0)
})

test('success=false con HTTP 200 es error', async () => {
  const s = simulado([{ status: 200, body: { success: false, errors: [{ code: 7, message: 'x' }], result: null } }])
  await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel('abril'), /crear túnel/)
})

test('obtenerTokenTunel devuelve el token', async () => {
  const s = simulado([ok(TOKEN_TUNEL)])
  assert.equal(await crearCloudflare(env, s.fetchFn).obtenerTokenTunel('tun-1'), TOKEN_TUNEL)
  assert.deepEqual(resumen(s.llamadas), ['GET /accounts/acc1/cfd_tunnel/tun-1/token'])
})

test('borrarTunel: borra DNS, limpia conexiones y borra el túnel', async () => {
  const s = simulado([ok([{ id: 'dns-1', name: 'abril.cajas.ejemplo.test' }]), ok({ id: 'dns-1' }), ok(null), ok({ id: 'tun-1' })])
  await crearCloudflare(env, s.fetchFn).borrarTunel('tun-1', 'abril')
  assert.deepEqual(resumen(s.llamadas), [
    'GET /zones/zone1/dns_records?name=abril.cajas.ejemplo.test',
    'DELETE /zones/zone1/dns_records/dns-1',
    'DELETE /accounts/acc1/cfd_tunnel/tun-1/connections',
    'DELETE /accounts/acc1/cfd_tunnel/tun-1',
  ])
})

test('borrarTunel es idempotente: 404 y registro DNS ausente no son error', async () => {
  const s = simulado([ok([]), falla(404), falla(404)])
  await crearCloudflare(env, s.fetchFn).borrarTunel('tun-1', 'abril')
  const s2 = simulado([ok([{ id: 'dns-1', name: 'abril.cajas.ejemplo.test' }]), falla(404), falla(404), falla(404)])
  await crearCloudflare(env, s2.fetchFn).borrarTunel('tun-1', 'abril')
  assert.equal(s2.cola.length, 0)
})

test('borrarTunel: ignora registros DNS de otro nombre y propaga errores reales', async () => {
  const s = simulado([ok([{ id: 'otro', name: 'otro.cajas.ejemplo.test' }]), ok(null), falla(500)])
  await assert.rejects(crearCloudflare(env, s.fetchFn).borrarTunel('tun-1', 'abril'), /borrar túnel/)
  assert.ok(!resumen(s.llamadas).includes('DELETE /zones/zone1/dns_records/otro'))
})

test('ni el token de la API ni el del túnel aparecen en errores ni en logs', async () => {
  const logs = espiarLogs()
  const mensajes: string[] = []
  try {
    const casos: Resp[][] = [
      [falla(401, 10000, `Bearer ${TOKEN_API} inválido`)],
      [ok({ id: 'tun-1' }), ok({}), ok({ id: 'd' }), { status: 200, body: { success: false, errors: [{ code: 1, message: `token ${TOKEN_TUNEL}` }], result: TOKEN_TUNEL } }, ok({}), ok({}), ok({})],
      [new Error(`fallo de red con ${TOKEN_API}`)],
    ]
    for (const cola of casos) {
      const s = simulado(cola)
      try { await crearCloudflare(env, s.fetchFn).crearTunel('abril') } catch (e) { mensajes.push((e as Error).message) }
    }
    const s = simulado([falla(500, 1, TOKEN_API)])
    try { await crearCloudflare(env, s.fetchFn).obtenerTokenTunel('t') } catch (e) { mensajes.push((e as Error).message) }
  } finally { logs.restaurar() }
  assert.equal(mensajes.length, 4)
  for (const m of [...mensajes, ...logs.msgs]) {
    assert.ok(!m.includes(TOKEN_API), m)
    assert.ok(!m.includes(TOKEN_TUNEL), m)
  }
})
