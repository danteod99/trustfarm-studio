import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paginaAdminCajas, TAM_PAGINA_ADMIN } from '../app/lib/cajas/admin-lista.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const T0 = new Date('2026-10-30T12:00:00Z')
const OWNER = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
function conCajas(n: number) {
  const r = crearClienteMem({ t: new Date(T0) })
  for (let i = 0; i < n; i++) {
    r.m.cajas.push({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, ownerId: OWNER, nombre: 'c' + i, slug: 's' + i, tunnelId: 'TUNEL-SECRETO-' + i,
      lastSeen: null, version: '1.0.' + i, creadaEn: new Date(T0.getTime() + i * 1000).toISOString(),
    })
  }
  return r
}

test('el almacén simulado respeta desde/limite y ordena por creación descendente', async () => {
  const { deps } = conCajas(5)
  const a = await deps.store.listarTodasLasCajas(0, 2)
  assert.deepEqual(a.map(c => c.nombre), ['c4', 'c3'])
  const b = await deps.store.listarTodasLasCajas(2, 2)
  assert.deepEqual(b.map(c => c.nombre), ['c2', 'c1'])
})

test('paginaAdminCajas: 100 por página y hay_mas con limite+1', async () => {
  assert.equal(TAM_PAGINA_ADMIN, 100)
  const { deps } = conCajas(101)
  const p0 = await paginaAdminCajas(deps, 0)
  assert.equal(p0.cajas.length, 100)
  assert.equal(p0.hay_mas, true)
  const p1 = await paginaAdminCajas(deps, 1)
  assert.equal(p1.cajas.length, 1)
  assert.equal(p1.hay_mas, false)
  assert.equal(p1.cajas[0].nombre, 'c0')
})

test('paginaAdminCajas: justo 100 no marca hay_mas; página vacía', async () => {
  const { deps } = conCajas(100)
  assert.equal((await paginaAdminCajas(deps, 0)).hay_mas, false)
  const v = await paginaAdminCajas(deps, 5)
  assert.deepEqual(v, { cajas: [], hay_mas: false })
})

test('paginaAdminCajas: forma de salida sin tunnel_id y página inválida cae a 0', async () => {
  const { deps } = conCajas(1)
  const p = await paginaAdminCajas(deps, -3)
  assert.deepEqual(Object.keys(p.cajas[0]).sort(), ['direccion', 'estado', 'id', 'nombre', 'owner_id', 'ultima_senal', 'version', 'vinculada_en'])
  assert.equal(p.cajas[0].direccion, 's0.cajas.test')
  assert.equal(p.cajas[0].estado, 'apagada')
  assert.ok(!JSON.stringify(p).includes('TUNEL-SECRETO'))
})
