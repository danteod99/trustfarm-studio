"use client";

// Modo Granja · Multiplicar: 1–5 videos base → un video distinto por cada (cuenta, n).
// Cada salida: video base rotado, perfil de color distinto, zoom 1.00–1.06, velocidad ±3 %,
// gancho quemado arriba (buildAss) y metadatos limpios. Render en serie en el navegador
// (motor de app/lib/video, un hilo) y ZIP con una carpeta por cuenta.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Loader2, PenLine, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { ErrorBox } from "@/app/editar/ToolHeader";
import VideoPicker from "@/app/editar/VideoPicker";
import {
  buildAss, downloadBlobUrl, fmtMB, getProfile, getVideoInfo, loadEngine, mountFont, onProgress,
  renderVariation, resetEngine, safeDelete, writeInput, type VideoInfo,
} from "@/app/lib/video";
import {
  GANCHOS_POR_LOTE, MAX_BASE_VIDEOS, MAX_FARM_ACCOUNTS, MAX_PER_ACCOUNT, NETWORKS, NETWORK_LABEL, VIDEOS_POR_ZIP,
  accountKey, buildPlan, folderNames, genericAccounts, hooksCost, splitParts,
  type FarmAccountInput, type HookItem, type Network, type PlanItem,
} from "@/app/lib/granja";
import { IDIOMAS, TONOS, type Idioma } from "@/app/lib/granja-ganchos";
import { buildZip, type ZipEntry } from "@/app/granja/zip";
import type { Account, Character } from "@/app/granja/Granja";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { VariationSpec } from "@/app/lib/video/profiles";

const MAX_FILE_MB = 100;
/** Videos por carga del motor (ffmpeg.wasm acumula memoria entre renders). */
const RECICLAR = 10;

interface Base { file: File; info: VideoInfo }
interface Target extends FarmAccountInput { presetId?: string | null }
interface ZipPart { name: string; url: string; size: number; videos: number; accounts: number }
interface Output { blob: Blob; hash: string; plan: PlanItem }

const slotKey = (t: FarmAccountInput, n: number) => `${accountKey(t)}#${n}`;

async function sha256(b: Blob): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", await b.arrayBuffer());
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec <= 0) return "—";
  if (sec < 90) return `${Math.round(sec)} s`;
  const m = Math.round(sec / 60);
  return m < 90 ? `${m} min` : `${(m / 60).toFixed(1)} h`;
}

function captionTxt(folder: string, network: Network, rows: { file: string; hook: string; caption: string }[]): string {
  const lines = [`${folder} · ${NETWORK_LABEL[network]}`, ""];
  for (const r of rows) {
    lines.push(`=== ${r.file} ===`);
    if (r.hook) lines.push(`Gancho: ${r.hook}`);
    lines.push(r.caption || "(sin caption)", "");
  }
  return lines.join("\n");
}

