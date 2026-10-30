import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { firmarPase, PASE_VIDA_SEG } from '../app/lib/cajas/pase.ts'

const vector = JSON.parse(readFileSync(new URL('./fixtures/pase-vector.json', import.meta.url), 'utf8'))
const now = new Date(vector.now)
const B64URL = /^[A-Za-z0-9_-]+$/

// Réplica de la lógica de la caja: la firma se calcula sobre el TEXTO base64url del payload
function verificarFirma(pase: string, publicKeyB64: string): boolean {
  const [cuerpo, firma] = pase.split('.')
  const clave = createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' })
  return verify(null, Buffer.from(cuerpo), clave, Buffer.from(firma, 'base64url'))
}

function firmar(over: Partial<{ sub: string; box: string; privateKeyB64: string }> = {}) {
  return firmarPase({ sub: vector.ownerId, box: vector.cajaId, now, privateKeyB64: vector.privateKeyB64, ...over })
}

test('la vida del pase es 60 s', () => {
  assert.equal(PASE_VIDA_SEG, 60)
})

test('forma a.b en base64url sin relleno', () => {
  const partes = firmar().split('.')
  assert.equal(partes.length, 2)
  for (const p of partes) assert.match(p, B64URL)
})

test('payload con claves en orden, exp entero y jti de 32 hex', () => {
  const payload = JSON.parse(Buffer.from(firmar().split('.')[0], 'base64url').toString('utf8'))
  assert.deepEqual(Object.keys(payload), ['v', 'sub', 'box', 'exp', 'jti'])
  assert.equal(payload.v, 1)
  assert.equal(payload.sub, vector.ownerId)
  assert.equal(payload.box, vector.cajaId)
  assert.ok(Number.isInteger(payload.exp))
  assert.equal(payload.exp, now.getTime() / 1000 + 60)
  assert.equal(payload.exp, vector.exp)
  assert.match(payload.jti, /^[0-9a-f]{32}$/)
})

test('exp es entero aunque now tenga milisegundos', () => {
  const p = firmarPase({ sub: 'a', box: 'b', now: new Date(now.getTime() + 999), privateKeyB64: vector.privateKeyB64 })
  const payload = JSON.parse(Buffer.from(p.split('.')[0], 'base64url').toString('utf8'))
  assert.ok(Number.isInteger(payload.exp))
  assert.equal(payload.exp, vector.exp)
})

test('la firma del pase verifica con la pública del vector', () => {
  assert.ok(verificarFirma(firmar(), vector.publicKeyB64))
})

test('el verificador de prueba acepta el pase del vector (misma firma que la caja)', () => {
  assert.ok(verificarFirma(vector.pase, vector.publicKeyB64))
})

test('con otra clave pública la verificación falla', () => {
  const otra = generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  assert.equal(verificarFirma(firmar(), otra), false)
})

test('dos pases tienen jti distintos', () => {
  const j = (p: string) => JSON.parse(Buffer.from(p.split('.')[0], 'base64url').toString('utf8')).jti
  assert.notEqual(j(firmar()), j(firmar()))
})

test('entradas vacías lanzan sin incluir la clave privada', () => {
  for (const over of [{ sub: '' }, { box: '' }, { privateKeyB64: '' }]) {
    assert.throws(() => firmar(over), (e: Error) => !e.message.includes(vector.privateKeyB64))
  }
  assert.throws(() => firmar({ sub: '' }), (e: Error) => !e.message.includes(vector.privateKeyB64) && e.message.length > 0)
})

test('clave privada inválida lanza sin filtrar la clave', () => {
  const mala = 'AAAA-clave-mala-secreta'
  assert.throws(() => firmar({ privateKeyB64: mala }), (e: Error) => !e.message.includes(mala))
})
