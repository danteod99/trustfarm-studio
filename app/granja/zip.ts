"use client";

// ZIP en el navegador con fflate, en streaming: los MP4 van sin comprimir (ya vienen comprimidos)
// y se agregan uno por uno, así no se duplica en memoria todo el lote.

import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

export interface ZipEntry { path: string; data: Blob | string }

export async function buildZip(entries: ZipEntry[]): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  let done!: () => void;
  let fail!: (e: unknown) => void;
  const finished = new Promise<void>((res, rej) => { done = res; fail = rej; });
  const zip = new Zip((err, chunk, final) => {
    if (err) return fail(err);
    chunks.push(chunk);
    if (final) done();
  });
  for (const e of entries) {
    if (typeof e.data === "string") {
      const f = new ZipDeflate(e.path, { level: 6 });
      zip.add(f);
      f.push(new TextEncoder().encode(e.data), true);
    } else {
      const f = new ZipPassThrough(e.path);
      zip.add(f);
      f.push(new Uint8Array(await e.data.arrayBuffer()), true);
    }
  }
  zip.end();
  await finished;
  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}