export default function Multiplicar({ accounts, characters, goToAccounts }: { accounts: Account[]; characters: Character[]; goToAccounts: () => void }) {
  const router = useRouter();
  const [bases, setBases] = useState<Base[]>([]);
  const [mode, setMode] = useState<"saved" | "generic">("saved");
  const [netFilter, setNetFilter] = useState<Network | "all">("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState(false);
  const [genericN, setGenericN] = useState(10);
  const [perAccount, setPerAccount] = useState(1);
  const [tema, setTema] = useState("");
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [tono, setTono] = useState<string>(TONOS[0]);
  const [hooks, setHooks] = useState<Record<string, HookItem>>({});
  const [writing, setWriting] = useState(false);
  const [hookMsg, setHookMsg] = useState<string | null>(null);
  const [shownAcc, setShownAcc] = useState(30);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(0);
  const [eta, setEta] = useState(0);
  const [zips, setZips] = useState<ZipPart[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [uniqueOk, setUniqueOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);
  const montadoRef = useRef(true);
  const zipsRef = useRef(zips);
  zipsRef.current = zips;
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const useGeneric = mode === "generic" || !accounts.length;
  const charById = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);

  // Por defecto, todas las cuentas guardadas.
  useEffect(() => {
    if (!manual) setPicked(new Set(accounts.filter((a) => netFilter === "all" || a.network === netFilter).map((a) => a.id)));
  }, [accounts, netFilter, manual]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      zipsRef.current.forEach((z) => URL.revokeObjectURL(z.url));
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      // Salir de la página corta el render: el motor es único y lo puede necesitar otra herramienta.
      cancelRef.current = true;
      if (runningRef.current) resetEngine();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [running]);

  const targets: Target[] = useMemo(() => {
    if (useGeneric) return genericAccounts(genericN);
    return accounts.filter((a) => picked.has(a.id)).map((a) => ({ handle: a.handle, network: a.network, presetId: a.preset_id }));
  }, [useGeneric, genericN, accounts, picked]);

  const slots = useMemo(() => targets.flatMap((t) => Array.from({ length: perAccount }, (_, i) => ({ t, n: i + 1, key: slotKey(t, i + 1) }))), [targets, perAccount]);
  const missingHooks = slots.filter((s) => !hooks[s.key]?.hook?.trim());
  const writeCost = missingHooks.length
    ? Array.from({ length: Math.ceil(missingHooks.length / GANCHOS_POR_LOTE) }, (_, i) => hooksCost(Math.min(GANCHOS_POR_LOTE, missingHooks.length - i * GANCHOS_POR_LOTE))).reduce((a, b) => a + b, 0)
    : 0;
  const total = slots.length;
  const avgDur = bases.length ? bases.reduce((a, b) => a + b.info.dur, 0) / bases.length : 0;
  // Estimado inicial (un hilo): medido ≈ 1,2 s de proceso por segundo de video a 720×1280,
  // escala con los píxeles. Se corrige solo al medir los primeros videos.
  const avgPx = bases.length ? bases.reduce((a, b) => a + b.info.w * b.info.h, 0) / bases.length : 0;
  const estimate = total * Math.max(4, avgDur * 1.2 * Math.max(0.5, avgPx / (720 * 1280)));

  const addBases = async (files: File[]) => {
    setError(null);
    const room = MAX_BASE_VIDEOS - bases.length;
    if (room <= 0) return setError(`Máximo ${MAX_BASE_VIDEOS} videos base.`);
    const fresh = files.filter((f) => !bases.some((b) => b.file.name === f.name && b.file.size === f.size)).slice(0, room);
    const withInfo = await Promise.all(fresh.map(async (file) => ({ file, info: await getVideoInfo(file) })));
    setBases((p) => [...p, ...withInfo]);
  };

  const togglePick = (id: string) => {
    setManual(true);
    setPicked((p) => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };

  const setHook = (key: string, field: keyof HookItem, value: string) =>
    setHooks((h) => ({ ...h, [key]: { hook: h[key]?.hook ?? "", caption: h[key]?.caption ?? "", [field]: value } }));

  const writeHooks = async () => {
    if (!missingHooks.length || writing) return;
    if (tema.trim().length < 3) return setError("Escribe el tema o idea del video para que la IA escriba los ganchos.");
    setWriting(true); setError(null); setHookMsg(null);
    let made = 0, failed = 0, spent = 0;
    const used = Object.values(hooks).map((h) => h.hook).filter(Boolean);
    try {
      for (let i = 0; i < missingHooks.length; i += GANCHOS_POR_LOTE) {
        const part = missingHooks.slice(i, i + GANCHOS_POR_LOTE);
        setHookMsg(`Escribiendo ganchos ${i + 1}–${i + part.length} de ${missingHooks.length}…`);
        const idToKey = new Map(part.map((s, k) => [`s${k}`, s.key]));
        const r = await fetch("/api/granja/ganchos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tema, idioma, tono, evitar: used.slice(-300),
            slots: part.map((s, k) => {
              const c = s.t.presetId ? charById.get(s.t.presetId) : undefined;
              return { id: `s${k}`, handle: s.t.handle, network: s.t.network, personaje: c ? `${c.name}: ${c.description}`.slice(0, 200) : undefined };
            }),
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "No se pudieron escribir los ganchos.");
        const got: Record<string, HookItem> = {};
        for (const [id, it] of Object.entries((d.items ?? {}) as Record<string, HookItem>)) {
          const key = idToKey.get(id);
          if (key) { got[key] = it; used.push(it.hook); }
        }
        made += Object.keys(got).length;
        failed += (d.missing ?? []).length;
        spent += d.cost ?? 0;
        setHooks((h) => ({ ...h, ...got }));
      }
      setHookMsg(`✓ ${made} ganchos escritos${failed ? ` · ${failed} quedaron vacíos (escríbelos tú o vuelve a intentar)` : ""} · ${spent} crédito${spent === 1 ? "" : "s"}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHookMsg(made ? `Se alcanzaron a escribir ${made} ganchos.` : null);
    } finally {
      setWriting(false);
      router.refresh();
    }
  };

  const clearOutputs = () => {
    zips.forEach((z) => URL.revokeObjectURL(z.url));
    if (preview) URL.revokeObjectURL(preview);
    setZips([]); setPreview(null); setUniqueOk(null); setDone(0); setStatus("");
  };

  const run = async () => {
    if (!bases.length || !targets.length || running) return;
    if (targets.length > MAX_FARM_ACCOUNTS) return setError(`Máximo ${MAX_FARM_ACCOUNTS} cuentas por lote.`);
    clearOutputs();
    setRunning(true); setError(null);
    runningRef.current = true;
    cancelRef.current = false;
    const plan = buildPlan(targets.length, perAccount, bases.length);
    const parts = splitParts(plan, VIDEOS_POR_ZIP);
    const folders = folderNames(targets);
    const hashes = new Set<string>();
    const stamp = new Date().toISOString().slice(0, 10);
    let count = 0;
    let ratio = 0;
    let busySec = 0;
    const off = onProgress((r) => { ratio = r; });
    const tick = setInterval(() => {
      const per = count ? busySec / count : estimate / total;
      setEta(Math.max(0, (total - count - ratio) * per));
    }, 1000);
    // ffmpeg.wasm (un hilo) acumula memoria con cada render: se reinicia el motor cada
    // RECICLAR videos y, si un render falla, se reinicia y se reintenta una vez.
    let ffmpeg: FFmpeg | null = null;
    let sinceLoad = 0;
    const prepare = async () => {
      if (ffmpeg) resetEngine();
      ffmpeg = (await loadEngine(setStatus)).ffmpeg;
      await mountFont(ffmpeg);
      for (let b = 0; b < bases.length; b++) await writeInput(ffmpeg, `base${b}.mp4`, bases[b].file);
      sinceLoad = 0;
      return ffmpeg;
    };
    const render = async (spec: VariationSpec, hookAss: string) => {
      for (let attempt = 0; ; attempt++) {
        try {
          const ff = !ffmpeg || sinceLoad >= RECICLAR ? await prepare() : ffmpeg;
          await writeInput(ff, "hook.ass", hookAss);
          const blob = await renderVariation(ff, spec);
          sinceLoad++;
          return blob;
        } catch (e) {
          if (attempt >= 1 || cancelRef.current) throw e;
          console.warn("[granja] render falló, reinicio el motor y reintento:", e);
          await prepare();
        }
      }
    };
    const zipPart = async (outs: Output[], pi: number) => {
      if (!montadoRef.current) return;
      setStatus(`Armando el ZIP${parts.length > 1 ? ` ${pi + 1} de ${parts.length}` : ""}…`);
      const entries: ZipEntry[] = [];
      const byAcc = new Map<number, Output[]>();
      for (const o of outs) byAcc.set(o.plan.account, [...(byAcc.get(o.plan.account) ?? []), o]);
      for (const [a, list] of byAcc) {
        const t = targets[a];
        const rows = list.map((o) => {
          const file = `video-${String(o.plan.n).padStart(2, "0")}.mp4`;
          entries.push({ path: `${folders[a]}/${file}`, data: o.blob });
          const hk = hooks[slotKey(t, o.plan.n)];
          return { file, hook: hk?.hook?.trim() ?? "", caption: hk?.caption?.trim() ?? "" };
        });
        entries.push({ path: `${folders[a]}/caption.txt`, data: captionTxt(folders[a], t.network, rows) });
      }
      const zip = await buildZip(entries);
      const name = parts.length > 1 ? `modo-granja-${stamp}-parte-${pi + 1}.zip` : `modo-granja-${stamp}.zip`;
      setZips((z) => [...z, { name, url: URL.createObjectURL(zip), size: zip.size, videos: outs.length, accounts: byAcc.size }]);
    };
    let outs: Output[] = [];
    let pi = 0;
    try {
      setStatus("Preparando el motor de video…");
      await prepare();
      for (pi = 0; pi < parts.length && !cancelRef.current; pi++) {
        outs = [];
        for (const item of parts[pi]) {
          if (cancelRef.current) break;
          const t = targets[item.account];
          const h = hooks[slotKey(t, item.n)];
          const { w, h: H } = bases[item.base].info;
          setStatus(`Video ${item.i + 1} de ${total} · ${folders[item.account]} #${item.n}`);
          ratio = 0;
          const t0 = performance.now();
          const hookAss = buildAss(w, H, [], [], { hook: h?.hook?.trim() || undefined });
          let spec: VariationSpec = { profile: item.profile, input: `base${item.base}.mp4`, assPath: "hook.ass", speed: item.speed, zoom: item.zoom };
          let blob = await render(spec, hookAss);
          let hash = await sha256(blob);
          // Ningún archivo idéntico a otro: si coincide (no debería), se rehace con otro perfil.
          for (let k = 1; hashes.has(hash) && k <= 3; k++) {
            spec = { ...spec, profile: getProfile(item.profileIndex + 5000 * k) };
            blob = await render(spec, hookAss);
            hash = await sha256(blob);
          }
          hashes.add(hash);
          busySec += (performance.now() - t0) / 1000;
          outs.push({ blob, hash, plan: item });
          count++;
          setDone(count);
          if (count === 1) setPreview(URL.createObjectURL(blob));
        }
        if (!outs.length) break;
        await zipPart(outs, pi);
        outs = [];
      }
      if (ffmpeg) await safeDelete(ffmpeg, "hook.ass", ...bases.map((_, b) => `base${b}.mp4`));
      setUniqueOk(`${count} video${count === 1 ? "" : "s"} · ${hashes.size} archivo${hashes.size === 1 ? "" : "s"} distinto${hashes.size === 1 ? "" : "s"} (verificado por huella SHA-256)`);
      setStatus(cancelRef.current ? `Cancelado: se guardaron ${count} videos en el ZIP.` : "¡Listo! Descarga tu ZIP.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!montadoRef.current) return; // salió de la página: el motor ya se descartó y puede estar en uso
      resetEngine();
      // Lo ya hecho no se pierde: se empaqueta lo que quedó en la parte en curso.
      if (outs.length) { try { await zipPart(outs, pi); } catch { /* sin memoria */ } }
      setError(`Se detuvo en el video ${count + 1} de ${total} (${msg}). ${count ? `Los ${count} videos hechos están en el ZIP.` : ""} Prueba con videos base más cortos o menos cuentas por tanda.`);
      setStatus("");
    } finally {
      off();
      clearInterval(tick);
      setEta(0);
      setRunning(false);
      runningRef.current = false;
    }
  };

  const shownSlots = targets.slice(0, shownAcc);
  const netCounts = NETWORKS.map((n) => [n, accounts.filter((a) => a.network === n).length] as const).filter(([, c]) => c > 0);

  return (
    <div className="space-y-5">
      {/* Paso 1 */}
      <section className="card space-y-4 p-5">
        <StepTitle n={1} title="Elige tus videos base" sub={`De 1 a ${MAX_BASE_VIDEOS} videos (de tu galería o subidos). Se van rotando entre las cuentas.`} />
        {bases.length < MAX_BASE_VIDEOS && (
          <VideoPicker multiple maxMB={MAX_FILE_MB} disabled={running} onFiles={addBases} onError={setError}
            title="Arrastra tus videos aquí o haz clic para elegirlos"
            hint={`MP4, MOV o WebM · máx. ${MAX_FILE_MB} MB por video · clips cortos (≤ 30 s) = mucho más rápido`} />
        )}
        {bases.length > 0 && (
          <ul className="divide-y divide-line">
            {bases.map((b, i) => (
              <li key={b.file.name + i} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate"><span className="text-brand-2">Base {i + 1}</span> · {b.file.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-mute">
                  {b.info.w}×{b.info.h} · {b.info.dur.toFixed(1)} s · {fmtMB(b.file.size)}
                  {!running && <button onClick={() => setBases((p) => p.filter((_, k) => k !== i))} aria-label="Quitar" className="hover:text-error"><X size={15} /></button>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Paso 2 */}
      <section className="card space-y-4 p-5">
        <StepTitle n={2} title="Elige las cuentas" sub="Cada cuenta recibe su propio video (o 2–3 si quieres publicar varias veces)." />
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setMode("saved")} disabled={running} className={`chip ${mode === "saved" ? "chip-on" : ""}`}>Mis cuentas ({accounts.length})</button>
            <button onClick={() => setMode("generic")} disabled={running} className={`chip ${mode === "generic" ? "chip-on" : ""}`}>Nombres genéricos</button>
          </div>
        )}
        {useGeneric ? (
          <div className="rounded-xl border border-line bg-panel-2 p-4 text-sm">
            {!accounts.length && (
              <p className="mb-3 text-mute">
                Sin cuentas: usa nombres genéricos (cuenta-001, cuenta-002…) o{" "}
                <button onClick={goToAccounts} className="font-semibold text-brand-2 hover:underline">agrega tus cuentas</button>.
              </p>
            )}
            <label className="flex flex-wrap items-center gap-3">
              ¿Cuántas cuentas?
              <input type="number" min={1} max={MAX_FARM_ACCOUNTS} value={genericN} disabled={running}
                onChange={(e) => setGenericN(Math.max(1, Math.min(MAX_FARM_ACCOUNTS, parseInt(e.target.value) || 1)))}
                className="input !w-24 text-center" />
              <span className="text-xs text-mute">cuenta-001 … cuenta-{String(genericN).padStart(3, "0")}</span>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => { setManual(false); setNetFilter("all"); }} disabled={running} className={`chip ${!manual && netFilter === "all" ? "chip-on" : ""}`}>Todas</button>
              {netCounts.map(([n, c]) => (
                <button key={n} onClick={() => { setManual(false); setNetFilter(n); }} disabled={running} className={`chip ${!manual && netFilter === n ? "chip-on" : ""}`}>
                  Solo {NETWORK_LABEL[n]} ({c})
                </button>
              ))}
              <button onClick={() => setManual(true)} disabled={running} className={`chip ${manual ? "chip-on" : ""}`}>Elegir a mano</button>
              <span className="ml-1 text-xs text-mute">{picked.size} elegida{picked.size === 1 ? "" : "s"}</span>
            </div>
            {manual && (
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-panel-2 p-3">
                {accounts.map((a) => (
                  <button key={a.id} onClick={() => togglePick(a.id)} disabled={running} className={`chip ${picked.has(a.id) ? "chip-on" : ""}`}>
                    @{a.handle} <span className="opacity-60">· {NETWORK_LABEL[a.network]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Videos por cuenta:
          {Array.from({ length: MAX_PER_ACCOUNT }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setPerAccount(n)} disabled={running} className={`chip ${perAccount === n ? "chip-on" : ""}`}>{n}</button>
          ))}
          <span className="text-xs text-mute">= {total} video{total === 1 ? "" : "s"} en total</span>
        </div>
      </section>

      {/* Paso 3 */}
      <section className="card space-y-4 p-5">
        <StepTitle n={3} title="Ganchos y captions" sub="Un gancho distinto arriba de cada video (máx. 8 palabras) y su caption con hashtags. Puedes editarlos." />
        <textarea value={tema} onChange={(e) => setTema(e.target.value)} disabled={writing || running} rows={2} maxLength={600}
          placeholder="¿De qué trata el video? Ej.: granja de 40 iPhones publicando sola de noche en una oficina en Lima"
          className="input text-sm" />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-mute">Tono:</span>
          {TONOS.map((t) => <button key={t} onClick={() => setTono(t)} disabled={writing} className={`chip ${tono === t ? "chip-on" : ""}`}>{t}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-mute">Idioma:</span>
          {(Object.keys(IDIOMAS) as Idioma[]).map((k) => (
            <button key={k} onClick={() => setIdioma(k)} disabled={writing} className={`chip ${idioma === k ? "chip-on" : ""}`}>
              {k === "es" ? "Español" : k === "en" ? "Inglés" : "Portugués"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={writeHooks} disabled={writing || running || !missingHooks.length || !targets.length} className="btn-primary">
            {writing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
            {missingHooks.length === slots.length ? "Escribir ganchos" : `Escribir los ${missingHooks.length} que faltan`}
            {missingHooks.length > 0 && <span className="rounded-md bg-black/25 px-1.5 text-xs">{writeCost} crédito{writeCost === 1 ? "" : "s"}</span>}
          </button>
          {Object.keys(hooks).length > 0 && !writing && (
            <button onClick={() => { setHooks({}); setHookMsg(null); }} disabled={running} className="btn-ghost !py-2 text-xs"><Trash2 size={13} /> Borrar ganchos</button>
          )}
          <span className="text-xs text-mute">1 crédito cada 20 ganchos · o escríbelos tú gratis abajo <PenLine size={11} className="inline" /></span>
        </div>
        {hookMsg && <p className="text-sm text-ok">{hookMsg}</p>}

        {targets.length > 0 && (
          <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-xl border border-line bg-panel-2 p-3">
            {shownSlots.map((t) => (
              <div key={accountKey(t)} className="space-y-1.5">
                <p className="text-xs font-semibold">@{t.handle} <span className="font-normal text-mute">· {NETWORK_LABEL[t.network]}{t.presetId && charById.get(t.presetId) ? ` · ${charById.get(t.presetId)!.name}` : ""}</span></p>
                {Array.from({ length: perAccount }, (_, i) => i + 1).map((n) => {
                  const k = slotKey(t, n);
                  return (
                    <div key={k} className="grid gap-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                      <input value={hooks[k]?.hook ?? ""} onChange={(e) => setHook(k, "hook", e.target.value)} disabled={running}
                        placeholder={`Gancho video ${n} (opcional)`} maxLength={70} className="input !py-1.5 text-xs" />
                      <input value={hooks[k]?.caption ?? ""} onChange={(e) => setHook(k, "caption", e.target.value)} disabled={running}
                        placeholder="Caption #hashtags" maxLength={600} className="input !py-1.5 text-xs" />
                    </div>
                  );
                })}
              </div>
            ))}
            {targets.length > shownAcc && (
              <button onClick={() => setShownAcc((s) => s + 50)} className="btn-ghost !py-1.5 text-xs">Ver {Math.min(50, targets.length - shownAcc)} cuentas más ({targets.length - shownAcc} ocultas)</button>
            )}
          </div>
        )}
      </section>

      {/* Paso 4 */}
      <section className="card space-y-4 p-5">
        <StepTitle n={4} title="Crear videos" sub="Se hacen en tu computadora, uno por uno. Deja esta pestaña abierta hasta que termine." />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {total} video{total === 1 ? "" : "s"} · <span className="font-semibold text-ok">Render gratis</span>
            {bases.length > 0 && total > 0 && <span className="text-mute"> · tiempo estimado ≈ {fmtTime(estimate)}</span>}
            {total > VIDEOS_POR_ZIP && <span className="text-mute"> · se entrega en {splitParts(buildPlan(targets.length, perAccount, 1), VIDEOS_POR_ZIP).length} ZIP de hasta {VIDEOS_POR_ZIP} videos</span>}
          </p>
          {!running ? (
            <button onClick={run} disabled={!bases.length || !total} className="btn-primary"><Sparkles size={16} /> Crear {total} video{total === 1 ? "" : "s"}</button>
          ) : (
            <button onClick={() => { cancelRef.current = true; setStatus("Cancelando al terminar el video en curso…"); }} className="btn-ghost text-error"><X size={15} /> Cancelar</button>
          )}
        </div>
        {!bases.length && <p className="text-xs text-amber-300">Primero elige al menos un video base (paso 1).</p>}
        {missingHooks.length > 0 && bases.length > 0 && (
          <p className="text-xs text-mute">{missingHooks.length} video{missingHooks.length === 1 ? "" : "s"} sin gancho: saldrán sin texto arriba (igual son distintos).</p>
        )}

        {(running || status) && (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm">
              {running && <Loader2 size={15} className="animate-spin text-brand-2" />}
              <span className="flex-1">{status}</span>
              <span className="text-xs text-mute">{done} de {total}{running && eta > 0 ? ` · faltan ≈ ${fmtTime(eta)}` : ""}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
            </div>
          </div>
        )}

        {zips.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            {uniqueOk && <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={15} /> {uniqueOk}</p>}
            {zips.map((z) => (
              <div key={z.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 p-3 text-sm">
                <span>{z.name} <span className="text-xs text-mute">· {z.accounts} cuenta{z.accounts === 1 ? "" : "s"} · {z.videos} video{z.videos === 1 ? "" : "s"} · {fmtMB(z.size)}</span></span>
                <button onClick={() => downloadBlobUrl(z.url, z.name)} className="btn-primary !py-2 text-xs"><Download size={14} /> Descargar ZIP</button>
              </div>
            ))}
            {!running && <button onClick={clearOutputs} className="btn-ghost !py-2 text-xs"><Trash2 size={13} /> Limpiar</button>}
          </div>
        )}
        {preview && (
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs text-mute">Vista previa del primer video</p>
            <video src={preview} controls playsInline className="max-h-96 rounded-xl border border-line" />
          </div>
        )}
      </section>

      {error && <ErrorBox msg={error} onClose={() => setError(null)} />}
    </div>
  );
}

function StepTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand/50 bg-brand/10 text-sm font-bold text-brand-2">{n}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-mute">{sub}</p>
      </div>
    </div>
  );
}
