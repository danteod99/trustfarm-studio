// Consumo de IA por caja: resumen, alertas de uso raro, lo que ve el cliente y lo que controla el administrador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertasCaja, resumirConsumo, respuestasRestantes, type FilaConsumo } from '../app/lib/ia/alertas.ts'
import { listarMisCajas } from '../app/lib/cajas/cliente-servicio.ts'
import { fijarIaAdmin, paginaAdminCajas } from '../app/lib/cajas/admin-lista.ts'
import { crearClienteMem } from './cajas-cliente-mem.ts'

const T0 = new Date('2026-11-20T17:00:00Z')
const U1 = 'f2ebed30-50df-424c-a9e5-fd571cfcadf6'
const C1 = '00000000-0000-4000-8000-000000000001'
const HAIKU = 'claude-haiku-5-5'
const fila = (o: Partial<FilaConsumo>): FilaConsumo => ({ caja_id: C1, dia: '2026-11-20', modelo: HAIKU, solicitudes: 1, costo_microusd: 0, creditos_micro: 0, cambios_ip: 0, ...o })

test('resumirConsumo: separa hoy, mes y los 7 días anteriores, por caja', () => {
  const r = resumirConsumo([
    fila({ creditos_micro: 2_000_000, costo_microusd: 80_000, solicitudes: 10, cambios_ip: 3 }),
    fila({ modelo: 'claude-sonnet-5-5', creditos_micro: 1_000_000, costo_microusd: 40_000, solicitudes: 2, cambios_ip: 1 }),
    fila({ dia: '2026-11-19', creditos_micro: 7_000_000, costo_microusd: 280_000, solicitudes: 8 }),
    fila({ dia: '2026-11-13', creditos_micro: 7_000_000 }), // justo 7 días antes
    fila({ dia: '2026-11-12', creditos_micro: 100_000_000 }), // fuera de los 7 días, dentro del mes
    fila({ dia: '2026-10-31', creditos_micro: 500_000_000 }), // otro mes y fuera de los 7 días
    fila({ caja_id: 'otra', creditos_micro: 9_000_000 }),
  ], '2026-11-20')
  assert.deepEqual(r[C1], {
    creditosHoy: 3,
    creditosMes: 117,
    costoMesUsd: 0.4,
    solicitudesMes: 22,
    cambiosIpHoy: 4,
    mediaDiaria7d: 2,
  })
  assert.equal(r.otra.creditosHoy, 9)
})

test('alertasCaja: avisa cambios de red y consumo fuera de lo normal; lo normal no alerta', () => {
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 0, creditosHoy: 5, mediaDiaria7d: 5 }), [])
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 4, creditosHoy: 0, mediaDiaria7d: 0 }), [])
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 5, creditosHoy: 0, mediaDiaria7d: 0 }), ['Cambia mucho de red'])
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 0, creditosHoy: 20, mediaDiaria7d: 6 }), ['Consumo fuera de lo normal'])
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 0, creditosHoy: 20, mediaDiaria7d: 7 }), [], 'menos de 3 veces lo normal')
  assert.deepEqual(alertasCaja({ cambiosIpHoy: 0, creditosHoy: 19, mediaDiaria7d: 0 }), [], 'muy poco para alertar')
  assert.equal(alertasCaja({ cambiosIpHoy: 9, creditosHoy: 50, mediaDiaria7d: 1 }).length, 2)
})

test('respuestasRestantes: con poca historia no inventa un número', () => {
  assert.equal(respuestasRestantes(10, { creditosMes: 1, solicitudesMes: 40 }), 400)
  assert.equal(respuestasRestantes(0, { creditosMes: 1, solicitudesMes: 40 }), 0)
  assert.equal(respuestasRestantes(10, { creditosMes: 1, solicitudesMes: 9 }), null)
  assert.equal(respuestasRestantes(10, { creditosMes: 0, solicitudesMes: 40 }), null)
})

const entorno = () => {
  const ahora = { t: new Date(T0) }
  const r = crearClienteMem(ahora)
  r.m.cajas.push({ id: C1, ownerId: U1, nombre: 'Bodega', slug: 'bodega', tunnelId: 't', lastSeen: null })
  return { ahora, ...r }
}

test('Mis cajas: el cliente ve créditos y saldo, nunca tokens ni costos', async () => {
  const { m, deps } = entorno()
  m.saldos[U1] = 15
  m.consumo.push(fila({ creditos_micro: 1_500_000, costo_microusd: 60_000, solicitudes: 60 }))
  const r = await listarMisCajas(deps, { userId: U1 })
  const b = r.body as { cajas: Array<Record<string, unknown>>; saldo: number; ia_respuestas_restantes: number | null }
  assert.equal(b.saldo, 15)
  assert.equal(b.ia_respuestas_restantes, 600)
  assert.equal(b.cajas[0].ia_creditos_hoy, 1.5)
  assert.equal(b.cajas[0].ia_creditos_mes, 1.5)
  const texto = JSON.stringify(b)
  assert.doesNotMatch(texto, /token|costo|micro|usd/i)
})

test('Mis cajas: sin consumo todavía muestra cero y no falla', async () => {
  const { deps } = entorno()
  const b = (await listarMisCajas(deps, { userId: U1 })).body as { cajas: Array<Record<string, unknown>>; ia_respuestas_restantes: number | null }
  assert.equal(b.cajas[0].ia_creditos_mes, 0)
  assert.equal(b.ia_respuestas_restantes, null)
})

test('panel: costo real, cobrado, alertas, bloqueo y tope de cada caja', async () => {
  const { m, deps } = entorno()
  m.cajas[0].iaBloqueada = true
  m.cajas[0].topeDiarioIa = 30
  m.consumo.push(fila({ creditos_micro: 25_000_000, costo_microusd: 1_000_000, solicitudes: 500, cambios_ip: 6 }))
  const c = (await paginaAdminCajas(deps, 0)).cajas[0]
  assert.equal(c.ia_creditos_mes, 25)
  assert.equal(c.ia_costo_mes_usd, 1)
  assert.equal(c.ia_bloqueada, true)
  assert.equal(c.tope_diario_ia, 30)
  assert.deepEqual(c.ia_alertas, ['Cambia mucho de red', 'Consumo fuera de lo normal'])
})

test('fijarIaAdmin: bloquea, desbloquea y cambia el tope, con los mismos límites que el del Estudio', async () => {
  const { m, deps } = entorno()
  assert.deepEqual(await fijarIaAdmin(deps, { cajaId: C1, bloqueada: true }), { ok: true })
  assert.equal(m.cajas[0].iaBloqueada, true)
  assert.deepEqual(await fijarIaAdmin(deps, { cajaId: C1, bloqueada: false, topeIa: 40 }), { ok: true })
  assert.equal(m.cajas[0].iaBloqueada, false)
  assert.equal(m.cajas[0].topeDiarioIa, 40)
  for (const malo of [-1, 10_001, 1.5, 'x']) {
    const r = await fijarIaAdmin(deps, { cajaId: C1, topeIa: malo })
    assert.equal(r.ok, false, String(malo))
    if (!r.ok) assert.equal(r.status, 400)
  }
  const nada = await fijarIaAdmin(deps, { cajaId: C1 })
  assert.equal(nada.ok, false)
  const b = await fijarIaAdmin(deps, { cajaId: 'no-existe', bloqueada: true })
  assert.equal(b.ok, false)
  if (!b.ok) assert.equal(b.status, 404)
})
