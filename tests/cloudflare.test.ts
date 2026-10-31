import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearCloudflare, SLUG_REGEX, CLOUDFLARE_TIMEOUT_MS } from '../app/lib/cloudflare.ts'

const TOKEN_API = 'cf-api-token-SECRETO-123'
const TOKEN_TUNEL = 'tunel-token-SECRETO-456'
const env = { token: TOKEN_API, accountId: 'acc1', zoneId: 'zone1', dominio: 'cajas.ejemplo.test' }
const TUN = '11111111-1111-4111-8111-111111111111'
const BASE = 'https://api.cloudflare.com/client/v4'

type Llamada = { signal?: AbortSignal; method: string; url: string; headers: Record<string, string>; body: unknown }
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
      signal: init.signal,
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
  const s = simulado([ok({ id: '11111111-1111-4111-8111-111111111111' }), ok({ version: 1 }), ok({ id: 'dns-1' }), ok(TOKEN_TUNEL)])
  const cf = crearCloudflare(env, s.fetchFn)
  const r = await cf.crearTunel('abril123')
  assert.deepEqual(r, { tunnelId: '11111111-1111-4111-8111-111111111111', tunnelToken: TOKEN_TUNEL, hostname: 'abril123.cajas.ejemplo.test' })
  assert.deepEqual(resumen(s.llamadas), [
    'POST /accounts/acc1/cfd_tunnel',
    'PUT /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111/configurations',
    'POST /zones/zone1/dns_records',
    'GET /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111/token',
  ])
  const [t, c, d, k] = s.llamadas
  assert.deepEqual(t.body, { name: 'caja-abril123', config_src: 'cloudflare' })
  assert.deepEqual(c.body, {
    config: { ingress: [{ hostname: 'abril123.cajas.ejemplo.test', service: 'http://localhost:8080' }, { service: 'http_status:404' }] },
  })
  assert.deepEqual(d.body, { type: 'CNAME', name: 'abril123.cajas.ejemplo.test', content: '11111111-1111-4111-8111-111111111111.cfargotunnel.com', proxied: true })
  assert.equal(k.body, undefined)
  for (const l of s.llamadas) {
    assert.equal(l.headers['Authorization'], `Bearer ${TOKEN_API}`)
  }
  assert.equal(s.cola.length, 0)
})

test('crearTunel: si la configuración falla borra el túnel y lanza el error original', async () => {
  const s = simulado([ok({ id: '11111111-1111-4111-8111-111111111111' }), falla(400, 1001, 'config mala'), ok({ id: '11111111-1111-4111-8111-111111111111' })])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril123'), /configurar/)
  assert.deepEqual(resumen(s.llamadas).slice(2), ['DELETE /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111'])
  assert.equal(s.llamadas.length, 3)
})

test('crearTunel: si el DNS falla borra el túnel; si el rollback falla no tapa el error original', async () => {
  const s = simulado([ok({ id: '11111111-1111-4111-8111-111111111111' }), ok({}), falla(409, 81057, 'ya existe'), falla(500), falla(500)])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril123'), (e: Error) => /DNS/.test(e.message) && /409/.test(e.message) && !/borrar/.test(e.message))
  assert.ok(resumen(s.llamadas).includes('DELETE /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111'))
})

test('crearTunel: si el token falla borra DNS creado y túnel', async () => {
  const s = simulado([ok({ id: '11111111-1111-4111-8111-111111111111' }), ok({}), ok({ id: 'dns-1' }), falla(500), ok({ id: 'dns-1' }), ok({}), ok({})])
  const cf = crearCloudflare(env, s.fetchFn)
  await assert.rejects(cf.crearTunel('abril123'), /token/)
  const r = resumen(s.llamadas).slice(4)
  assert.ok(r.includes('DELETE /zones/zone1/dns_records/dns-1'))
  assert.ok(r.includes('DELETE /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111'))
})

test('crearTunel: si falla crear el túnel no hay rollback', async () => {
  const s = simulado([falla(403, 10000, 'sin permiso')])
  await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel('abril123'), /crear túnel/)
  assert.equal(s.llamadas.length, 1)
})

test('crearTunel: rechaza slug inválido sin llamar a Cloudflare', async () => {
  const s = simulado([])
  for (const slug of ['', 'A.b', 'a b', 'a/b', '-x']) await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel(slug))
  assert.equal(s.llamadas.length, 0)
})

