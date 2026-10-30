import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLANES,
  getPlan,
  precioCentavos,
  PAISES_ENVIO,
  ENTREGA_TEXTO,
  CONTACTO,
  libroReclamacionesUrl,
  ventaAbierta,
  paginaVisible,
} from '../app/lib/minipc.ts'

test('hay exactamente 3 planes con ids basico, pro, negocio', () => {
  assert.deepEqual(PLANES.map((p) => p.id), ['basico', 'pro', 'negocio'])
})

test('precios y mensualidades del catalogo', () => {
  assert.deepEqual(PLANES.map((p) => p.precioUsd), [490, 790, 1290])
  assert.deepEqual(PLANES.map((p) => p.mensualUsd), [39, 79, 129])
  assert.deepEqual(PLANES.map(precioCentavos), [49000, 79000, 129000])
})

test('solo pro es recomendado y todos estan activos', () => {
  assert.deepEqual(PLANES.filter((p) => p.recomendado).map((p) => p.id), ['pro'])
  assert.ok(PLANES.every((p) => p.activo === true))
})

test('equipo, memoria, subtitulo e ideal para', () => {
  assert.deepEqual(PLANES.map((p) => p.equipo), ['Intel N150', 'AMD Ryzen 7 7735HS', 'AMD Ryzen 7 7735HS'])
  assert.deepEqual(PLANES.map((p) => p.memoria), ['12 GB RAM · 128 GB SSD', '24 GB RAM · 512 GB SSD', '24 GB RAM · 1 TB SSD'])
  assert.deepEqual(PLANES.map((p) => p.subtitulo), ['Para empezar', 'Vende + video', 'Alto volumen'])
  assert.deepEqual(PLANES.map((p) => p.idealPara), ['Bodegas y negocios chicos', 'Negocios que venden y publican', 'Alto volumen y agencias'])
})

test('incluye de cada plan', () => {
  const inc = (id: string) => getPlan(id)?.incluye
  assert.deepEqual(inc('basico'), ['Vendedor IA + CRM', '1 número de WhatsApp', 'Resumen diario', 'Soporte Lima'])
  assert.deepEqual(inc('pro'), ['Todo lo del Básico', 'Vendedor + estudio de video', 'Multiclipping y variaciones', 'Catálogo cargado por nosotros'])
  assert.deepEqual(inc('negocio'), ['Todo lo del Pro', 'Más espacio para videos', 'Capacitación para tu equipo', 'Soporte prioritario'])
})

test('getPlan por id exacto', () => {
  assert.equal(getPlan('pro')?.nombre, 'Pro')
  assert.equal(getPlan('basico')?.nombre, 'Básico')
  assert.equal(getPlan('negocio')?.nombre, 'Negocio')
  assert.equal(getPlan('x'), undefined)
  assert.equal(getPlan('PRO'), undefined)
  assert.equal(getPlan(undefined), undefined)
  assert.equal(getPlan(5), undefined)
  assert.equal(getPlan('toString'), undefined)
})

test('envio solo a Peru y entrega', () => {
  assert.deepEqual(PAISES_ENVIO, ['PE'])
  assert.equal(ENTREGA_TEXTO, '5 a 7 días')
})

test('contacto', () => {
  assert.equal(CONTACTO.whatsapp, '+51 970 912 014')
  assert.equal(CONTACTO.whatsappUrl, 'https://wa.me/51970912014')
  assert.equal(CONTACTO.oficina, 'Pueblo Libre, Lima')
  assert.equal(CONTACTO.tiktok, '@trust.peru')
})

test('ventaAbierta solo con "1"', () => {
  assert.equal(ventaAbierta({}), false)
  assert.equal(ventaAbierta({ MINIPC_VENTA_ACTIVA: '0' }), false)
  assert.equal(ventaAbierta({ MINIPC_VENTA_ACTIVA: 'true' }), false)
  assert.equal(ventaAbierta({ MINIPC_VENTA_ACTIVA: ' 1' }), false)
  assert.equal(ventaAbierta({ MINIPC_VENTA_ACTIVA: '1' }), true)
})

test('paginaVisible solo con "1"', () => {
  assert.equal(paginaVisible({}), false)
  assert.equal(paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: '0' }), false)
  assert.equal(paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: 'true' }), false)
  assert.equal(paginaVisible({ NEXT_PUBLIC_MINIPC_VISIBLE: '1' }), true)
})

test('libroReclamacionesUrl exige https://', () => {
  assert.equal(libroReclamacionesUrl({}), null)
  assert.equal(libroReclamacionesUrl({ NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL: '' }), null)
  assert.equal(libroReclamacionesUrl({ NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL: 'http://x.pe/l' }), null)
  assert.equal(libroReclamacionesUrl({ NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL: 'javascript:alert(1)' }), null)
  assert.equal(libroReclamacionesUrl({ NEXT_PUBLIC_LIBRO_RECLAMACIONES_URL: 'https://x.pe/libro' }), 'https://x.pe/libro')
})
