import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimarClipSeg, ritmoDe } from '../app/lib/eta-clips.ts'
import { textoRestante } from '../app/lib/eta-progreso.ts'

const MB = 1048576

test('ritmoDe: percentil 70 por segundo de video y por MB', () => {
  const r = ritmoDe([
    { seg: 600, duracionSeg: 1800, bytes: 600 * MB },
    { seg: 900, duracionSeg: 1800, bytes: 900 * MB },
    { seg: 1200, duracionSeg: 1800, bytes: 600 * MB },
    { seg: 5, duracionSeg: 1800 }, // roto: se descarta
  ])
  assert.equal(r.porSegVideo, 0.5)
  assert.equal(r.porMB, 1)
})

test('ritmoDe: con pocos trabajos no hay ritmo', () => {
  assert.deepEqual(ritmoDe([{ seg: 600, duracionSeg: 1800 }]), { porSegVideo: null, porMB: null })
})

test('estimarClipSeg: usa la duración antes que el peso', () => {
  const ritmo = { porSegVideo: 0.4, porMB: 2 }
  assert.equal(estimarClipSeg(ritmo, { duracionSeg: 3000, bytes: 1000 * MB }), 1200)
  assert.equal(estimarClipSeg(ritmo, { bytes: 500 * MB }), 1000)
})

test('estimarClipSeg: sin historial usa valores por defecto razonables', () => {
  const vacio = { porSegVideo: null, porMB: null }
  assert.equal(estimarClipSeg(vacio, { duracionSeg: 1800 }), 1020) // 30 min de video → 17 min
  assert.equal(estimarClipSeg(vacio, {}), 900)
  assert.equal(estimarClipSeg(vacio, { duracionSeg: 20 }), 130)
  assert.equal(estimarClipSeg({ porSegVideo: 0.01, porMB: null }, { duracionSeg: 60 }), 120) // mínimo 2 min
})

test('textoRestante: minutos redondos y horas para trabajos largos', () => {
  assert.equal(textoRestante(754), '~13 min')
  assert.equal(textoRestante(3600), '~1 h')
  assert.equal(textoRestante(4500), '~1 h 15 min')
})