test('success=false con HTTP 200 es error', async () => {
  const s = simulado([{ status: 200, body: { success: false, errors: [{ code: 7, message: 'x' }], result: null } }])
  await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel('abril123'), /crear túnel/)
})

test('obtenerTokenTunel devuelve el token', async () => {
  const s = simulado([ok(TOKEN_TUNEL)])
  assert.equal(await crearCloudflare(env, s.fetchFn).obtenerTokenTunel('11111111-1111-4111-8111-111111111111'), TOKEN_TUNEL)
  assert.deepEqual(resumen(s.llamadas), ['GET /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111/token'])
})

test('borrarTunel: borra DNS, limpia conexiones y borra el túnel', async () => {
  const s = simulado([ok([{ id: 'dns-1', name: 'abril123.cajas.ejemplo.test', type: 'CNAME', content: TUN + '.cfargotunnel.com' }]), ok({ id: 'dns-1' }), ok(null), ok({ id: '11111111-1111-4111-8111-111111111111' })])
  await crearCloudflare(env, s.fetchFn).borrarTunel('11111111-1111-4111-8111-111111111111', 'abril123')
  assert.deepEqual(resumen(s.llamadas), [
    'GET /zones/zone1/dns_records?name=abril123.cajas.ejemplo.test',
    'DELETE /zones/zone1/dns_records/dns-1',
    'DELETE /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111/connections',
    'DELETE /accounts/acc1/cfd_tunnel/11111111-1111-4111-8111-111111111111',
  ])
})

test('borrarTunel es idempotente: 404 y registro DNS ausente no son error', async () => {
  const s = simulado([ok([]), falla(404), falla(404)])
  await crearCloudflare(env, s.fetchFn).borrarTunel('11111111-1111-4111-8111-111111111111', 'abril123')
  const s2 = simulado([ok([{ id: 'dns-1', name: 'abril123.cajas.ejemplo.test', type: 'CNAME', content: TUN + '.cfargotunnel.com' }]), falla(404), falla(404), falla(404)])
  await crearCloudflare(env, s2.fetchFn).borrarTunel('11111111-1111-4111-8111-111111111111', 'abril123')
  assert.equal(s2.cola.length, 0)
})

test('borrarTunel: ignora registros DNS de otro nombre y propaga errores reales', async () => {
  const s = simulado([ok([{ id: 'otro', name: 'otro.cajas.ejemplo.test', type: 'CNAME', content: TUN + '.cfargotunnel.com' }]), ok(null), falla(500)])
  await assert.rejects(crearCloudflare(env, s.fetchFn).borrarTunel('11111111-1111-4111-8111-111111111111', 'abril123'), /borrar túnel/)
  assert.ok(!resumen(s.llamadas).includes('DELETE /zones/zone1/dns_records/otro'))
})

test('ni el token de la API ni el del túnel aparecen en errores ni en logs', async () => {
  const logs = espiarLogs()
  const mensajes: string[] = []
  try {
    const casos: Resp[][] = [
      [falla(401, 10000, `Bearer ${TOKEN_API} inválido`)],
      [ok({ id: '11111111-1111-4111-8111-111111111111' }), ok({}), ok({ id: 'd' }), { status: 200, body: { success: false, errors: [{ code: 1, message: `token ${TOKEN_TUNEL}` }], result: TOKEN_TUNEL } }, ok({}), ok({}), ok({})],
      [new Error(`fallo de red con ${TOKEN_API}`)],
    ]
    for (const cola of casos) {
      const s = simulado(cola)
      try { await crearCloudflare(env, s.fetchFn).crearTunel('abril123') } catch (e) { mensajes.push((e as Error).message) }
    }
    const s = simulado([falla(500, 1, TOKEN_API)])
    try { await crearCloudflare(env, s.fetchFn).obtenerTokenTunel('11111111-1111-4111-8111-111111111111') } catch (e) { mensajes.push((e as Error).message) }
  } finally { logs.restaurar() }
  assert.equal(mensajes.length, 4)
  for (const m of [...mensajes, ...logs.msgs]) {
    assert.ok(!m.includes(TOKEN_API), m)
    assert.ok(!m.includes(TOKEN_TUNEL), m)
  }
})

