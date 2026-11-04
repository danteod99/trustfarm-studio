// Modo Granja (fase B): funciones puras compartidas por la página /granja y sus rutas API.
// Sin DOM ni Supabase: se prueban con node --test (tests/granja.test.ts).
//   - parseAccountsText: lista pegada de cuentas → cuentas normalizadas y sin repetir.
//   - buildPlan / splitParts: qué video base, perfil, zoom y velocidad lleva cada salida.
//   - validateHooks: revisa el JSON de ganchos que devuelve Claude.

import { getProfile, type Profile } from "./video/profiles.ts";

export const NETWORKS = ["tiktok", "instagram", "facebook", "youtube"] as const;
export type Network = (typeof NETWORKS)[number];

export const NETWORK_LABEL: Record<Network, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

/** Máximo de cuentas guardadas por usuario. */
export const MAX_FARM_ACCOUNTS = 1000;
/** Máximo de notas por cuenta. */
export const MAX_NOTES = 500;
/** Videos base por lote y videos por cuenta. */
export const MAX_BASE_VIDEOS = 5;
export const MAX_PER_ACCOUNT = 3;
/** Ganchos por crédito (1 crédito cada 20 ganchos, mínimo 1). */
export const GANCHOS_POR_CREDITO = 20;
/** Ganchos por llamada a la API (múltiplo de 20 para que el cobro por lotes no redondee de más). */
export const GANCHOS_POR_LOTE = 120;
/** Videos por ZIP en lotes grandes. */
export const VIDEOS_POR_ZIP = 40;
/** Palabras máximas de un gancho. */
export const MAX_HOOK_WORDS = 8;

export interface FarmAccountInput { handle: string; network: Network }

export interface ParseResult {
  accounts: FarmAccountInput[];
  /** Líneas que no se entendieron. */
  invalid: string[];
  /** Líneas repetidas que se descartaron. */
  duplicates: number;
}

const NETWORK_ALIASES: Record<string, Network> = {
  tiktok: "tiktok", tt: "tiktok", tik: "tiktok",
  instagram: "instagram", ig: "instagram", insta: "instagram",
  facebook: "facebook", fb: "facebook", face: "facebook",
  youtube: "youtube", yt: "youtube",
};

export function parseNetwork(s: string): Network | null {
  return NETWORK_ALIASES[s.trim().toLowerCase()] ?? null;
}

/** Handle limpio: sin @, en minúsculas, solo letras, números, punto, guion y guion bajo. */
export function normalizeHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  if (!h || h.length > 60 || !/^[a-z0-9._-]+$/.test(h)) return null;
  if (/^[._-]+$/.test(h)) return null;
  return h;
}

/** Saca handle y red de una URL de perfil (tiktok, instagram, facebook, youtube). */
export function parseProfileUrl(raw: string): FarmAccountInput | null {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) {
    if (!/^(www\.|m\.|vm\.)?(tiktok|instagram|facebook|fb|youtube)\.com\//i.test(s)) return null;
    s = "https://" + s;
  }
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  let network: Network | null = null;
  let handle: string | null = null;
  if (host === "tiktok.com") {
    network = "tiktok";
    const p = parts.find((x) => x.startsWith("@"));
    handle = p ? normalizeHandle(p) : null;
  } else if (host === "instagram.com") {
    network = "instagram";
    if (parts[0] && !["p", "reel", "reels", "stories", "explore"].includes(parts[0].toLowerCase())) handle = normalizeHandle(parts[0]);
  } else if (host === "facebook.com" || host === "fb.com") {
    network = "facebook";
    if (parts[0] === "profile.php") handle = normalizeHandle(u.searchParams.get("id") || "");
    else if (parts[0] === "people" && parts[2]) handle = normalizeHandle(parts[2]);
    else if (parts[0]) handle = normalizeHandle(parts[0]);
  } else if (host === "youtube.com") {
    network = "youtube";
    const p = parts.find((x) => x.startsWith("@"));
    if (p) handle = normalizeHandle(p);
    else if ((parts[0] === "c" || parts[0] === "user" || parts[0] === "channel") && parts[1]) handle = normalizeHandle(parts[1]);
  }
  return network && handle ? { network, handle } : null;
}

