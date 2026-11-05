import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assTime, assEscape, buildAss, captionLines } from '../app/lib/video/ass.ts'
import { casiTodoSilencio, duracionTotal, keepSegments, mapTime, parseSilences, selectExpr } from '../app/lib/video/cuts.ts'
import { PROFILES, getProfile, variationArgs, videoFilter, audioFilter } from '../app/lib/video/profiles.ts'

test('assTime: formato H:MM:SS.CC', () => {
  assert.equal(assTime(0), '0:00:00.00')
  assert.equal(assTime(61.5), '0:01:01.50')
  assert.equal(assTime(3725.07), '1:02:05.07')
  assert.equal(assTime(-3), '0:00:00.00')
})

test('assEscape: quita llaves, barras y saltos', () => {
  assert.equal(assEscape(' {\\b1}hola\nmundo\\N '), 'b1hola mundoN')
})

test('captionLines: máx. 4 palabras y corta en puntuación', () => {
  const w = (word: string, start: number) => ({ word, start, end: start + 0.2 })
  const lines = captionLines([w('uno', 0), w('dos', 0.3), w('tres.', 0.6), w('cuatro', 0.9), w('cinco', 1.0), w('seis', 1.1), w('siete', 1.2), w('ocho', 1.3)])
  assert.deepEqual(lines.map((l) => l.text), ['UNO DOS TRES.', 'CUATRO CINCO SEIS SIETE', 'OCHO'])
})

test('captionLines: usa segmentos si no hay palabras', () => {
  const lines = captionLines([], [{ start: 1, end: 2, text: 'hola qué tal' }, { start: 3, end: 3, text: 'vacío' }])
  assert.deepEqual(lines, [{ start: 1, end: 2, text: 'HOLA QUÉ TAL' }])
})

test('buildAss: cabecera con la resolución, estilo Hook y gancho arriba', () => {
  const ass = buildAss(1080, 1920, [{ word: 'hola', start: 0, end: 0.5 }], [], { hook: 'Mira {esto}', hookEnd: 3 })
  assert.match(ass, /PlayResX: 1080\nPlayResY: 1920/)
  assert.match(ass, /Style: Hook,Anton,/)
  assert.match(ass, /Dialogue: 1,0:00:00\.00,0:00:03\.00,Hook,,0,0,0,,Mira esto/)
  assert.match(ass, /Dialogue: 0,0:00:00\.00,0:00:00\.50,Caption,,0,0,0,,HOLA/)
})

test('keepSegments + mapTime: quita los tramos cortados y remapea tiempos', () => {
  const keep = keepSegments([{ start: 2, end: 4 }, { start: 3.9, end: 5 }], 10, 0)
  assert.deepEqual(keep, [{ start: 0, end: 2 }, { start: 5, end: 10 }])
  assert.equal(mapTime(1, keep), 1)
  assert.equal(mapTime(3, keep), null)
  assert.equal(mapTime(6, keep), 3)
  assert.equal(selectExpr(keep), 'between(t,0.000,2.000)+between(t,5.000,10.000)')
})

test('parseSilences: lee el log de silencedetect e incluye el silencio final', () => {
  const logs = ['[silencedetect] silence_start: 1.5', '[silencedetect] silence_end: 2.75 | silence_duration: 1.25', 'silence_start: 9']
  assert.deepEqual(parseSilences(logs, 10), [{ start: 1.5, end: 2.75 }, { start: 9, end: 10 }])
})

test('getProfile: los 10 primeros son los calibrados y los demás son deterministas y en rango', () => {
  assert.equal(getProfile(0), PROFILES[0])
  assert.deepEqual(getProfile(23), getProfile(23))
  for (let i = 10; i < 200; i++) {
    const p = getProfile(i)
    assert.ok(p.br >= -0.06 && p.br <= 0.06)
    assert.ok(p.co >= 0.9 && p.co <= 1.1)
    assert.ok(p.vo >= 0.88 && p.vo <= 1.12)
    assert.ok(p.hue >= -5 && p.hue <= 5)
  }
})

test('variationArgs: color + gancho + velocidad + zoom, sin metadatos', () => {
  const spec = { profile: PROFILES[1], assPath: 'sub.ass', speed: 1.02, zoom: 1.03 }
  const vf = videoFilter(spec)
  assert.match(vf, /^eq=brightness=0.04:contrast=1.06:saturation=1.12:gamma=0.94,hue=h=3,/)
  assert.match(vf, /scale=trunc\(iw\*1.03\/2\)\*2:trunc\(ih\*1.03\/2\)\*2,crop=/)
  assert.match(vf, /setpts=PTS\/1.02,ass=sub.ass:fontsdir=\/customfonts$/)
  assert.equal(audioFilter(spec), 'volume=0.94,atempo=1.02')
  const { primary, noAudio } = variationArgs(spec)
  assert.deepEqual(primary.slice(0, 4), ['-i', 'in.mp4', '-vf', vf])
  assert.ok(primary.includes('-map_metadata'))
  assert.ok(noAudio.includes('-an'))
  assert.equal(primary.at(-1), 'out.mp4')
})

test('variationArgs: con logo usa filter_complex y overlay', () => {
  const { primary } = variationArgs({ profile: PROFILES[0], logoPath: 'logo.png', logoPos: 'bl' })
  const fc = primary[primary.indexOf('-filter_complex') + 1]
  assert.match(fc, /\[1:v\]scale=200:-1\[wm\];\[bg\]\[wm\]overlay=30:main_h-overlay_h-30\[v\]/)
  assert.ok(primary.includes('0:a?'))
})

test('duracionTotal: suma las tomas', () => {
  assert.equal(duracionTotal([10, 2.5]), 12.5)
})

test('duracionTotal: null si alguna toma no se pudo leer (no se suma a medias)', () => {
  assert.equal(duracionTotal([0]), null)
  assert.equal(duracionTotal([10, 0]), null)
  assert.equal(duracionTotal([10, Infinity]), null)
  assert.equal(duracionTotal([NaN]), null)
  assert.equal(duracionTotal([]), null)
})

test('casiTodoSilencio: un video mudo entero cuenta como silencio', () => {
  assert.equal(casiTodoSilencio([{ start: 0, end: 21.696 }], 21.717), true)
})

test('casiTodoSilencio: varios tramos que suman casi todo también', () => {
  assert.equal(casiTodoSilencio([{ start: 0, end: 10 }, { start: 10.2, end: 20 }], 20), true)
})

test('casiTodoSilencio: un video con voz y pausas normales no', () => {
  assert.equal(casiTodoSilencio([{ start: 2, end: 3 }, { start: 9, end: 12 }], 20), false)
  assert.equal(casiTodoSilencio([], 20), false)
})

test('casiTodoSilencio: sin duración no decide nada', () => {
  assert.equal(casiTodoSilencio([{ start: 0, end: 5 }], 0), false)
})
