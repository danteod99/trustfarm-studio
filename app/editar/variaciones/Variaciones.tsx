"use client";

// Variaciones únicas (Multiediting de TrustMind): N versiones distintas de cada video
// (color, brillo, contraste, saturación, gamma, tono, volumen) para publicar en muchas cuentas.
// 100 % en el navegador con el motor de app/lib/video. Subtítulos opcionales con IA (con cobro).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Download, FolderDown, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import VideoPicker from "@/app/editar/VideoPicker";
import { MAX_AUDIO_BYTES } from "@/app/lib/editar";
import {
  LOGO_POSITIONS, buildAss, downloadBlobUrl, execLogged, extractAudioMp3, fmtMB, getProfile, getVideoInfo,
  loadEngine, mountFont, onProgress, renderVariation, resetEngine, safeDelete, writeInput,
  type LogoPos, type SubSegment, type SubWord,
} from "@/app/lib/video";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const MAX_FILE_MB = 200;
const MAX_VARIATIONS = 50;

interface DirWritable { write: (b: Blob) => Promise<void>; close: () => Promise<void> }
interface DirHandle { name: string; getFileHandle: (n: string, o: { create: boolean }) => Promise<{ createWritable: () => Promise<DirWritable> }> }

interface ResultItem { name: string; url: string; size: string; saved?: boolean }
interface VideoResult { source: string; items: ResultItem[] }

