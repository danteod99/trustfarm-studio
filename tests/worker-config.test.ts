import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lora = (ruta: string) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf-8')).models['z-image'].loras_estilo[0]
const casa = lora('../worker/config.example.json')
const runpod = lora('../runpod/config.json')

test('casa y RunPod aplican el LoRA igual: mismo archivo, regex y pista', () => {
  assert.equal(casa.archivo, runpod.archivo)
  assert.equal(casa.si, runpod.si)
  assert.equal(casa.pista, runpod.pista)
})

test('la pista de escena pide celulares y no incluye la palabra interna, que se dibujaría', () => {
  assert.match(casa.pista, /smartphones/)
  assert.doesNotMatch(casa.pista, /dntfarm/i)
  assert.equal(casa.palabra, undefined)
})
