import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterGraph, ffmpegArgs, leerManifest, plantillasPermitidas, plantillaParaVersion, nombreSalida, validarPantalla,
  etiquetaPlantillaUi, quadValido, roundPy, fmt, LIGHT_SWEEP,
} from "../app/lib/pantalla-real.ts";

const py = JSON.parse(readFileSync(new URL("./fixtures/pantalla-real-python.json", import.meta.url), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../public/plantillas-pantalla/manifest.json", import.meta.url), "utf8"));
const todas = leerManifest(manifest);

test("grafo: idéntico al de trustclip (Python) en las 30 plantillas", () => {
  assert.equal(py.casos.length, 30);
  for (const c of py.casos) assert.equal(filterGraph(c.quad, c.plateSize[0], c.plateSize[1]), c.graph, c.id);
});

test("barrido de luz igual al de Python", () => assert.equal(LIGHT_SWEEP, py.light_sweep));

test("grafo: las 30 plantillas del manifest dan un grafo con números finitos y tamaños pares", () => {
  assert.equal(todas.length, 30);
  for (const t of todas) {
    const g = filterGraph(t.quad, t.plateSize[0], t.plateSize[1]);
    assert.ok(!/NaN|Infinity|undefined/.test(g), t.id);
    const m = g.match(/\[a\]scale=(\d+):(\d+):/)!;
    assert.equal(Number(m[1]) % 2, 0); assert.equal(Number(m[2]) % 2, 0);
  }
});

test("redondeos de Python: mitades al par", () => {
  assert.equal(roundPy(2.5), 2); assert.equal(roundPy(3.5), 4); assert.equal(roundPy(-2.5), -2); assert.equal(roundPy(2.4), 2);
  assert.equal(fmt(2.5, 0), "2"); assert.equal(fmt(3.5, 0), "4"); assert.equal(fmt(0.125, 2), "0.12"); assert.equal(fmt(1.005, 2), "1.00");
});

test("manifest: validación descarta plantillas rotas", () => {
  const malo = { templates: [
    { id: "tv_x", kind: "tv", plate: "tv_x.png", plateSize: [720, 1280], quad: [1, 1, 2, 2, 3, 3] },
    { id: "../x", kind: "tv", plate: "x.png", plateSize: [720, 1280], quad: [10, 10, 200, 10, 10, 300, 200, 300] },
    { id: "z_ok", kind: "tablet", plate: "z_ok.png", plateSize: [720, 1280], quad: [10, 10, 200, 10, 10, 300, 200, 300] },
    { id: "w_fuera", kind: "tv", plate: "w.png", plateSize: [720, 1280], quad: [10, 10, 2000, 10, 10, 300, 200, 300] },
  ] };
  assert.deepEqual(leerManifest(malo).map((t) => t.id), ["z_ok"]);
  assert.deepEqual(leerManifest(null), []);
  assert.equal(quadValido([0, 0, 5, 0, 0, 9, 5, 9], 720, 1280), false);
});

test("filtro de dispositivo: igual que elegir_plantillas de trustclip", () => {
  const ids = (f: Parameters<typeof plantillasPermitidas>[1]) => plantillasPermitidas(todas, f).map((t) => t.id);
  assert.deepEqual(ids("cualquiera"), py.seleccion.todas);
  assert.deepEqual(ids("tv"), py.seleccion.tv);
  assert.deepEqual(ids("monitor"), py.seleccion.monitor);
  assert.deepEqual(ids("raro" as never), py.seleccion.todas);
});

test("rotación: determinista, recorre todas las permitidas y no repite en una tanda", () => {
  const p = plantillasPermitidas(todas, "tv");
  const v1 = Array.from({ length: p.length }, (_, i) => plantillaParaVersion(p, 0, i)!.id);
  assert.equal(new Set(v1).size, p.length);
  assert.deepEqual(v1, Array.from({ length: p.length }, (_, i) => plantillaParaVersion(p, 0, i)!.id));
  assert.notEqual(plantillaParaVersion(p, 1, 0)!.id, plantillaParaVersion(p, 0, 0)!.id);
  assert.equal(plantillaParaVersion([], 0, 0), null);
  assert.equal(plantillaParaVersion(p, 0, 50)!.id, p[50 % p.length].id);
});

test("nombres de salida", () => {
  const t = todas.find((x) => x.id === "laptop_cuarto")!;
  assert.equal(nombreSalida("mi video", 3, t), "mi video_v3_laptop-cuarto.mp4");
  assert.equal(nombreSalida("clip", 1, null), "clip_v1.mp4");
});

test("etiquetas: monitor se muestra como «PC / monitor»", () => {
  assert.equal(etiquetaPlantillaUi(todas.find((x) => x.id === "monitor_creador")!), "PC / monitor · creador");
  assert.equal(etiquetaPlantillaUi(todas.find((x) => x.id === "movil_auto")!), "Celular · auto");
});

test("validación", () => {
  assert.deepEqual(validarPantalla(false, [], "tv"), { ok: true });
  assert.equal(validarPantalla(true, [], "tv").ok, false);
  assert.equal(validarPantalla(true, todas.filter((t) => t.kind === "tv"), "movil").ok, false);
  assert.deepEqual(validarPantalla(true, todas, "movil"), { ok: true });
});

test("args de ffmpeg: 3 entradas, salida [v], audio opcional y tope de duración", () => {
  const a = ffmpegArgs({ input: "var.mp4", plate: "placa.png", output: "o.mp4", graph: "G", duracion: 15 });
  assert.deepEqual(a.slice(0, 6), ["-i", "var.mp4", "-loop", "1", "-framerate", "24"]);
  assert.ok(a.includes("-filter_complex") && a[a.indexOf("-filter_complex") + 1] === "G");
  assert.ok(a.includes("0:a?") && a.at(-1) === "o.mp4");
  assert.equal(a[a.indexOf("-t") + 1], "15.10");
  assert.ok(!ffmpegArgs({ input: "a", plate: "b", output: "c", graph: "G" }).includes("-t"));
});
