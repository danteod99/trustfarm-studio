import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneText } from "../app/lib/escena.ts";

test("prompt simple: queda igual", () => {
  assert.equal(sceneText("Una fresa baila en la cocina"), "Una fresa baila en la cocina");
});

test("quita personaje/estilo antepuestos y la cámara", () => {
  const p = 'Estilo visual: 3D\nPersonaje "Fresita": roja\n\nEscena: La fresa salta\nCámara: plano fijo.';
  assert.equal(sceneText(p), "La fresa salta");
});

test("escena de una historia: solo lo que pasa ahora, sin repetir la anterior", () => {
  const p =
    'Personaje "Fresita": roja\n\nEscena: Continuación directa del video anterior: arranca exactamente... ' +
    "Antes pasó: La fresa salta\nAhora: La fresa cae al agua\nCámara: órbita suave.";
  assert.equal(sceneText(p), "La fresa cae al agua");
});

test("continuación sin personaje ni escena anterior", () => {
  assert.equal(sceneText("Continuación directa del video anterior: ... Ahora: Corre hacia la puerta"), "Corre hacia la puerta");
});
