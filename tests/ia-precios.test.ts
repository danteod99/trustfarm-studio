// Precios por modelo y reglas de lo que la pasarela deja pasar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aMicrocreditos, costoMicroUsd, esModeloIA } from '../app/lib/ia/precios.ts'
import { HERRAMIENTAS, MAX_TOKENS, validarCuerpo } from '../app/lib/ia/reglas.ts'

const HAIKU = 'claude-haiku-5-5'
const SONNET = 'claude-sonnet-5-5'
const BASE = { model: HAIKU, max_tokens: 1024, messages: [{ role: 'user', content: 'hola' }] }

test('precios por millón de tokens, según la documentación oficial', () => {
  assert.equal(costoMicroUsd(HAIKU, { input_tokens: 1_000_000 - 900_000 }), 10_000) // $0.10/M
  assert.equal(costoMicroUsd(HAIKU, { output_tokens: 1_000_000 }), 500_000)
  assert.equal(costoMicroUsd(HAIKU, { cache_read_input_tokens: 100_000 }), 1_000) // $0.01/M
  assert.equal(costoMicroUsd(HAIKU, { cache_creation_input_tokens: 100_000 }), 12_500) // $0.125/M
  assert.equal(costoMicroUsd(SONNET, { input_tokens: 1_000_000 }), 2_000_000)
  assert.equal(costoMicroUsd(SONNET, { output_tokens: 1000 }), 10_000)
  assert.equal(costoMicroUsd(SONNET, { cache_read_input_tokens: 1_000_000 }), 100_000) // $0.10/M
  assert.equal(costoMicroUsd(SONNET, { cache_creation_input_tokens: 1_000_000 }), 2_500_000) // $2.50/M
})

test('Haiku cuesta 5 veces más cuando la entrada total pasa de 100,000 tokens', () => {
  assert.equal(costoMicroUsd(HAIKU, { input_tokens: 100_000, output_tokens: 1000 }), 10_000 + 500)
  // 100,001 de entrada: toda la solicitud va a la tarifa alta ($0.50 entrada, $2.50 salida)
  assert.equal(costoMicroUsd(HAIKU, { input_tokens: 100_001, output_tokens: 1000 }), Math.ceil(50_000.5) + 2500)
  // La caché también cuenta como entrada
  assert.equal(costoMicroUsd(HAIKU, { input_tokens: 50_000, cache_read_input_tokens: 60_000 }), 25_000 + 3000)
})

test('costo sin datos o con valores raros: 0, nunca negativo ni NaN', () => {
  assert.equal(costoMicroUsd(HAIKU, {}), 0)
  assert.equal(costoMicroUsd(HAIKU, { input_tokens: -5, output_tokens: Number.NaN }), 0)
})

test('1 crédito cubre $0.04 de costo: 25 créditos por cada dólar, redondeando hacia arriba', () => {
  assert.equal(aMicrocreditos(40_000), 1_000_000) // $0.04 = 1 crédito
  assert.equal(aMicrocreditos(100_000), 2_500_000) // $0.10 = 2.5 créditos
  assert.equal(aMicrocreditos(0), 0)
  assert.equal(aMicrocreditos(0.5), 13)
})

test('esModeloIA: solo los dos modelos admitidos', () => {
  assert.equal(esModeloIA(HAIKU), true)
  assert.equal(esModeloIA(SONNET), true)
  for (const m of ['claude-opus-5-5', 'claude-fable-5-1', '', null, 5]) assert.equal(esModeloIA(m), false)
})

test('validarCuerpo: deja pasar solo lo permitido y descarta el resto', () => {
  const tools = [{ name: 'responder_cliente', description: 'x', input_schema: { type: 'object' } }]
  const r = validarCuerpo({ ...BASE, system: 's', tools, tool_choice: { type: 'auto' }, thinking: { type: 'adaptive' }, metadata: { a: 1 }, temperature: 1, service_tier: 'priority' })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.equal(r.modelo, HAIKU)
  assert.deepEqual(Object.keys(r.params).sort(), ['max_tokens', 'messages', 'model', 'system', 'tool_choice', 'tools'])
})

test('validarCuerpo: rechaza lo que no es del asistente', () => {
  const malos: Array<[unknown, RegExp]> = [
    [null, /inválida/],
    ['texto', /inválida/],
    [[], /inválida/],
    [{ ...BASE, model: 'claude-opus-5-5' }, /Modelo/],
    [{ ...BASE, stream: true }, /streaming/i],
    [{ ...BASE, max_tokens: MAX_TOKENS + 1 }, /max_tokens/],
    [{ ...BASE, max_tokens: 0 }, /max_tokens/],
    [{ ...BASE, max_tokens: 'mucho' }, /max_tokens/],
    [{ ...BASE, messages: [] }, /messages/],
    [{ ...BASE, messages: 'hola' }, /messages/],
    [{ ...BASE, tools: [{ name: 'hackear' }] }, /Herramienta/],
    [{ ...BASE, tools: [{ type: 'web_search_20260209', name: 'web_search' }] }, /Herramienta/],
    [{ ...BASE, tools: 'x' }, /Herramienta/],
  ]
  for (const [cuerpo, patron] of malos) {
    const r = validarCuerpo(cuerpo)
    assert.equal(r.ok, false, JSON.stringify(cuerpo))
    if (!r.ok) {
      assert.equal(r.status, 400)
      assert.match(r.error, patron)
    }
  }
})

test('MAX_TOKENS admite lo que usa la importación de productos (16000)', () => {
  assert.equal(MAX_TOKENS, 16000)
  assert.ok(validarCuerpo({ ...BASE, max_tokens: 16000 }).ok)
})

test('HERRAMIENTAS incluye las de la caja', () => {
  for (const h of ['responder_cliente', 'pasar_a_humano', 'entregar_productos', 'proponer_responder_cliente', 'resumen_ventas']) assert.ok(HERRAMIENTAS.has(h), h)
})