/** Una línea: URL, `@handle`, `handle` o `handle,red` (también con ; tab o espacio). */
export function parseAccountLine(line: string, defaultNetwork: Network): FarmAccountInput | null {
  const s = line.trim();
  if (!s) return null;
  const url = parseProfileUrl(s);
  if (url) return url;
  const parts = s.split(/[,;\t]|\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) {
    const h = normalizeHandle(parts[0]);
    return h ? { handle: h, network: defaultNetwork } : null;
  }
  if (parts.length === 2) {
    // handle,red o red,handle
    const [a, b] = parts;
    const nb = parseNetwork(b), na = parseNetwork(a);
    if (nb) { const h = normalizeHandle(a); return h ? { handle: h, network: nb } : null; }
    if (na) { const h = normalizeHandle(b); return h ? { handle: h, network: na } : null; }
  }
  return null;
}

export const accountKey = (a: FarmAccountInput) => `${a.network}:${a.handle}`;

/** Lista pegada (una cuenta por línea) → cuentas sin repetir. */
export function parseAccountsText(text: string, defaultNetwork: Network = "tiktok", max = MAX_FARM_ACCOUNTS): ParseResult {
  const seen = new Set<string>();
  const accounts: FarmAccountInput[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const acc = parseAccountLine(line, defaultNetwork);
    if (!acc) { if (invalid.length < 200) invalid.push(line.slice(0, 120)); continue; }
    const k = accountKey(acc);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    if (accounts.length < max) accounts.push(acc);
  }
  return { accounts, invalid, duplicates };
}

/** Nombres genéricos para quien aún no tiene cuentas: cuenta-001, cuenta-002… */
export function genericAccounts(n: number): FarmAccountInput[] {
  const count = Math.max(1, Math.min(MAX_FARM_ACCOUNTS, Math.floor(n) || 1));
  return Array.from({ length: count }, (_, i) => ({ handle: `cuenta-${String(i + 1).padStart(3, "0")}`, network: "tiktok" as Network }));
}

/** Créditos de un lote de ganchos. */
export function hooksCost(count: number): number {
  return count <= 0 ? 0 : Math.max(1, Math.ceil(count / GANCHOS_POR_CREDITO));
}

// ---------------------------------------------------------------- plan de variaciones

export interface PlanItem {
  /** Índice global (0-based) de la salida. */
  i: number;
  /** Índice de la cuenta en la lista elegida. */
  account: number;
  /** Número de video dentro de la cuenta (1-based). */
  n: number;
  /** Video base (0-based) que usa. */
  base: number;
  /** Índice de perfil de color (getProfile). */
  profileIndex: number;
  profile: Profile;
  zoom: number;
  speed: number;
}

/**
 * Plan de salidas: cuentas × videos por cuenta. Cada salida usa un perfil de color distinto
 * (nunca el 0, que es el original sin cambios), rota los videos base y combina zoom 1.00–1.06
 * y velocidad 0.97–1.03 con pasos coprimos para que no se repitan en el mismo orden.
 */
export function buildPlan(accountCount: number, perAccount: number, baseCount: number): PlanItem[] {
  const per = Math.max(1, Math.min(MAX_PER_ACCOUNT, Math.floor(perAccount)));
  const bases = Math.max(1, Math.min(MAX_BASE_VIDEOS, Math.floor(baseCount)));
  const out: PlanItem[] = [];
  let i = 0;
  for (let a = 0; a < accountCount; a++) {
    for (let n = 1; n <= per; n++, i++) {
      const profileIndex = i + 1;
      out.push({
        i,
        account: a,
        n,
        base: i % bases,
        profileIndex,
        profile: getProfile(profileIndex),
        zoom: Number((1 + ((i * 3) % 7) * 0.01).toFixed(2)),
        speed: Number((0.97 + ((i * 5 + Math.floor(i / 7) * 2 + 3) % 7) * 0.01).toFixed(2)),
      });
    }
  }
  return out;
}

