import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bloqueDe, desplazar, embedDeLink, filtrarMomentos, nombreClip, refBloque, reloj, segmentosPara, sesionValida, solape, textoVentana, tipoValido,
} from '../app/lib/en-vivo.ts'

test('embedDeLink: YouTube watch, live, youtu.be y canal', () => {
  assert.equal(embedDeLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'x')?.src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&playsinline=1')
  assert.equal(embedDeLink('https://youtube.com/live/dQw4w9WgXcQ?si=abc', 'x')?.plataforma, 'youtube')
  assert.equal(embedDeLink('https://youtu.be/dQw4w9WgXcQ', 'x')?.plataforma, 'youtube')
  assert.match(embedDeLink('https://m.youtube.com/channel/UCabcdefghijklmnopqrstuv/live', 'x')!.src, /live_stream\?channel=UCabcdefghijklmnopqrstuv/)
  assert.equal(embedDeLink('https://www.youtube.com/@canal', 'x'), null)
})

test('embedDeLink: Twitch lleva parent con el dominio y Kick su player', () => {
  assert.equal(embedDeLink('https://www.twitch.tv/ibai', 'trustfarm.online')?.src,
    'https://player.twitch.tv/?channel=ibai&parent=trustfarm.online&autoplay=true&muted=false')
  assert.equal(embedDeLink('https://kick.com/westcol', 'x')?.src, 'https://player.kick.com/westcol?autoplay=true&muted=false')
  assert.equal(embedDeLink('https://www.tiktok.com/@alguien/live', 'x'), null)
  assert.equal(embedDeLink('no es link', 'x'), null)
})

test('cobro por bloques de 10 minutos con ref única', () => {
  assert.equal(bloqueDe(0), 0)
  assert.equal(bloqueDe(599.9), 0)
  assert.equal(bloqueDe(600), 1)
  assert.equal(bloqueDe(NaN), 0)
  assert.equal(refBloque('u1', 'ses-12345678', 2), 'vivo:u1:ses-12345678:2')
  assert.ok(sesionValida('0b7c5f0e-6c1a-4d3e-9a51-2f8f6a1d1c11'))
  assert.ok(!sesionValida('x'))
  assert.ok(!sesionValida("a'; drop table--"))
})

test('desplazar pasa los tiempos del trozo al de la transmisión', () => {
  assert.deepEqual(desplazar([{ start: 1.23, end: 4, text: ' hola ' }, { start: 5, end: 6, text: '  ' }], 60),
    [{ start: 61.2, end: 64, text: 'hola' }])
})

test('textoVentana solo incluye lo que cae en la ventana', () => {
  const t = textoVentana([{ start: 0, end: 5, text: 'a' }, { start: 100, end: 105, text: 'b' }], 50, 200)
  assert.equal(t, '[100.0–105.0] b')
})

test('filtrarMomentos: puntaje, duración, ventana y sin repetir', () => {
  const v = { desde: 100, hasta: 400 }
  const out = filtrarMomentos([
    { inicio: 120, fin: 160, titulo: 'Bueno', gancho: 'g', puntaje: 8, motivo: 'm' },
    { inicio: 200, fin: 210, titulo: 'Muy corto', gancho: '', puntaje: 9, motivo: '' },
    { inicio: 250, fin: 300, titulo: 'Flojo', gancho: '', puntaje: 5, motivo: '' },
    { inicio: 50, fin: 110, titulo: 'Fuera de ventana', gancho: '', puntaje: 9, motivo: '' },
    { inicio: 300, fin: 500, titulo: 'Largo', gancho: '', puntaje: 9, motivo: '' },
    { inicio: 125, fin: 165, titulo: 'Repetido', gancho: '', puntaje: 9, motivo: '' },
    'basura',
  ], v, [])
  assert.deepEqual(out.map((m) => [m.titulo, m.inicio, m.fin]), [['Bueno', 120, 160], ['Largo', 300, 390]])
  // ya clipeado antes → no se repite
  assert.equal(filtrarMomentos([{ inicio: 121, fin: 158, puntaje: 9 }], v, [{ inicio: 120, fin: 160 }]).length, 0)
})

test('solape y segmentosPara', () => {
  assert.equal(solape({ inicio: 0, fin: 10 }, { inicio: 5, fin: 20 }), 0.5)
  assert.equal(solape({ inicio: 0, fin: 10 }, { inicio: 10, fin: 20 }), 0)
  const segs = [0, 5, 10, 15, 20].map((t0) => ({ t0, t1: t0 + 5 }))
  assert.deepEqual(segmentosPara(segs, 7, 16).map((s) => s.t0), [5, 10, 15])
})

test('reloj, nombreClip y tipoValido', () => {
  assert.equal(reloj(65), '1:05')
  assert.equal(reloj(3725), '1:02:05')
  assert.equal(nombreClip(3, '¡Qué opinión tan fuerte!', 'mp4'), '03-que-opinion-tan-fuerte.mp4')
  assert.equal(nombreClip(1, '???', 'webm'), '01-clip.webm')
  assert.equal(tipoValido('stream'), 'stream')
  assert.equal(tipoValido('cualquier'), 'podcast')
})
