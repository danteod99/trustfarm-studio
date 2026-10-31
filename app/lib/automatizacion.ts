// Lógica pura de loops y claves de API (sin imports del proyecto: la prueban los tests con node --test).
import { createHash, randomBytes } from "node:crypto";

/** Lima no tiene horario de verano: siempre UTC-5. */
const LIMA_OFFSET_H = -5;

/**
 * Próxima corrida de un loop: el siguiente día permitido (0 = domingo) a la hora `hour`:`minute` de Lima,
 * estrictamente después de `from`.
 */
export function nextRunAt(hour: number, days: number[], from: Date = new Date(), minute = 0): Date {
  const allowed = new Set(days.length ? days : [0, 1, 2, 3, 4, 5, 6]);
  // "Ahora" en Lima expresado como fecha UTC con los mismos números de reloj.
  const limaNow = new Date(from.getTime() + LIMA_OFFSET_H * 3600_000);
  for (let add = 0; add <= 7; add++) {
    const d = new Date(Date.UTC(limaNow.getUTCFullYear(), limaNow.getUTCMonth(), limaNow.getUTCDate() + add, hour, minute));
    const utc = new Date(d.getTime() - LIMA_OFFSET_H * 3600_000);
    if (allowed.has(d.getUTCDay()) && utc.getTime() > from.getTime()) return utc;
  }
  throw new Error("días inválidos");
}

/** "2026-11-01" + "19:30" en hora de Lima → instante UTC. null si el formato no es válido. */
export function limaToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const t = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (h > 23 || mi > 59) return null;
  // Rechaza fechas que no existen (31 de noviembre) en vez de dejar que Date las corra al mes siguiente.
  const day = new Date(Date.UTC(y, mo - 1, da));
  if (day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== da) return null;
  return new Date(Date.UTC(y, mo - 1, da, h - LIMA_OFFSET_H, mi));
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Clave nueva: "tsk_" + 40 caracteres aleatorios. Devuelve la clave, su hash y el prefijo visible. */
export function newApiKey(): { key: string; hash: string; prefix: string } {
  const bytes = randomBytes(40);
  let body = "";
  for (const b of bytes) body += ALFABETO[b % ALFABETO.length];
  const key = `tsk_${body}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 12) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

/** Saca la clave de "Authorization: Bearer tsk_…" (o de x-api-key). */
export function readApiKey(headers: { get(name: string): string | null }): string | null {
  const auth = headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(tsk_[A-Za-z0-9]{20,})\s*$/);
  if (m) return m[1];
  const x = (headers.get("x-api-key") || "").trim();
  return /^tsk_[A-Za-z0-9]{20,}$/.test(x) ? x : null;
}
