import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IDEAS, type Idea } from '../app/lib/ideas.ts'
import {
  combinarIdeas, ideaAFila, ideaPublica, parseVariaciones, promptDeVariacion, validarIdea, variacionesATexto, type FilaIdea,
} from '../app/lib/ideas-datos.ts'

const base = (o: Partial<Idea> = {}): Idea => ({
  id: 'caja-miniatura',
  category: 'Tecnología y granjas',
  title: 'Granja en miniatura',
  hook: 'Una caja de iPhones como si fuera un juguete.',
  kind: 'image',
  model: 'z-image',
  aspect: '9:16',
  prompt: 'Caja de 40 iPhones en miniatura, tilt-shift, luz de estudio.',
  ...o,
})
const video = (o: Partial<Idea> = {}) => base({ kind: 'video', model: 'ltx-25', duration: 5, resolution: '720p', ...o })
const fila = (o: Partial<FilaIdea> = {}): FilaIdea => ({ ...ideaAFila(base(), 5), ...o })
const VARIACIONES = [1, 2, 3].map((n) => ({ titulo: `V${n}`, prompt: `Variación ${n} con [lugar: oficina / garaje]` }))

test('validarIdea: acepta una idea de imagen y una de video completas', () => {
  assert.ok('fila' in validarIdea(base()))
  assert.ok('fila' in validarIdea(video()))
})

test('validarIdea: todas las ideas del archivo pasan, así se pueden editar desde admin', () => {
  const malas = IDEAS.map((i) => [i.id, validarIdea(i)] as const).filter(([, r]) => 'error' in r)
  assert.deepEqual(malas, [])
})

for (const [nombre, o] of [
  ['id con espacios', { id: 'mi idea' }],
  ['id con mayúsculas', { id: 'MiIdea' }],
  ['categoría inventada', { category: 'Cripto' }],
  ['título vacío', { title: ' ' }],
  ['modelo inexistente', { model: 'no-existe' }],
  ['tipo que no es el del modelo', { kind: 'video' }],
  ['formato que el modelo no tiene', { model: 'veo-lite', kind: 'video', aspect: '1:1', duration: 4, resolution: '720p' }],
  ['prompt corto', { prompt: 'corto' }],
  ['imagen externa', { image: 'https://malo.com/x.jpg' }],
  ['imagen con doble barra', { image: '//malo.com/x.jpg' }],
  ['video con javascript', { video: 'javascript:alert(1)' }],
] as [string, Partial<Idea>][]) {
  test(`validarIdea: rechaza ${nombre}`, () => {
    assert.ok('error' in validarIdea(base(o)))
  })
}

test('validarIdea: un video exige duración y resolución que el modelo tenga', () => {
  assert.ok('error' in validarIdea(video({ duration: undefined })))
  assert.ok('error' in validarIdea(video({ duration: 999 })))
  assert.ok('error' in validarIdea(video({ resolution: undefined })))
})

test('validarIdea: una imagen no guarda campos de video', () => {
  const r = validarIdea(base({ duration: 5, resolution: '720p', motion: 'fija' }))
  assert.ok('fila' in r)
  assert.equal(r.fila.duration, null)
  assert.equal(r.fila.resolution, null)
  assert.equal(r.fila.motion, null)
})

test('validarIdea: variaciones, ninguna o de 3 a 5', () => {
  assert.ok('fila' in validarIdea(base({ variaciones: [] })))
  assert.ok('fila' in validarIdea(base({ variaciones: VARIACIONES })))
  assert.ok('error' in validarIdea(base({ variaciones: VARIACIONES.slice(0, 2) })))
  assert.ok('error' in validarIdea(base({ variaciones: [...VARIACIONES, ...VARIACIONES] })))
  assert.ok('error' in validarIdea(base({ variaciones: [VARIACIONES[0], VARIACIONES[1], { titulo: 'x', prompt: 'no' }] })))
})

test('validarIdea: ignora entradas que no son objeto sin romperse', () => {
  assert.ok('error' in validarIdea(null))
  assert.ok('error' in validarIdea('hola'))
  assert.ok('error' in validarIdea(base({ variaciones: 'hola' as never })))
})

test('combinarIdeas: sin filas (tabla vacía o caída) quedan las del archivo', () => {
  const r = combinarIdeas([base(), base({ id: 'otra' })], [])
  assert.deepEqual(r.publicas.map((i) => i.id), ['caja-miniatura', 'otra'])
})

test('combinarIdeas: la base reemplaza a la idea del archivo con el mismo id', () => {
  const r = combinarIdeas([base()], [fila({ title: 'Editada' })])
  assert.equal(r.publicas.length, 1)
  assert.equal(r.publicas[0].title, 'Editada')
})

test('combinarIdeas: una idea nueva de la base aparece junto a las del archivo', () => {
  const r = combinarIdeas([base()], [fila({ id: 'nueva', orden: 0 })])
  assert.deepEqual(r.publicas.map((i) => i.id), ['nueva', 'caja-miniatura'])
})

test('combinarIdeas: oculta sale de lo público, también si viene del archivo, pero admin la ve', () => {
  const r = combinarIdeas([base()], [fila({ oculta: true })])
  assert.deepEqual(r.publicas, [])
  assert.equal(r.todas.length, 1)
  assert.equal(r.todas[0].oculta, true)
})

test('combinarIdeas: las tendencias van primero', () => {
  const r = combinarIdeas([base({ id: 'a' }), base({ id: 'b' })], [fila({ id: 'b', tendencia: true, orden: 9 })])
  assert.deepEqual(r.publicas.map((i) => i.id), ['b', 'a'])
})

test('combinarIdeas: admin distingue lo que ya está en la base', () => {
  const r = combinarIdeas([base({ id: 'a' }), base({ id: 'b' })], [fila({ id: 'b' })])
  assert.deepEqual(Object.fromEntries(r.todas.map((i) => [i.id, i.enBase])), { a: false, b: true })
})

test('ideaPublica: no expone la fuente interna, pero sí la etiqueta de tendencia', () => {
  const r = ideaPublica(base({ fuente: 'blog de prompts', tendencia: true }))
  assert.equal(r.fuente, undefined)
  assert.equal(r.tendencia, true)
})

test('ideaAFila y vuelta: conserva variaciones y campos de video', () => {
  const v = video({ variaciones: VARIACIONES, motion: 'fija' })
  const r = combinarIdeas([], [ideaAFila(v, 1)])
  assert.deepEqual(r.todas[0].variaciones, VARIACIONES)
  assert.equal(r.todas[0].duration, 5)
  assert.equal(r.todas[0].motion, 'fija')
})

test('promptDeVariacion: usa la variación pedida y si no existe, el prompt principal', () => {
  const i = base({ variaciones: VARIACIONES })
  assert.equal(promptDeVariacion(i, '1'), VARIACIONES[1].prompt)
  for (const v of [null, '', '9', '-1', 'x', '1.5']) assert.equal(promptDeVariacion(i, v), i.prompt)
  assert.equal(promptDeVariacion(base(), '0'), base().prompt)
})

test('parseVariaciones: una por línea, título | prompt, e ida y vuelta con el formulario', () => {
  const texto = variacionesATexto(VARIACIONES)
  assert.deepEqual(parseVariaciones(texto), VARIACIONES)
  assert.deepEqual(parseVariaciones('\n  \n'), [])
  assert.deepEqual(parseVariaciones('Título | uno | dos'), [{ titulo: 'Título', prompt: 'uno | dos' }])
  assert.deepEqual(parseVariaciones('sin separador'), [{ titulo: '', prompt: 'sin separador' }])
})
