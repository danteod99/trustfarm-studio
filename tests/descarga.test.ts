import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  baseDeArchivo, carpetaDeBucle, faltantes, limpiarNombre, nombreLibre, sincronizar, ESTADO_VACIO, CONCURRENCIA,
  type CarpetaPort, type EntregaWeb, type EstadoDescarga, type ServidorPort,
} from '../app/lib/descarga-core.ts'

const ent = (n: number, over: Partial<EntregaWeb> = {}): EntregaWeb => ({
  id: `0000000${n}-aaaa-bbbb-cccc-dddddddddddd`, loop_id: 'abcdef12-0000-0000-0000-000000000000', loop_name: 'Mi bucle ñandú', titulo: `Título ${n}: ¡hola!`,
  caption: `caption ${n}`, video_url: `https://x/${n}.mp4`, ...over,
})

function mundo(items: EntregaWeb[], opts: { falla?: Set<string>; estado?: Partial<EstadoDescarga> } = {}) {
  const archivos = new Map<string, string | Blob>()
  let estado: EstadoDescarga = { ...ESTADO_VACIO, habilitada: true, ...opts.estado }
  let activas = 0, maxActivas = 0
  const carpeta: CarpetaPort = {
    existe: async (s, n) => archivos.has(`${s}/${n}`),
    escribir: async (s, n, d) => { archivos.set(`${s}/${n}`, d) },
  }
  const servidor: ServidorPort = {
    pendientes: async (ya) => { const f = items.filter((i) => !ya.includes(i.id)); return { items: f.slice(0, 10), restantes: Math.max(0, f.length - 10) } },
    descargar: async (url) => {
      activas++; maxActivas = Math.max(maxActivas, activas)
      await new Promise((r) => setTimeout(r, 5)); activas--
      if (opts.falla?.has(url)) throw new Error('boom')
      return new Blob(['datos'])
    },
  }
  const almacen = { leer: async () => estado, guardar: async (e: EstadoDescarga) => { estado = e } }
  return { archivos, get estado() { return estado }, get maxActivas() { return maxActivas }, deps: { almacen, carpeta, servidor, ahora: () => new Date('2026-11-17T10:00:00Z') } }
}

test('nombres: seguros, con id8 y sub-carpeta por bucle', () => {
  assert.equal(limpiarNombre('¡Hola/mundo: ñ?*'), 'Hola_mundo_n')
  assert.equal(limpiarNombre('///'), 'video')
  assert.equal(carpetaDeBucle(ent(1)), 'Mi_bucle_nandu-abcdef12')
  assert.equal(baseDeArchivo(ent(1)), 'Titulo_1_hola-00000001')
  assert.ok(limpiarNombre('a'.repeat(200)).length <= 60)
})

test('nombreLibre: no sobrescribe, sufija', async () => {
  const usados = new Set(['a.mp4', 'a-2.mp4'])
  assert.equal(await nombreLibre('a', 'mp4', async (n) => usados.has(n)), 'a-3.mp4')
  assert.equal(await nombreLibre('b', 'mp4', async (n) => usados.has(n)), 'b.mp4')
})

test('faltantes: quita guardados, repetidos y sin URL', () => {
  const a = ent(1), b = ent(2), c = ent(3, { video_url: null })
  assert.deepEqual(faltantes([a, a, b, c], [a.id]).map((x) => x.id), [b.id])
})

test('sincronizar: guarda mp4 + txt, registra ids y es idempotente', async () => {
  const w = mundo([ent(1), ent(2)])
  const r = await sincronizar(w.deps)
  assert.equal(r.guardadas, 2)
  assert.ok(w.archivos.has('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001.mp4'))
  assert.equal(w.archivos.get('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001.txt'), 'caption 1')
  assert.equal(w.estado.guardados.length, 2)
  assert.equal(w.estado.ultima, '2026-11-17T10:00:00.000Z')
  const r2 = await sincronizar(w.deps)
  assert.equal(r2.guardadas, 0)
  assert.equal(w.archivos.size, 4)
})

test('sincronizar: archivo existente con el mismo nombre no se sobrescribe (txt gemelo sufijado)', async () => {
  const w = mundo([ent(1)])
  w.archivos.set('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001.mp4', 'viejo')
  await sincronizar(w.deps)
  assert.equal(w.archivos.get('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001.mp4'), 'viejo')
  assert.ok(w.archivos.has('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001-2.mp4'))
  assert.equal(w.archivos.get('Mi_bucle_nandu-abcdef12/Titulo_1_hola-00000001-2.txt'), 'caption 1')
})

test('sincronizar: fallo no se marca como guardado, no frena a los demás ni reintenta en la misma pasada', async () => {
  const w = mundo([ent(1), ent(2)], { falla: new Set(['https://x/1.mp4']) })
  const r = await sincronizar(w.deps)
  assert.equal(r.guardadas, 1)
  assert.equal(r.errores.length, 1)
  assert.deepEqual(w.estado.guardados, [ent(2).id])
  assert.match(w.estado.ultimoError ?? '', /boom/)
  assert.equal([...w.archivos.keys()].some((k) => k.includes('00000001')), false)
})

test('sincronizar: concurrencia máxima 2 y pagina más de 10', async () => {
  const items = Array.from({ length: 14 }, (_, i) => ent(i + 1))
  const w = mundo(items)
  const r = await sincronizar(w.deps)
  assert.equal(r.guardadas, 14)
  assert.ok(w.maxActivas <= CONCURRENCIA && w.maxActivas >= 1)
})

test('sincronizar: respeta ids ya guardados del estado', async () => {
  const w = mundo([ent(1), ent(2)], { estado: { guardados: [ent(1).id] } })
  const r = await sincronizar(w.deps)
  assert.equal(r.guardadas, 1)
  assert.equal(w.estado.guardados.length, 2)
})
