/**
 * Motor de video del navegador (ffmpeg.wasm) compartido por /editar y Modo Granja.
 * Solo cliente ("use client"): no importar desde rutas API.
 *
 * Carga
 *   loadEngine(onStatus?) → Promise<{ ffmpeg, multiThread }>   una instancia por pestaña;
 *       hoy siempre un hilo (multiThread = false; ver MULTIHILO en engine.ts).
 *   resetEngine()                     descarta el motor tras un error grave.
 *   onProgress(fn) → unsubscribe       avance 0–1 del exec en curso.
 *
 * Archivos (FS virtual de ffmpeg)
 *   writeInput(ffmpeg, name, Blob|Uint8Array|string), readBlob(ffmpeg, name, mime?),
 *   safeDelete(ffmpeg, ...names), execLogged(ffmpeg, args) → { code, logs },
 *   extractAudioMp3(ffmpeg, input?) → Blob|null (mono 16 kHz para transcribir),
 *   mountFont(ffmpeg) deja Anton en /customfonts (necesario antes de quemar un ASS).
 *
 * Variaciones (Multiediting / Modo Granja)
 *   PROFILES, getProfile(i)            10 perfiles calibrados + infinitos deterministas.
 *   variationArgs(spec) / videoFilter(spec) / audioFilter(spec)   puros.
 *   renderVariation(ffmpeg, spec) → Blob MP4 (reintenta sin audio).
 *   spec = { profile, input?, output?, assPath?, logoPath?, logoPos?, speed?, zoom?, crf? }
 *   speed ≈ 0.97–1.03 y zoom ≈ 1.02–1.05 sirven para que cada cuenta reciba un archivo distinto;
 *   siempre se borran los metadatos del original.
 *
 * Subtítulos y ganchos (ASS, puros)
 *   buildAss(W, H, words?, segments?, { hook?, hookStart?, hookEnd?, secondary? })
 *     → subtítulos estilo TikTok abajo + texto de gancho fijo arriba. Escribirlo con
 *     writeInput(ffmpeg, "sub.ass", ass) y pasar assPath: "sub.ass" en el spec.
 *   captionLines, assTime, assEscape.
 *
 * Cortes (editor de cortos, puros)
 *   keepSegments(cuts, dur), mapTime(t, keep), parseSilences(logs, dur), selectExpr(keep).
 *
 * Medios (DOM)
 *   getVideoInfo(Blob|url) → { w, h, dur }, fetchAsFile(url, name, onProgress?), isVideoFile, fmtMB,
 *   downloadBlobUrl(url, name).
 *
 * Ejemplo (una variación con gancho):
 *   const { ffmpeg } = await loadEngine(setStatus);
 *   await writeInput(ffmpeg, "in.mp4", file);
 *   const { w, h } = await getVideoInfo(file);
 *   await mountFont(ffmpeg);
 *   await writeInput(ffmpeg, "sub.ass", buildAss(w, h, [], [], { hook: "Así gané 100 cuentas" }));
 *   const mp4 = await renderVariation(ffmpeg, { profile: getProfile(3), assPath: "sub.ass", speed: 1.02, zoom: 1.03 });
 */

export * from "./engine.ts";
export * from "./media.ts";
export * from "./ass.ts";
export * from "./cuts.ts";
export * from "./cortos-cobro.ts";
export * from "./profiles.ts";
export * from "./unir.ts";
