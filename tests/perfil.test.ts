import { test } from "node:test";
import assert from "node:assert/strict";
import { limpiarUsuario, opcionesPerfil } from "../app/lib/perfil.ts";

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
