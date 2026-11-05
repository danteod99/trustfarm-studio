import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  costoCortos, guardarRetomas, guardarTranscripcion, retomasGuardadas, transcripcionGuardada, type CacheCortos,
} from '../app/lib/video/cortos-cobro.ts'

const PRECIOS = { transcripcion: 3, retomas: 5 }
const TODO = { cutRetakes: true, subsOn: true, condense: false }
const a = { name: 'a.mp4', size: 100, lastModified: 1 }
const b = { name: 'b.mp4', size: 200, lastModified: 2 }
const words = [{ word: 'hola', start: 0, end: 1 }]
const segments = [{ start: 0, end: 1, text: 'hola' }]
const cuts = [{ start: 0, end: 0.5 }]

/** Lo que queda guardado tras pagar transcripción y retomas de estas tomas. */
function pagado(tomas = [a], condense = false): CacheCortos | null {
  const c = guardarTranscripcion(null, tomas, { words, segments })
  return guardarRetomas(c, tomas, condense, { cuts, warning: null, cost: 5 })
}

test('sin nada pagado se cobra el precio completo', () => {
  assert.equal(costoCortos(PRECIOS, null, [a], TODO), 8)
})

test('reintentar con las mismas tomas no cobra nada y reusa lo pagado', () => {
  const c = pagado()
  assert.equal(costoCortos(PRECIOS, c, [a], TODO), 0)
  assert.deepEqual(transcripcionGuardada(c, [a]), { words, segments })
  assert.deepEqual(retomasGuardadas(c, [a], false), { cuts, warning: null })
})

test('si solo se alcanzó a pagar la transcripción, el reintento cobra solo las retomas', () => {
  const c = guardarTranscripcion(null, [a], { words, segments })
  assert.equal(costoCortos(PRECIOS, c, [a], TODO), 5)
})

test('otro video se cobra completo y no recibe la transcripción del anterior', () => {
  const c = pagado()
  assert.equal(costoCortos(PRECIOS, c, [b], TODO), 8)
  assert.equal(transcripcionGuardada(c, [b]), null)
  assert.equal(retomasGuardadas(c, [b], false), null)
})

test('mismo nombre pero otro archivo no reusa lo pagado', () => {
  const c = pagado()
  assert.equal(transcripcionGuardada(c, [{ ...a, size: 101 }]), null)
  assert.equal(transcripcionGuardada(c, [{ ...a, lastModified: 9 }]), null)
})

test('cambiar el orden de las tomas cambia el audio: se vuelve a cobrar', () => {
  const c = pagado([a, b])
  assert.equal(costoCortos(PRECIOS, c, [b, a], TODO), 8)
})

test('activar condensar cobra las retomas de nuevo, pero no la transcripción', () => {
  const c = pagado()
  assert.equal(costoCortos(PRECIOS, c, [a], { ...TODO, condense: true }), 5)
  assert.equal(retomasGuardadas(c, [a], true), null)
  assert.deepEqual(transcripcionGuardada(c, [a]), { words, segments })
})

test('retomas sin cobro (la IA falló y se devolvió) no se guardan: se puede volver a intentar', () => {
  const c = guardarTranscripcion(null, [a], { words, segments })
  const d = guardarRetomas(c, [a], false, { cuts: [], warning: 'La IA no respondió', cost: 0 })
  assert.equal(retomasGuardadas(d, [a], false), null)
  assert.deepEqual(transcripcionGuardada(d, [a]), { words, segments })
})

test('pagar otro video reemplaza lo guardado del anterior', () => {
  const c = guardarTranscripcion(pagado(), [b], { words, segments })
  assert.equal(transcripcionGuardada(c, [a]), null)
  assert.equal(retomasGuardadas(c, [a], false), null)
})

test('sin retomas ni subtítulos no se cobra nada', () => {
  assert.equal(costoCortos(PRECIOS, null, [a], { cutRetakes: false, subsOn: false, condense: false }), 0)
})
