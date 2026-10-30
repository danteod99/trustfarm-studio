import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { derivarPublica, firmarPase, PASE_VIDA_SEG } from '../app/lib/cajas/pase.ts'

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

// ---- La central deriva la pública de la privada (ya no hay PASE_PUBLIC_KEY) ----

const pkcs8 = (k: { export(o: { format: 'der'; type: 'pkcs8' }): Buffer }) => k.export({ format: 'der', type: 'pkcs8' }).toString('base64')
// Mensaje propio y genérico (no el de Node, que podría arrastrar detalles de la clave)
const GENERICO = /^La clave privada del pase no es válida\.$/

test('derivarPublica: de la privada del vector sale exactamente la pública del vector', () => {
  assert.equal(derivarPublica(vector.privateKeyB64), vector.publicKeyB64)
})

test('derivarPublica: con un par nuevo coincide con la pública generada', () => {
  const par = generateKeyPairSync('ed25519')
  const pub = par.publicKey.export({ format: 'der', type: 'spki' }).toString('base64')
  assert.equal(derivarPublica(pkcs8(par.privateKey)), pub)
})

test('un pase firmado con la privada verifica con la pública derivada', () => {
  assert.ok(verificarFirma(firmar(), derivarPublica(vector.privateKeyB64)))
  const par = generateKeyPairSync('ed25519')
  const priv = pkcs8(par.privateKey)
  assert.ok(verificarFirma(firmar({ privateKeyB64: priv }), derivarPublica(priv)))
})

test('derivarPublica: clave RSA o P-256 lanza un error genérico sin la clave', () => {
  const rsa = pkcs8(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)
  const p256 = pkcs8(generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey)
  for (const k of [rsa, p256]) {
    assert.throws(() => derivarPublica(k), (e: Error) => GENERICO.test(e.message) && !e.message.includes(k.slice(0, 40)))
  }
})

test('derivarPublica: vacío, no string o basura lanza el error genérico', () => {
  for (const v of ['', undefined, null, 123, {}, 'AAAA-clave-mala-secreta']) {
    assert.throws(() => derivarPublica(v as unknown as string), (e: Error) => e instanceof Error && GENERICO.test(e.message))
  }
})

test('derivarPublica: una privada recortada (mal pegada) o la pública en su lugar lanza sin mencionarla', () => {
  for (const mal of [vector.privateKeyB64.slice(4), vector.privateKeyB64.slice(0, -8), vector.publicKeyB64]) {
    assert.throws(() => derivarPublica(mal), (e: Error) => GENERICO.test(e.message))
  }
})