/** Firma de una salida (para comprobar que no hay dos iguales). */
export function planSignature(p: PlanItem): string {
  return JSON.stringify([p.base, p.profile, p.zoom, p.speed]);
}

/** Agrupa el plan en partes de hasta `size` videos sin partir una cuenta entre dos ZIP. */
export function splitParts(plan: PlanItem[], size = VIDEOS_POR_ZIP): PlanItem[][] {
  const parts: PlanItem[][] = [];
  let cur: PlanItem[] = [];
  let i = 0;
  while (i < plan.length) {
    const acc = plan[i].account;
    const group: PlanItem[] = [];
    while (i < plan.length && plan[i].account === acc) group.push(plan[i++]);
    if (cur.length && cur.length + group.length > size) { parts.push(cur); cur = []; }
    cur.push(...group);
  }
  if (cur.length) parts.push(cur);
  return parts;
}

/** Nombre de carpeta por cuenta dentro del ZIP (@handle; si se repite en otra red, @handle-red). */
export function folderNames(accounts: FarmAccountInput[]): string[] {
  const count = new Map<string, number>();
  for (const a of accounts) count.set(a.handle, (count.get(a.handle) ?? 0) + 1);
  return accounts.map((a) => ((count.get(a.handle) ?? 0) > 1 ? `@${a.handle}-${a.network}` : `@${a.handle}`));
}

// ---------------------------------------------------------------- ganchos (Claude)

export interface HookSlot { id: string; handle: string; network: Network; personaje?: string }
export interface HookItem { hook: string; caption: string }

export interface HookValidation {
  items: Record<string, HookItem>;
  /** Ids sin gancho válido (faltan, repetidos, largos o con promesas). */
  missing: string[];
}

/** Para comparar ganchos: minúsculas, sin tildes ni signos. */
export function hookKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();
}

export const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Promesas de dinero o claims engañosos que no deben salir en un gancho/caption. */
const PROHIBIDO = /garantizad|dinero f[aá]cil|hazte rico|millonari|sin esfuerzo|ingresos? pasivos? asegurad|(?:\$|s\/|usd|us\$)\s?\d|\d+\s?(?:soles|d[oó]lares|usd)\b/i;

export function hashtags(caption: string): string[] {
  return caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

/**
 * Revisa la respuesta de Claude `{ videos: [{ id, gancho, caption }] }` contra los slots pedidos.
 * Acepta solo ganchos de 1–8 palabras, sin repetir (tampoco contra `avoid`), caption con 3–5
 * hashtags y sin promesas de dinero. Lo demás queda en `missing`.
 */
export function validateHooks(raw: unknown, slots: { id: string }[], avoid: string[] = []): HookValidation {
  const want = new Set(slots.map((s) => s.id));
  const used = new Set(avoid.map(hookKey).filter(Boolean));
  const items: Record<string, HookItem> = {};
  const list = raw && typeof raw === "object" && Array.isArray((raw as { videos?: unknown }).videos)
    ? ((raw as { videos: unknown[] }).videos)
    : [];
  for (const v of list) {
    if (!v || typeof v !== "object") continue;
    const { id, gancho, caption } = v as { id?: unknown; gancho?: unknown; caption?: unknown };
    if (typeof id !== "string" || !want.has(id) || items[id]) continue;
    if (typeof gancho !== "string" || typeof caption !== "string") continue;
    const hook = gancho.replace(/\s+/g, " ").replace(/^["'«“]+|["'»”]+$/g, "").trim();
    const cap = caption.trim();
    const words = countWords(hook);
    if (words < 1 || words > MAX_HOOK_WORDS || hook.length > 70) continue;
    const key = hookKey(hook);
    if (!key || used.has(key)) continue;
    const tags = hashtags(cap);
    if (tags.length < 3 || tags.length > 5 || cap.length > 600) continue;
    if (PROHIBIDO.test(hook) || PROHIBIDO.test(cap)) continue;
    used.add(key);
    items[id] = { hook, caption: cap };
  }
  return { items, missing: slots.map((s) => s.id).filter((id) => !items[id]) };
}
