// Publica una versión de Empleado IA para las mini PC: la firma (en TU PC), sube el paquete a Supabase Storage y la registra por tandas.
//
//   Publicar:   node scripts/publicar-release.mjs publicar <paquete.tgz> --version 1.2.0 --llave ~/.empleado-release/release-private.pem [--porcentaje 5] [--notas "texto"]
//   Cambiar tanda (o frenar con 0):  node scripts/publicar-release.mjs tanda 1.2.0 100
//
// Variables de entorno (las de tu .env.local; NO las pegues en el chat ni en el repositorio):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// La llave PRIVADA solo se lee aquí, nunca se sube. El paquete lo arma deploy/iso/construir-release.sh del repo empleado-ia.
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'

const [, , cmd, ...args] = process.argv
const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const BUCKET = 'releases'
const SEMVER = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const MAX = 50 * 1024 * 1024

const falla = (m) => { console.error('ERROR: ' + m); process.exit(1) }
const opcion = (n, def) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : def }
if (!URL_BASE || !CLAVE) falla('faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')

const cabeceras = (extra = {}) => ({ apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, ...extra })

async function asegurarBucket() {
  const r = await fetch(`${URL_BASE}/storage/v1/bucket/${BUCKET}`, { headers: cabeceras() })
  if (r.ok) return
  const c = await fetch(`${URL_BASE}/storage/v1/bucket`, {
    method: 'POST', headers: cabeceras({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX }),
  })
  if (!c.ok) falla(`no pude crear el bucket «${BUCKET}» (${c.status})`)
  console.log(`Bucket «${BUCKET}» creado (público: solo contiene paquetes firmados).`)
}

if (cmd === 'publicar') {
  const archivo = args[0]
  const version = opcion('version')
  const llave = opcion('llave')
  const porcentaje = Number(opcion('porcentaje', '5'))
  const notas = opcion('notas', null)
  if (!archivo || !version || !llave) falla('uso: publicar <paquete.tgz> --version X.Y.Z --llave <release-private.pem> [--porcentaje 5] [--notas "…"]')
  if (!SEMVER.test(version)) falla('la versión debe ser X.Y.Z')
  if (!Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100) falla('el porcentaje debe ser un entero de 0 a 100')
  const paquete = readFileSync(archivo)
  if (paquete.length === 0 || paquete.length > MAX) falla('el paquete está vacío o pasa de 50 MB')
  const sha256 = createHash('sha256').update(paquete).digest('hex')
  const mensaje = Buffer.from(`${version}|${sha256}|${paquete.length}`)
  const privada = createPrivateKey(readFileSync(llave))
  const firma = sign(null, mensaje, privada).toString('base64')
  // Comprobación antes de subir nada: la firma debe verificar con la pública derivada de la misma llave
  if (!verify(null, mensaje, createPublicKey(privada), Buffer.from(firma, 'base64'))) falla('la firma no verifica')

  await asegurarBucket()
  const nombre = `empleado-ia-${version}.tgz`
  const subida = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${nombre}`, {
    method: 'POST', headers: cabeceras({ 'Content-Type': 'application/gzip', 'x-upsert': 'false' }), body: paquete,
  })
  if (!subida.ok) falla(`no pude subir el paquete (${subida.status}); si ya existe esa versión, usa otro número`)
  const url = `${URL_BASE}/storage/v1/object/public/${BUCKET}/${nombre}`
  const fila = await fetch(`${URL_BASE}/rest/v1/cajas_releases`, {
    method: 'POST', headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ version, url, sha256, tamano: paquete.length, firma, porcentaje, notas }),
  })
  if (!fila.ok) falla(`el paquete se subió pero no pude registrar la versión (${fila.status}): ${await fila.text()}`)
  console.log(`Publicada la versión ${version} (${(paquete.length / 1048576).toFixed(1)} MB) al ${porcentaje} % de las cajas.\nsha256 ${sha256}`)
} else if (cmd === 'tanda') {
  const [version, pct] = args
  const porcentaje = Number(pct)
  if (!SEMVER.test(version ?? '') || !Number.isInteger(porcentaje) || porcentaje < 0 || porcentaje > 100) falla('uso: tanda <X.Y.Z> <0-100>')
  const r = await fetch(`${URL_BASE}/rest/v1/cajas_releases?version=eq.${version}`, {
    method: 'PATCH', headers: cabeceras({ 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify({ porcentaje }),
  })
  const filas = r.ok ? await r.json() : []
  if (!filas.length) falla(`no encontré la versión ${version}`)
  console.log(`La versión ${version} ahora llega al ${porcentaje} % de las cajas${porcentaje === 0 ? ' (frenada)' : ''}.`)
} else {
  falla('comandos: publicar | tanda (ver la cabecera del archivo)')
}
