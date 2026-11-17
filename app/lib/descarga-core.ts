// Descarga automática de entregas de bucles a una carpeta del computador (File System Access API).
// Aquí vive SOLO la lógica pura: nombres, qué falta por bajar, dedupe y el motor de sincronización.
// Las APIs del navegador (IndexedDB, carpeta, fetch) entran por interfaces inyectables (ver descarga-navegador.ts).
// Nunca toca el estado de las entregas en el servidor: el registro de «ya guardado» es local por carpeta, así no
// le quita entregas a TrustFarm Desktop si el usuario usa ambos.

export interface EntregaWeb {
  id: string; loop_id: string; loop_name: string; titulo: string; caption: string;
  video_url: string | null; bytes?: number | null;
}

export interface EstadoDescarga {
  habilitada: boolean;
  nombreCarpeta: string | null;
  guardados: string[];            // ids de entregas ya escritas en esta carpeta (más recientes al final)
  ultima: string | null;          // ISO de la última descarga correcta
  ultimoError: string | null;
}
export const ESTADO_VACIO: EstadoDescarga = { habilitada: false, nombreCarpeta: null, guardados: [], ultima: null, ultimoError: null };
export const MAX_GUARDADOS = 2000;
export const CONCURRENCIA = 2;
export const POR_LLAMADA = 10;

const SIN_ACENTOS = /[̀-ͯ]/g;
/** Segmento seguro para Windows/macOS/Linux (sin separadores ni caracteres reservados). */
export function limpiarNombre(s: string, max = 60, vacio = "video"): string {
  const t = String(s ?? "").normalize("NFD").replace(SIN_ACENTOS, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").replace(/^[._-]+|[._-]+$/g, "").slice(0, max).replace(/[._-]+$/g, "");
  return t || vacio;
}

/** Sub-carpeta del bucle: `<nombre>-<id8>`. */
export const carpetaDeBucle = (e: Pick<EntregaWeb, "loop_id" | "loop_name">) => `${limpiarNombre(e.loop_name, 40, "bucle")}-${e.loop_id.replace(/-/g, "").slice(0, 8)}`;
/** Base de archivo: `<titulo>-<id8>` (sin extensión). El video es `.mp4` y el caption `.txt`. */
export const baseDeArchivo = (e: Pick<EntregaWeb, "id" | "titulo">) => `${limpiarNombre(e.titulo, 60)}-${e.id.replace(/-/g, "").slice(0, 8)}`;

/** Primer nombre libre: `base.ext`, `base-2.ext`, … (nunca sobrescribe). */
export async function nombreLibre(base: string, ext: string, existe: (n: string) => Promise<boolean>): Promise<string> {
  for (let i = 1; i < 1000; i++) {
    const n = i === 1 ? `${base}.${ext}` : `${base}-${i}.${ext}`;
    if (!(await existe(n))) return n;
  }
  throw new Error("Demasiados archivos con el mismo nombre.");
}

/** Entregas con video que todavía no se guardaron en esta carpeta (sin repetidos). */
export function faltantes(entregas: EntregaWeb[], guardados: string[]): EntregaWeb[] {
  const ya = new Set(guardados);
  const vistos = new Set<string>();
  return entregas.filter((e) => {
    if (!e.video_url || ya.has(e.id) || vistos.has(e.id)) return false;
    vistos.add(e.id);
    return true;
  });
}

export const agregarGuardados = (guardados: string[], nuevos: string[]) =>
  [...guardados.filter((g) => !nuevos.includes(g)), ...nuevos].slice(-MAX_GUARDADOS);

// ───────── Interfaces inyectables ─────────

export interface CarpetaPort {
  existe(sub: string, nombre: string): Promise<boolean>;
  /** Escribe el archivo completo (crea sub-carpeta si falta). Si falla, no debe dejar un archivo a medias. */
  escribir(sub: string, nombre: string, datos: Blob | string): Promise<void>;
}
export interface ServidorPort {
  /** Pide al servidor las entregas que NO están en `ya` (máx. POR_LLAMADA) con URL firmada. */
  pendientes(ya: string[]): Promise<{ items: EntregaWeb[]; restantes: number }>;
  descargar(url: string): Promise<Blob>;
}
export interface AlmacenPort {
  leer(): Promise<EstadoDescarga>;
  guardar(e: EstadoDescarga): Promise<void>;
}
export interface ResultadoSync { guardadas: number; errores: string[]; restantes: number }

/** Guarda una entrega: primero el video, luego el caption; solo si ambos salen bien se considera guardada. */
export async function guardarEntrega(e: EntregaWeb, carpeta: CarpetaPort, srv: Pick<ServidorPort, "descargar">): Promise<void> {
  if (!e.video_url) throw new Error("Sin URL de descarga.");
  const sub = carpetaDeBucle(e);
  const base = baseDeArchivo(e);
  const blob = await srv.descargar(e.video_url);
  if (!blob.size) throw new Error("El archivo llegó vacío.");
  const mp4 = await nombreLibre(base, "mp4", (n) => carpeta.existe(sub, n));
  await carpeta.escribir(sub, mp4, blob);
  if (e.caption.trim()) {
    const txt = `${mp4.replace(/\.mp4$/, "")}.txt`; // mismo nombre que el video, aunque se haya sufijado
    if (!(await carpeta.existe(sub, txt))) await carpeta.escribir(sub, txt, e.caption.trim());
  }
}

/** Una pasada: pide lo que falta, descarga con concurrencia limitada y registra solo lo que salió bien. */
export async function sincronizar(
  deps: { almacen: AlmacenPort; carpeta: CarpetaPort; servidor: ServidorPort; ahora?: () => Date },
  opciones: { maxLlamadas?: number } = {},
): Promise<ResultadoSync> {
  const ahora = deps.ahora ?? (() => new Date());
  let est = await deps.almacen.leer();
  const res: ResultadoSync = { guardadas: 0, errores: [], restantes: 0 };
  const fallidas = new Set<string>(); // en esta pasada no se reintentan (evita bucle infinito)
  for (let llamada = 0; llamada < (opciones.maxLlamadas ?? 5); llamada++) {
    const { items, restantes } = await deps.servidor.pendientes([...est.guardados, ...fallidas]);
    res.restantes = restantes;
    const lote = faltantes(items, est.guardados);
    if (!lote.length) break;
    const hechas: string[] = [];
    let i = 0;
    const worker = async () => {
      while (i < lote.length) {
        const e = lote[i++];
        try { await guardarEntrega(e, deps.carpeta, deps.servidor); hechas.push(e.id); }
        catch (err) { fallidas.add(e.id); res.errores.push(`${e.titulo || e.id.slice(0, 8)}: ${String((err as Error)?.message ?? err).slice(0, 120)}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, lote.length) }, worker));
    if (hechas.length) {
      est = { ...est, guardados: agregarGuardados(est.guardados, hechas), ultima: ahora().toISOString() };
      res.guardadas += hechas.length;
      await deps.almacen.guardar(est); // se persiste tras cada lote: un fallo posterior no repite lo ya bajado
    }
    if (!hechas.length || restantes <= 0) break;
  }
  est = { ...est, ultimoError: res.errores.length ? res.errores[res.errores.length - 1] : null };
  await deps.almacen.guardar(est);
  return res;
}