/** ¿El video ya trae subtítulos? (pista embebida o quemados en la imagen, revisado con IA). */
async function detectExistingSubs(ffmpeg: FFmpeg, dur: number): Promise<"embebidos" | "quemados" | null> {
  const { logs } = await execLogged(ffmpeg, ["-i", "in.mp4"]).catch(() => ({ logs: [] as string[] }));
  if (logs.some((l) => /Stream #\d+:\d+.*:\s*Subtitle/i.test(l))) return "embebidos";
  try {
    const frames: string[] = [];
    for (const pct of [0.25, 0.5, 0.75]) {
      const t = Math.max(0.5, dur * pct);
      const code = await ffmpeg.exec(["-ss", t.toFixed(2), "-i", "in.mp4", "-frames:v", "1",
        "-vf", "crop=iw:ih*0.45:0:ih*0.55,scale=480:-2", "-q:v", "6", "-y", "probe.jpg"]);
      if (code !== 0) continue;
      const data = (await ffmpeg.readFile("probe.jpg")) as Uint8Array;
      let bin = "";
      for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
      frames.push(btoa(bin));
      await safeDelete(ffmpeg, "probe.jpg");
    }
    if (!frames.length) return null;
    const res = await fetch("/api/editar/detectar-subtitulos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frames }),
    });
    if (!res.ok) return null;
    return (await res.json()).hasSubtitles ? "quemados" : null;
  } catch {
    return null;
  }
}

export default function Variaciones({ subsCost }: { subsCost: number }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [numVars, setNumVars] = useState(5);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPos, setLogoPos] = useState<LogoPos>("tr");
  const [subsOn, setSubsOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [pct, setPct] = useState(0);
  const [results, setResults] = useState<VideoResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dir, setDir] = useState<DirHandle | null>(null);
  const [fsOk, setFsOk] = useState(false);
  const [engineInfo, setEngineInfo] = useState("");
  const cancelRef = useRef(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef(results);
  resultsRef.current = results;

  useEffect(() => {
    setFsOk("showDirectoryPicker" in window);
    return () => resultsRef.current.forEach((v) => v.items.forEach((i) => i.url && URL.revokeObjectURL(i.url)));
  }, []);

  const addFiles = (incoming: File[]) => {
    setError(null);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...incoming.filter((f) => !names.has(f.name))];
    });
  };

  const pickFolder = async () => {
    try {
      const picker = (window as unknown as { showDirectoryPicker?: (o?: { mode?: string }) => Promise<DirHandle> }).showDirectoryPicker;
      if (picker) setDir(await picker({ mode: "readwrite" }));
    } catch { /* canceló */ }
  };

  const total = files.length * numVars;
  const cost = subsOn ? files.length * subsCost : 0;

  const run = async () => {
    if (!files.length || running) return;
    setRunning(true); setError(null); setResults([]); setPct(0);
    cancelRef.current = false;
    let done = 0;
    let ratio = 0;
    const off = onProgress((r) => { ratio = r; });
    const tick = setInterval(() => setPct(Math.round(((done + ratio) / total) * 100)), 400);
    let charged = false;
    let subsActive = subsOn;
    try {
      const { ffmpeg, multiThread } = await loadEngine(setStatus);
      setEngineInfo(multiThread ? "Motor multihilo" : "Motor de un hilo");
      if (logo) await writeInput(ffmpeg, "logo.png", logo);
      if (subsOn) await mountFont(ffmpeg);

      for (let fi = 0; fi < files.length && !cancelRef.current; fi++) {
        const file = files[fi];
        const base = file.name.replace(/\.[^.]+$/, "");
        const vr: VideoResult = { source: file.name, items: [] };
        setStatus(`Cargando "${file.name}"…`);
        await writeInput(ffmpeg, "in.mp4", file);

        let ass = "";
        if (subsActive) {
          const info = await getVideoInfo(file);
          setStatus(`Revisando si "${file.name}" ya tiene subtítulos…`);
          const existing = await detectExistingSubs(ffmpeg, info.dur);
          charged = true;
          if (existing) {
            setStatus(`"${file.name}" ya tiene subtítulos (${existing}): no se agregan otros.`);
          } else {
            setStatus(`Transcribiendo "${file.name}" con IA…`);
            const audio = await extractAudioMp3(ffmpeg);
            if (audio && audio.size > MAX_AUDIO_BYTES) {
              setError(`"${file.name}" es muy largo para transcribir (máx. unos 20 minutos): sale sin subtítulos.`);
            } else if (audio) {
              const fd = new FormData();
              fd.append("audio", new File([audio], "audio.mp3", { type: "audio/mpeg" }));
              const res = await fetch("/api/editar/transcribir", { method: "POST", body: fd });
              const d = await res.json().catch(() => ({}));
              if (res.ok) {
                const words: SubWord[] = d.words || [];
                const segments: SubSegment[] = d.segments || [];
                if (words.length || segments.length) ass = buildAss(info.w, info.h, words, segments);
              } else {
                setError(`Subtítulos: ${d.error || "no se pudo transcribir"}. Las variaciones salen sin subtítulos.`);
                if (res.status === 402) subsActive = false; // sin saldo: el resto sale sin subtítulos
              }
            }
          }
          if (ass) await writeInput(ffmpeg, "sub.ass", ass);
        }

        for (let vi = 0; vi < numVars && !cancelRef.current; vi++) {
          ratio = 0;
          setStatus(`Video ${fi + 1}/${files.length} · variación ${vi + 1}/${numVars}`);
          const blob = await renderVariation(ffmpeg, {
            // El perfil 0 es el original sin cambios: se empieza en el 1, con zoom y velocidad leves.
            profile: getProfile(vi + 1),
            zoom: Number((1 + ((vi * 3 + 1) % 7) * 0.01).toFixed(2)),
            speed: Number((0.97 + ((vi * 5 + 3) % 7) * 0.01).toFixed(2)),
            assPath: ass ? "sub.ass" : undefined,
            logoPath: logo ? "logo.png" : undefined,
            logoPos,
          });
          const name = `${base}_v${vi + 1}.mp4`;
          if (dir) {
            const fh = await dir.getFileHandle(name, { create: true });
            const w = await fh.createWritable();
            await w.write(blob);
            await w.close();
            vr.items.push({ name, url: "", size: fmtMB(blob.size), saved: true });
          } else {
            vr.items.push({ name, url: URL.createObjectURL(blob), size: fmtMB(blob.size) });
          }
          done++;
          setResults((prev) => [...prev.filter((r) => r.source !== vr.source), { ...vr, items: [...vr.items] }]);
        }
        await safeDelete(ffmpeg, "in.mp4", "sub.ass");
      }
      setStatus(cancelRef.current ? "Cancelado: se conservan las variaciones ya hechas." : "¡Listo! Todas las variaciones están hechas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
      resetEngine();
    } finally {
      off();
      clearInterval(tick);
      setPct((p) => (cancelRef.current ? p : 100));
      setRunning(false);
      if (charged) router.refresh();
    }
  };

  const downloadAll = async () => {
    for (const it of results.flatMap((v) => v.items).filter((i) => i.url)) {
      downloadBlobUrl(it.url, it.name);
      await new Promise((r) => setTimeout(r, 450));
    }
  };

  const clear = () => {
    results.forEach((v) => v.items.forEach((i) => i.url && URL.revokeObjectURL(i.url)));
    setResults([]); setPct(0); setStatus("");
  };

  const made = results.reduce((a, v) => a + v.items.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <ToolHeader
        icon={<Copy size={20} />}
        title="Variaciones únicas"
        subtitle="Haz varias versiones distintas de cada video (color, brillo, contraste, tono y volumen) para publicarlo en muchas cuentas sin que se vea repetido. Todo pasa en tu computadora: tus videos no se suben a ningún servidor."
      />

      <VideoPicker
        multiple
        maxMB={MAX_FILE_MB}
        disabled={running}
        onFiles={addFiles}
        onError={setError}
        title="Arrastra tus videos aquí o haz clic para elegirlos"
        hint={`MP4, MOV o WebM · máx. ${MAX_FILE_MB} MB por video · clips cortos = más rápido`}
      />

      {files.length > 0 && (
        <div className="card mt-4 space-y-5 p-5">
          <ul className="divide-y divide-line">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-mute">
                  {fmtMB(f.size)}
                  {!running && (
                    <button onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))} aria-label="Quitar" className="hover:text-error">
                      <X size={15} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div>
            <label className="eyebrow">
              Variaciones por video: <span className="text-brand-2">{numVars}</span>
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={1} max={MAX_VARIATIONS} value={numVars} disabled={running}
                onChange={(e) => setNumVars(parseInt(e.target.value))} className="w-full max-w-xs accent-ocre" />
              <input type="number" min={1} max={MAX_VARIATIONS} value={numVars} disabled={running}
                onChange={(e) => setNumVars(Math.max(1, Math.min(MAX_VARIATIONS, parseInt(e.target.value) || 1)))}
                className="input !w-20 text-center" />
            </div>
            <p className="mt-1 text-xs text-mute">La variación 1 conserva los colores originales; las demás cambian un poco cada una.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo(f); e.target.value = ""; }} />
            {!logo ? (
              <button onClick={() => logoRef.current?.click()} disabled={running} className="btn-ghost !py-2 text-xs">
                <ImagePlus size={14} className="text-brand-2" /> Poner marca de agua (opcional)
              </button>
            ) : (
              <>
                <span className="max-w-[220px] truncate text-sm text-ok">✓ {logo.name}</span>
                {!running && <button onClick={() => setLogo(null)} className="text-mute hover:text-error" aria-label="Quitar logo"><X size={14} /></button>}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(LOGO_POSITIONS) as LogoPos[]).map((k) => (
                    <button key={k} onClick={() => setLogoPos(k)} disabled={running} className={`chip ${logoPos === k ? "chip-on" : ""}`}>
                      {LOGO_POSITIONS[k].label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="text-xs text-mute">PNG transparente recomendado</span>
          </div>

          <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-4">
            <input type="checkbox" checked={subsOn} disabled={running} onChange={(e) => setSubsOn(e.target.checked)} className="mt-1 h-4 w-4 accent-ocre" />
            <span>
              <span className={`text-sm font-semibold ${subsOn ? "text-brand-2" : ""}`}>Subtítulos automáticos (IA)</span>
              <span className="block text-xs text-mute">
                Transcribe el audio y pone subtítulos estilo TikTok en cada variación. Si el video ya trae subtítulos, no se agregan otros.
                Cuesta {subsCost} créditos por video (no por variación).
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-xs text-mute">
            {fsOk ? (
              <>
                <button onClick={pickFolder} disabled={running} className="btn-ghost !py-2 text-xs">
                  <FolderDown size={14} className="text-brand-2" /> {dir ? "Cambiar carpeta" : "Guardar directo en una carpeta"}
                </button>
                <span className={dir ? "text-ok" : ""}>
                  {dir ? `✓ Se guardan en "${dir.name}"` : "Opcional: si no eliges, cada variación se descarga con su botón."}
                </span>
                {dir && !running && <button onClick={() => setDir(null)} className="hover:text-error" aria-label="Quitar carpeta"><X size={14} /></button>}
              </>
            ) : (
              <span>Tu navegador no deja elegir carpeta (usa Chrome o Edge): las variaciones se descargan a Descargas.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm">
              {total} variacion{total === 1 ? "" : "es"} ·{" "}
              {cost ? <span className="font-semibold text-brand-2">{cost} créditos</span> : <span className="font-semibold text-ok">Gratis</span>}
            </p>
            {!running ? (
              <button onClick={run} className="btn-primary">
                <Copy size={16} /> Hacer {total} variacion{total === 1 ? "" : "es"}
              </button>
            ) : (
              <button onClick={() => { cancelRef.current = true; setStatus("Cancelando al terminar la variación en curso…"); }} className="btn-ghost text-error">
                <X size={15} /> Cancelar
              </button>
            )}
          </div>
          <p className="text-xs text-mute">
            Se procesa en tu computadora (≈ 1–3 min por variación según tu equipo). Deja esta pestaña abierta.
            {numVars > 15 && <span className="text-amber-300"> Con {numVars} variaciones puede tardar bastante.</span>}
          </p>
        </div>
      )}

      {(running || status) && (
        <div className="card mt-4 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm">
            {running && <Loader2 size={15} className="animate-spin text-brand-2" />}
            <span className="flex-1">{status}</span>
            {engineInfo && <span className="text-xs text-mute">{engineInfo}</span>}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-xs text-mute">{pct}%</p>
        </div>
      )}

      {error && <div className="mt-4"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      {made > 0 && (
        <div className="card mt-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 size={17} className="text-ok" /> {made} variaciones listas
            </p>
            <div className="flex gap-2">
              {results.some((v) => v.items.some((i) => i.url)) && (
                <button onClick={downloadAll} className="btn-ghost !py-2 text-xs"><Download size={14} /> Descargar todas</button>
              )}
              {!running && <button onClick={clear} className="btn-ghost !py-2 text-xs"><Trash2 size={14} /> Limpiar</button>}
            </div>
          </div>
          {results.map((v) => (
            <div key={v.source} className="mb-4">
              <p className="mb-2 text-xs font-semibold text-mute">{v.source}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {v.items.map((it) => {
                  const label = it.name.match(/_v(\d+)\.mp4$/)?.[1];
                  const inner = (
                    <>
                      <span className="text-xs font-semibold">Versión {label ?? ""}</span>
                      <span className="flex items-center justify-between text-[11px] text-mute">
                        {it.size}
                        {it.saved ? <CheckCircle2 size={13} className="text-ok" /> : <Download size={13} className="text-brand-2" />}
                      </span>
                    </>
                  );
                  return it.saved ? (
                    <div key={it.name} title="Guardado en tu carpeta" className="flex flex-col gap-1 rounded-xl border border-line bg-panel-2 p-3">{inner}</div>
                  ) : (
                    <a key={it.name} href={it.url} download={it.name} className="flex flex-col gap-1 rounded-xl border border-line bg-panel-2 p-3 transition hover:border-brand">{inner}</a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
