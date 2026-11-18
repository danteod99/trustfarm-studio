import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarUsuario, normalizarSaltar, opcionesPerfil, textoPuesto, textoSeleccion } from "../app/lib/perfil.ts";

test("usuario: quita arroba, acepta link del perfil y rechaza todo lo que pueda ser una opción", () => {
  assert.equal(limpiarUsuario(" @mi.cuenta_1 "), "mi.cuenta_1");
  assert.equal(limpiarUsuario("https://www.tiktok.com/@trust.peru?lang=es"), "trust.peru");
  for (const mal of ["", "@", "--exec=calc", "a b", "a/b", "a;b", "x".repeat(49), null, 5]) assert.equal(limpiarUsuario(mal), null, String(mal));
});

test("opciones: tope de videos, variación y pantalla solo con variación", () => {
  assert.equal(opcionesPerfil({ usuario: "" }), null);
  assert.equal(opcionesPerfil({ usuario: "a", max_videos: 99 })?.max_videos, 10);
  assert.equal(opcionesPerfil({ usuario: "a", max_videos: 0 })?.max_videos, 10);
  assert.equal(opcionesPerfil({ usuario: "a", max_videos: 3 })?.max_videos, 3);
  assert.deepEqual(opcionesPerfil({ usuario: "a", pantalla: "tv" }), { tipo: "perfil", handle: "a", max_videos: 10, variacion: null });
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", pantalla: "tv" })?.pantalla, "tv");
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", pantalla: "x" })?.pantalla, undefined);
});

test("opciones: variación marco con estilo en lista blanca; estilo/pantalla no se mezclan", () => {
  const m = opcionesPerfil({ usuario: "a", variacion: "marco", estilo: "blur", pantalla: "tv" });
  assert.deepEqual(m, { tipo: "perfil", handle: "a", max_videos: 10, variacion: "marco", estilo: "blur" });
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "marco", estilo: "../x" })?.estilo, "mixto");
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "marco" })?.estilo, "mixto");
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", estilo: "blur" })?.estilo, undefined);
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "otra", estilo: "blur" })?.variacion, null);
  assert.equal("estilo" in (opcionesPerfil({ usuario: "a", estilo: "blur" }) ?? {}), false);
});

test("opciones: dispositivos nuevos de pantalla real en lista blanca", () => {
  for (const d of ["laptop", "tv", "movil", "tablet", "monitor"]) assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", pantalla: d })?.pantalla, d);
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", pantalla: "mixto" })?.pantalla, undefined);
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "pantalla_real", pantalla: "celular" })?.pantalla, undefined);
  assert.equal(opcionesPerfil({ usuario: "a", variacion: "marco", pantalla: "movil" })?.pantalla, undefined);
});

test("opciones: versiones 1-5 y tope de 50 salidas por trabajo", () => {
  assert.equal("versiones" in (opcionesPerfil({ usuario: "a" }) ?? {}), false);
  assert.equal("versiones" in (opcionesPerfil({ usuario: "a", versiones: 1 }) ?? {}), false);
  assert.equal(opcionesPerfil({ usuario: "a", versiones: 3, max_videos: 4 })?.versiones, 3);
  assert.equal(opcionesPerfil({ usuario: "a", versiones: 99 })?.versiones, 5);
  assert.equal(opcionesPerfil({ usuario: "a", versiones: "x" })?.versiones, undefined);
  assert.equal(opcionesPerfil({ usuario: "a", versiones: 5, max_videos: 10 })?.max_videos, 10);   // 10 x 5 = 50
  assert.equal(opcionesPerfil({ usuario: "a", versiones: 5, max_videos: 99 })?.max_videos, 10);
});

test('orden y saltar: normalización y solo se guardan si no son los valores por defecto', () => {
  assert.equal("orden" in (opcionesPerfil({ usuario: "a" }) ?? {}), false)
  assert.equal("saltar" in (opcionesPerfil({ usuario: "a", orden: "recientes", saltar: 0 }) ?? {}), false)
  assert.equal(opcionesPerfil({ usuario: "a", orden: "virales" })?.orden, "virales")
  assert.equal("orden" in (opcionesPerfil({ usuario: "a", orden: "raro" }) ?? {}), false)
  assert.equal(opcionesPerfil({ usuario: "a", saltar: 2 })?.saltar, 2)
  assert.equal(opcionesPerfil({ usuario: "a", saltar: 99 })?.saltar, 30)
  assert.equal("saltar" in (opcionesPerfil({ usuario: "a", saltar: -3 }) ?? {}), false)
  assert.equal("saltar" in (opcionesPerfil({ usuario: "a", saltar: "x" }) ?? {}), false)
  assert.equal(opcionesPerfil({ usuario: "a", orden: "virales", saltar: 1, max_videos: 3 })?.max_videos, 3)
  assert.equal(normalizarSaltar(2.9), 2)
})

test('textoSeleccion y textoPuesto', () => {
  assert.equal(textoSeleccion("virales", 0, 3), "Los 3 más virales")
  assert.equal(textoSeleccion("virales", 0, 1), "El más viral")
  assert.equal(textoSeleccion("virales", 1, 3), "Del 2.º al 4.º más viral")
  assert.equal(textoSeleccion("virales", 2, 1), "El 3.º más viral")
  assert.equal(textoSeleccion("recientes", 0, 5), "Los 5 más recientes")
  assert.equal(textoSeleccion("recientes", 2, 3), "3 videos recientes, saltando los 2 primeros")
  assert.equal(textoPuesto({ views: 1200000, puesto: 2, orden: "virales" }), "Puesto 2 más viral · 1,2 M vistas")
  assert.equal(textoPuesto({ views: 5142, puesto: 1, orden: "recientes" }), "5,1 mil vistas")
  assert.equal(textoPuesto({ views: 900 }), "900 vistas")
  assert.equal(textoPuesto({}), null)
})
