// Adaptadores de navegador para descarga-core: IndexedDB (carpeta + estado) y File System Access API.
// Solo Chrome/Edge de escritorio (showDirectoryPicker). No se prueba en headless; la lógica está en descarga-core.ts.
import { ESTADO_VACIO, type AlmacenPort, type CarpetaPort, type EstadoDescarga, type ServidorPort } from "@/app/lib/descarga-core";

/* eslint-disable @typescript-eslint/no-explicit-any */
type DirHandle = any;

export function soporteCarpeta(): { ok: true } | { ok: false; motivo: string } {
  if (typeof window === "undefined") return { ok: false, motivo: "Solo disponible en el navegador." };
  if (!window.isSecureContext) return { ok: false, motivo: "Necesita una conexión segura (https)." };
  if (window.top !== window.self) return { ok: false, motivo: "No funciona dentro de un marco incrustado." };
  if (typeof (window as any).showDirectoryPicker !== "function") {
    return { ok: false, motivo: "Tu navegador no permite guardar en carpetas. Usa Chrome o Edge en el computador (no funciona en Safari, Firefox ni celular)." };
  }
  return { ok: true };
}

const DB = "trustfarm-descarga", STORE = "kv";
function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function kvGet<T>(k: string): Promise<T | undefined> {
  const db = await abrir();
  return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(k); q.onsuccess = () => res(q.result as T); q.onerror = () => rej(q.error); });
}
async function kvSet(k: string, v: unknown): Promise<void> {
  const db = await abrir();
  return new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
async function kvDel(k: string): Promise<void> {
  const db = await abrir();
  return new Promise((res, rej) => { const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}

// El estado se guarda por usuario; el handle también (otra cuenta en el mismo navegador no hereda la carpeta).
export const almacenNavegador = (userId: string): AlmacenPort => ({
  async leer() { return { ...ESTADO_VACIO, ...((await kvGet<EstadoDescarga>(`estado:${userId}`)) ?? {}) }; },
  async guardar(e) { await kvSet(`estado:${userId}`, e); },
});
export const leerHandle = (userId: string) => kvGet<DirHandle>(`handle:${userId}`);
export const quitarHandle = (userId: string) => kvDel(`handle:${userId}`);

export async function elegirCarpeta(userId: string): Promise<DirHandle> {
  const h = await (window as any).showDirectoryPicker({ id: "trustfarm-bucles", mode: "readwrite", startIn: "downloads" });
  await kvSet(`handle:${userId}`, h);
  return h;
}

/** "granted" | "prompt" | "denied" (no pide nada: seguro llamarlo sin gesto del usuario). */
export async function permisoCarpeta(h: DirHandle): Promise<string> { return h.queryPermission({ mode: "readwrite" }); }
/** Debe llamarse desde un clic. */
export async function reactivarPermiso(h: DirHandle): Promise<boolean> { return (await h.requestPermission({ mode: "readwrite" })) === "granted"; }

export function carpetaDesdeHandle(raiz: DirHandle): CarpetaPort {
  const sub = (s: string, create: boolean) => raiz.getDirectoryHandle(s, { create });
  return {
    async existe(s, nombre) {
      try { const d = await sub(s, false); await d.getFileHandle(nombre); return true; }
      catch (e) { if ((e as DOMException).name === "NotFoundError") return false; throw e; }
    },
    async escribir(s, nombre, datos) {
      const d = await sub(s, true);
      const fh = await d.getFileHandle(nombre, { create: true });
      const w = await fh.createWritable(); // escribe a un temporal; solo se confirma con close()
      try { await w.write(datos); await w.close(); }
      catch (e) { try { await w.abort(); } catch { /* ya cerrado */ } throw e; }
    },
  };
}

export const servidorNavegador: ServidorPort = {
  async pendientes(ya) {
    const r = await fetch("/api/bucles/descarga", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ya }) });
    if (!r.ok) throw new Error(r.status === 401 ? "Inicia sesión otra vez." : "No se pudo consultar las entregas.");
    const d = await r.json();
    return { items: d.items ?? [], restantes: d.restantes ?? 0 };
  },
  async descargar(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Descarga falló (${r.status}).`);
    return r.blob();
  },
};