// ---- Fix ronda 1 ----
const OTRO_TUN = '22222222-2222-4222-8222-222222222222'

test('constantes del contrato', () => {
  assert.equal(CLOUDFLARE_TIMEOUT_MS, 10_000)
  assert.equal(SLUG_REGEX.source, '^[a-z0-9]{8}$')
})

test('borrarTunel con slug inválido no hace ninguna llamada y lanza', async () => {
  for (const slug of ['www', '*', 'a.b', '', 'abcdefghi', 'ABCDEFGH', 'mi caja nombre']) {
    const s = simulado([])
    await assert.rejects(crearCloudflare(env, s.fetchFn).borrarTunel(TUN, slug), (e: Error) => e.message.length > 0)
    assert.equal(s.llamadas.length, 0, slug)
  }
})

test('crearTunel con slug fuera del contrato no hace ninguna llamada y lanza', async () => {
  for (const slug of ['www', 'abcdefg', 'abcdefghi']) {
    const s = simulado([])
    await assert.rejects(crearCloudflare(env, s.fetchFn).crearTunel(slug))
    assert.equal(s.llamadas.length, 0, slug)
  }
})

test('tunnelId inválido no hace ninguna llamada y lanza', async () => {
  for (const id of ['..', '', 'abc/def']) {
    const s = simulado([])
    const cf = crearCloudflare(env, s.fetchFn)
    await assert.rejects(cf.obtenerTokenTunel(id))
    await assert.rejects(cf.borrarTunel(id, 'abril123'))
    assert.equal(s.llamadas.length, 0, id)
  }
})

test('borrarTunel solo borra el CNAME que apunta a este túnel', async () => {
  const nombre = 'abril123.cajas.ejemplo.test'
  const s = simulado([
    ok([
      { id: 'a', name: nombre, type: 'A', content: '1.2.3.4' },
      { id: 'txt', name: nombre, type: 'TXT', content: 'x' },
      { id: 'mx', name: nombre, type: 'MX', content: 'mail.x' },
      { id: 'ajeno', name: nombre, type: 'CNAME', content: `${OTRO_TUN}.cfargotunnel.com` },
      { id: 'mio', name: nombre, type: 'CNAME', content: `${TUN.toUpperCase()}.cfargotunnel.com` },
    ]),
    ok({ id: 'mio' }), ok(null), ok({}),
  ])
  await crearCloudflare(env, s.fetchFn).borrarTunel(TUN, 'abril123')
  const dels = resumen(s.llamadas).filter((x) => x.includes('/dns_records/'))
  assert.deepEqual(dels, ['DELETE /zones/zone1/dns_records/mio'])
})

// fetch que nunca responde pero respeta signal
function colgado(primeras: Resp[] = []) {
  const llamadas: Llamada[] = []
  const fetchFn = ((url: any, init: any = {}) => {
    llamadas.push({ method: init.method ?? 'GET', url: String(url), headers: init.headers ?? {}, body: undefined, signal: init.signal })
    const r = primeras.shift()
    if (r && !(r instanceof Error)) return Promise.resolve(new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 }))
    return new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(new Error(`abortado ${TOKEN_API}`)))
    })
  }) as unknown as typeof fetch
  return { fetchFn, llamadas }
}

test('cada llamada lleva signal y un timeout lanza error genérico sin token (crearTunel y rollback)', async () => {
  const s = colgado([ok({ id: TUN })])
  const cf = crearCloudflare(env, s.fetchFn, 30)
  await assert.rejects(cf.crearTunel('abril123'), (e: Error) => /configurar túnel/.test(e.message) && !e.message.includes(TOKEN_API))
  assert.ok(resumen(s.llamadas).includes(`DELETE /accounts/acc1/cfd_tunnel/${TUN}`))
  for (const l of s.llamadas) assert.ok(l.signal instanceof AbortSignal)
})

test('timeout en borrarTunel lanza error genérico sin token', async () => {
  const s = colgado()
  await assert.rejects(crearCloudflare(env, s.fetchFn, 30).borrarTunel(TUN, 'abril123'), (e: Error) => /DNS/.test(e.message) && !e.message.includes(TOKEN_API))
  assert.ok(s.llamadas[0].signal instanceof AbortSignal)
})
