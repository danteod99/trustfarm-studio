import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { claudeConTope, topeAbort } from '../app/lib/claude-tope.ts'
import { generateHooks } from '../app/lib/granja-ganchos.ts'

const fetchReal = globalThis.fetch
afterEach(() => { globalThis.fetch = fetchReal })

/** Red colgada: la petición nunca responde, solo termina si la abortan. */
function redColgada(contador = { n: 0 }) {
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => {
    contador.n++
    return new Promise((_, reject) => {
      const abortar = () => reject(new DOMException('Aborted', 'AbortError'))
      if (init?.signal?.aborted) return abortar()
      init?.signal?.addEventListener('abort', abortar)
    })
  }) as typeof fetch
  return contador
}

const PARAMS = { model: 'x', max_tokens: 10, messages: [{ role: 'user' as const, content: 'hola' }] }
const SLOTS = [{ id: 's0', handle: 'a', network: 'tiktok' as const }, { id: 's1', handle: 'b', network: 'tiktok' as const }]
const OPTS = { tema: 'granjas', idioma: 'es' as const, tono: 'curioso' }

test('topeAbort: deja el margen para reembolsar antes de maxDuration', async () => {
  const s = topeAbort(1, 800) // 1 s de función − 800 ms de margen = 200 ms
  assert.equal(s.aborted, false)
  await new Promise((r) => setTimeout(r, 400))
  assert.equal(s.aborted, true)
})

test('claudeConTope: con Claude colgado termina al llegar el tope, no tras el timeout de 100 s', async () => {
  redColgada()
  const t0 = Date.now()
  await assert.rejects(claudeConTope('k', topeAbort(1, 800))(PARAMS))
  assert.ok(Date.now() - t0 < 5000, `tardó ${Date.now() - t0} ms`)
})

test('ganchos con Claude colgado: lanza a tiempo (2 rondas + reintento) y la ruta puede reembolsar', async () => {
  redColgada()
  const crear = claudeConTope('k', topeAbort(1, 800))
  const t0 = Date.now()
  await assert.rejects(generateHooks(SLOTS, OPTS, [], (p) => crear({ ...PARAMS, messages: [{ role: 'user', content: p }] })))
  assert.ok(Date.now() - t0 < 5000, `tardó ${Date.now() - t0} ms`)
})

test('ganchos: lo que ya se escribió se conserva si el tope corta la 2.ª ronda', async () => {
  redColgada()
  const crear = claudeConTope('k', topeAbort(1, 800))
  let llamadas = 0
  const r = await generateHooks(SLOTS, OPTS, [], async (p) => {
    if (++llamadas === 1) return { videos: [{ id: 's0', gancho: 'Gancho de prueba uno', caption: 'Texto de prueba #uno #dos #tres' }] }
    return crear({ ...PARAMS, messages: [{ role: 'user', content: p }] })
  })
  assert.deepEqual(r.missing, ['s1'])
  assert.ok(r.items.s0)
})
