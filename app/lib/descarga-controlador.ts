"use client";
// Controlador único (por pestaña) de la descarga automática: lo comparten el panel de Bucles y el anfitrión del layout.
import { useSyncExternalStore } from "react";
import { ESTADO_VACIO, sincronizar, type EstadoDescarga, type ResultadoSync } from "@/app/lib/descarga-core";
import {
  almacenNavegador, carpetaDesdeHandle, elegirCarpeta, leerHandle, permisoCarpeta, quitarHandle, reactivarPermiso, servidorNavegador, soporteCarpeta,
} from "@/app/lib/descarga-navegador";

export type Permiso = "granted" | "prompt" | "denied" | "none";
export interface VistaDescarga {
  cargado: boolean; soporte: { ok: true } | { ok: false; motivo: string }; estado: EstadoDescarga; permiso: Permiso; ocupado: boolean; ultimo: ResultadoSync | null;
}
const INTERVALO_MS = 90_000;

let userId: string | null = null;
let vista: VistaDescarga = { cargado: false, soporte: { ok: false, motivo: "" }, estado: ESTADO_VACIO, permiso: "none", ocupado: false, ultimo: null };
const oyentes = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let handle: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any

const poner = (p: Partial<VistaDescarga>) => { vista = { ...vista, ...p }; oyentes.forEach((f) => f()); };

async function cargar() {
  if (!userId) return;
  const soporte = soporteCarpeta();
  if (!soporte.ok) return poner({ cargado: true, soporte });
  const estado = await almacenNavegador(userId).leer().catch(() => ESTADO_VACIO);
  handle = await leerHandle(userId).catch(() => null);
  const permiso: Permiso = handle ? ((await permisoCarpeta(handle).catch(() => "denied")) as Permiso) : "none";
  poner({ cargado: true, soporte, estado: handle ? estado : { ...estado, nombreCarpeta: null }, permiso });
}

export async function ahora(silencioso = false): Promise<void> {
  if (!userId || !handle || vista.ocupado || !vista.estado.habilitada) return;
  const uid = userId;
  if ((await permisoCarpeta(handle).catch(() => "denied")) !== "granted") return poner({ permiso: "prompt" });
  const correr = async () => {
    poner({ ocupado: true, permiso: "granted" });
    try {
      const r = await sincronizar({ almacen: almacenNavegador(uid), carpeta: carpetaDesdeHandle(handle), servidor: servidorNavegador });
      poner({ ultimo: r, estado: await almacenNavegador(uid).leer() });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 160);
      const estado = { ...(await almacenNavegador(uid).leer()), ultimoError: msg };
      await almacenNavegador(uid).guardar(estado);
      poner({ estado });
    } finally { poner({ ocupado: false }); }
  };
  // Un solo Studio abierto descarga a la vez (si hay otra pestaña corriendo, esta se salta la pasada).
  const locks = (navigator as any).locks; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (locks?.request) await locks.request("trustfarm-descarga", { ifAvailable: true }, async (l: unknown) => { if (l) await correr(); });
  else await correr();
  void silencioso;
}

async function guardarEstado(p: Partial<EstadoDescarga>) {
  if (!userId) return;
  const estado = { ...vista.estado, ...p };
  await almacenNavegador(userId).guardar(estado);
  poner({ estado });
}

export async function elegir(): Promise<string | null> {
  if (!userId) return null;
  try {
    handle = await elegirCarpeta(userId);
  } catch (e) {
    if ((e as DOMException).name === "AbortError") return null;
    return String((e as Error)?.message ?? e);
  }
  // Carpeta nueva = registro nuevo (lo guardado en la anterior no cuenta aquí).
  await guardarEstado({ nombreCarpeta: handle.name, habilitada: true, guardados: [], ultima: null, ultimoError: null });
  poner({ permiso: "granted" });
  void ahora();
  return null;
}
export async function reactivar() { if (handle && (await reactivarPermiso(handle))) { poner({ permiso: "granted" }); void ahora(); } }
export async function alternar(on: boolean) { await guardarEstado({ habilitada: on }); if (on) void ahora(); }
export async function quitar() {
  if (!userId) return;
  await quitarHandle(userId); handle = null;
  await guardarEstado({ ...ESTADO_VACIO });
  poner({ permiso: "none", ultimo: null });
}

const alVolver = () => { if (document.visibilityState === "visible") void ahora(true); };
export function iniciar(uid: string): () => void {
  userId = uid;
  void cargar().then(() => ahora(true));
  timer = setInterval(() => { if (document.visibilityState === "visible") void ahora(true); }, INTERVALO_MS);
  document.addEventListener("visibilitychange", alVolver);
  window.addEventListener("focus", alVolver);
  return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("focus", alVolver); };
}

export function useDescarga(): VistaDescarga {
  return useSyncExternalStore((f) => { oyentes.add(f); return () => { oyentes.delete(f); }; }, () => vista, () => vista);
}
