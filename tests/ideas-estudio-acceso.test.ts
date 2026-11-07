// /api/ideas/<id>: las ideas ocultas solo las abre un admin, con la misma comprobación que el resto del proyecto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { Idea } from '../app/lib/ideas.ts'
import { ideaParaEstudio } from '../app/lib/ideas-datos.ts'

const idea = (id: string): Idea => ({
  id, category: 'Anime', title: 'Una idea', hook: 'Un gancho', kind: 'image', model: 'z-image', aspect: '9:16',
  prompt: 'Un prompt de prueba', fuente: 'Interna',
})
const publica = idea('publica')
const oculta = idea('oculta')
const leerTodas = async () => [publica, oculta]

test('una idea oculta no se abre sin ser admin, y ni siquiera se leen las ocultas', async () => {
  let leidas = 0
  const todas = async () => { leidas += 1; return [publica, oculta] }
  assert.equal(await ideaParaEstudio('oculta', [publica], async () => false, todas), null)
  assert.equal(leidas, 0)
})

test('un admin abre la idea oculta, sin la fuente interna', async () => {
  const r = await ideaParaEstudio('oculta', [publica], async () => true, leerTodas)
  assert.equal(r?.id, 'oculta')
  assert.equal(r?.fuente, undefined)
})

test('una idea pública no pide sesión', async () => {
  let preguntas = 0
  const r = await ideaParaEstudio('publica', [publica], async () => { preguntas += 1; return false }, leerTodas)
  assert.equal(r, publica)
  assert.equal(preguntas, 0)
})

test('una idea que no existe tampoco se abre siendo admin', async () => {
  assert.equal(await ideaParaEstudio('no-existe', [publica], async () => true, leerTodas), null)
})

test('la ruta decide con getUser e isAdminEmail de app/lib/auth y responde 404', () => {
  const ruta = readFileSync(new URL('../app/api/ideas/[id]/route.ts', import.meta.url), 'utf8')
  assert.match(ruta, /import \{ getUser, isAdminEmail \} from "@\/app\/lib\/auth";/)
  assert.match(ruta, /async \(\) => isAdminEmail\(\(await getUser\(\)\)\?\.email\)/)
  assert.match(ruta, /if \(!idea\) return Response\.json\(\{ error: "Esa idea no existe\." \}, \{ status: 404 \}\);/)
})
