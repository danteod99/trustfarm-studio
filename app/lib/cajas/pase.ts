import { createPrivateKey, createPublicKey, randomBytes, sign } from 'node:crypto'

/**
 * Clave pública del pase (SPKI DER en base64) derivada de la privada (PKCS8 DER en base64).
 * Así la pareja nunca puede quedar mal configurada. Solo acepta Ed25519 (lo que verifica la caja).
 */
export function derivarPublica(privateKeyB64: string): string {
  // No se propaga el error original: podría arrastrar material de la clave
  const invalida = () => new Error('La clave privada del pase no es válida.')
  if (typeof privateKeyB64 !== 'string' || privateKeyB64.trim() === '') throw invalida()
  let pub: Buffer
  try {
    const priv = createPrivateKey({ key: Buffer.from(privateKeyB64.trim(), 'base64'), format: 'der', type: 'pkcs8' })
    if (priv.asymmetricKeyType !== 'ed25519') throw invalida()
    pub = createPublicKey(priv).export({ type: 'spki', format: 'der' })
  } catch {
    throw invalida()
  }
  return pub.toString('base64')
}

/** Vida del pase en segundos (contrato con la caja). */
export const PASE_VIDA_SEG = 60

/**
 * Firma un pase para abrir una caja: base64url(JSON payload) + "." + base64url(firma Ed25519
 * del TEXTO base64url del payload). Clave privada PKCS8 DER en base64.
 */
export function firmarPase(o: { sub: string; box: string; now: Date; privateKeyB64: string }): string {
  if (!o.sub) throw new Error('No se pudo firmar el pase: falta la cuenta (sub).')
  if (!o.box) throw new Error('No se pudo firmar el pase: falta la caja (box).')
  if (!o.privateKeyB64) throw new Error('No se pudo firmar el pase: falta la clave privada del pase.')
  const ms = o.now.getTime()
  if (!Number.isFinite(ms)) throw new Error('No se pudo firmar el pase: hora inválida.')

  // Orden de claves fijo: v, sub, box, exp, jti
  const payload = {
    v: 1,
    sub: o.sub,
    box: o.box,
    exp: Math.floor(ms / 1000) + PASE_VIDA_SEG,
    jti: randomBytes(16).toString('hex'),
  }
  return firmar(payload, o.privateKeyB64)
}

function firmar(payload: object, privateKeyB64: string): string {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url')
  let firma: string
  try {
    const clave = createPrivateKey({ key: Buffer.from(privateKeyB64, 'base64'), format: 'der', type: 'pkcs8' })
    firma = sign(null, Buffer.from(cuerpo), clave).toString('base64url')
  } catch {
    // No se propaga el error original: podría arrastrar material de la clave
    throw new Error('No se pudo firmar el pase: la clave privada del pase no es válida.')
  }
  return `${cuerpo}.${firma}`
}

/** Vida de la aceptación de soporte: la caja la pide cada pocos segundos mientras espera. */
export const ACEPTACION_VIDA_SEG = 120

/** Le dice a la caja que soporte aceptó el permiso. Lleva `uso`: no sirve como pase, ni al revés. */
export function firmarAceptacionSoporte(o: { box: string; ticket: string; nivel: string; venceEn: string; now: Date; privateKeyB64: string }): string {
  return firmar({
    v: 1,
    uso: 'soporte-acepta',
    box: o.box,
    ticket: o.ticket,
    nivel: o.nivel,
    vence: o.venceEn,
    exp: Math.floor(o.now.getTime() / 1000) + ACEPTACION_VIDA_SEG,
    jti: randomBytes(16).toString('hex'),
  }, o.privateKeyB64)
}

/** Abre la caja para soporte, solo mientras el dueño lo permita. La caja lo rechaza como pase normal. */
export function firmarPaseSoporte(o: { sub: string; box: string; venceEn: string; now: Date; privateKeyB64: string }): string {
  return firmar({
    v: 1,
    uso: 'soporte',
    sub: o.sub,
    box: o.box,
    vence: o.venceEn,
    exp: Math.floor(o.now.getTime() / 1000) + PASE_VIDA_SEG,
    jti: randomBytes(16).toString('hex'),
  }, o.privateKeyB64)
}
