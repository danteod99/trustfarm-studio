import { test } from "node:test";
import assert from "node:assert/strict";
import { argsConcat, argsNormalizar, listaConcat, mover, tamanoSalida } from "../app/lib/video/unir.ts";

test("tamaño de salida en pares", () => {
  assert.deepEqual(tamanoSalida(721, 1279), { w: 722, h: 1280 });
  assert.deepEqual(tamanoSalida(0, 0), { w: 720, h: 1280 });
});

test("normalizar con audio usa la pista del video", () => {
  const a = argsNormalizar("in.mp4", "n0.mp4", 720, 1280, true);
  assert.ok(a.includes("0:a:0"));
  assert.ok(!a.includes("lavfi"));
});

test("normalizar sin audio le pone silencio y corta al largo del video", () => {
  const a = argsNormalizar("in.mp4", "n0.mp4", 720, 1280, false);
  assert.ok(a.includes("lavfi") && a.includes("1:a:0") && a.includes("-shortest"));
});

test("lista concat escapa comillas", () => {
  assert.equal(listaConcat(["n0.mp4", "a'b.mp4"]), "file 'n0.mp4'\nfile 'a'\\''b.mp4'\n");
  assert.deepEqual(argsConcat("l.txt", "o.mp4").slice(0, 6), ["-f", "concat", "-safe", "0", "-i", "l.txt"]);
});

test("mover reordena sin mutar", () => {
  const l = ["a", "b", "c", "d"];
  assert.deepEqual(mover(l, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(mover(l, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(mover(l, 1, 1), l);
  assert.deepEqual(l, ["a", "b", "c", "d"]);
});
