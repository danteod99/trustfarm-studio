"use client";

// Editor de cortos (portado de TrustMind): corta retomas (IA) y silencios, quema subtítulos
// estilo TikTok e iguala el volumen. El render corre en el navegador (app/lib/video);
// solo la transcripción y las retomas usan el servidor (con cobro).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Captions, CheckCircle2, Download, Loader2, Music, Scissors, X } from "lucide-react";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import VideoPicker from "@/app/editar/VideoPicker";
import { MAX_AUDIO_BYTES } from "@/app/lib/editar";
import {
  buildAss, casiTodoSilencio, costoCortos, duracionTotal, execLogged, extractAudioMp3, fmtMB, getVideoInfo, guardarRetomas, guardarTranscripcion,
  keepSegments, loadEngine, mapTime, mountFont, onProgress, parseSilences, readBlob, resetEngine, retomasGuardadas, safeDelete,
  selectExpr, transcripcionGuardada, writeInput,
  type CacheCortos, type Range, type SubSegment, type SubWord,
} from "@/app/lib/video";

const MAX_FILE_MB = 200;

interface Result { url: string; name: string; size: string; origDur: number; newDur: number }

export default function Cortos({ precios }: { precios: { transcripcion: number; retomas: number } }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [cutRetakes, setCutRetakes] = useState(true);
  const [condense, setCondense] = useState(false);
  const [cutSilences, setCutSilences] = useState(true);
  const [subsOn, setSubsOn] = useState(true);
  const [musicVol, setMusicVol] = useState(0.15);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  /** Transcripción y retomas ya pagadas de estas tomas: reintentar no las vuelve a cobrar. */
  const pagadoRef = useRef<CacheCortos | null>(null);

  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const cost = costoCortos(precios, pagadoRef.current, files, { cutRetakes, subsOn, condense });
  const yaPagado = !cost && costoCortos(precios, null, files, { cutRetakes, subsOn, condense }) > 0;

  const move = (i: number, d: -1 | 1) => setFiles((prev) => {
    const j = i + d;
    if (j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const run = async () => {
    if (!files.length || running) return;
    setRunning(true); setError(null); setWarning(null); setResult(null); setPct(0);
    const off = onProgress((r) => setPct((p) => Math.min(99, Math.max(p, Math.round(r * 100)))));
    let paid = false;
    try {
      const infos = await Promise.all(files.map((f) => getVideoInfo(f)));
      const W = infos[0].w, H = infos[0].h;
      const dur = duracionTotal(infos.map((i) => i.dur));
      // Cortes y subtítulos dependen de la duración: sin ella saldría un video vacío ya cobrado.
      if (dur === null && (cutRetakes || cutSilences || subsOn)) {
        throw new Error("Tu navegador no puede leer este video (suele pasar con MOV HEVC de iPhone). Conviértelo a MP4 H.264 o prueba en otro navegador. No se te cobró nada.");
      }
      const origDur = dur ?? 0;
      const { ffmpeg } = await loadEngine(setStatus);

      if (files.length === 1) {
        setStatus("Cargando el video…");
        await writeInput(ffmpeg, "in.mp4", files[0]);
      } else {
        // Varias tomas: se normalizan al formato de la 1.ª y se unen en orden.
        const list: string[] = [];
        for (let i = 0; i < files.length; i++) {
          setStatus(`Preparando y uniendo toma ${i + 1}/${files.length}…`);
          setPct(0);
          await writeInput(ffmpeg, `src${i}.mp4`, files[i]);
          const code = await ffmpeg.exec(["-i", `src${i}.mp4`,
            "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,fps=30,setsar=1`,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-y", `norm${i}.mp4`]);
          if (code !== 0) throw new Error(`No se pudo preparar la toma ${i + 1}.`);
          await safeDelete(ffmpeg, `src${i}.mp4`);
          list.push(`file norm${i}.mp4`);
        }
        await writeInput(ffmpeg, "concat.txt", list.join("\n") + "\n");
        const cc = await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c", "copy", "-y", "in.mp4"]);
        if (cc !== 0) throw new Error("No se pudieron unir las tomas.");
        await safeDelete(ffmpeg, "concat.txt", ...files.map((_, i) => `norm${i}.mp4`));
      }

      // 0) Audio: un video sin sonido no se transcribe ni se cobra, y cortar sus "silencios" lo dejaría vacío.
      let silencios: Range[] = [];
      if (cutRetakes || subsOn || cutSilences) {
        setStatus("Revisando el audio…");
        const { logs } = await execLogged(ffmpeg, ["-i", "in.mp4", "-af", "silencedetect=noise=-30dB:d=0.5", "-f", "null", "-"]);
        silencios = parseSilences(logs, origDur);
      }
      const sinSonido = casiTodoSilencio(silencios, origDur);
      if (sinSonido) setWarning("Este video casi no tiene sonido: no se transcribió, no se cortaron silencios y no se cobró nada.");

      // 1) Transcripción (para retomas y/o subtítulos)
      let words: SubWord[] = [];
      let segments: SubSegment[] = [];
      const guardada = transcripcionGuardada(pagadoRef.current, files);
      if ((cutRetakes || subsOn) && guardada) {
        words = guardada.words;
        segments = guardada.segments;
      } else if ((cutRetakes || subsOn) && !sinSonido) {
        setStatus("Transcribiendo con IA…");
        const audio = await extractAudioMp3(ffmpeg);
        if (!audio) throw new Error("No se pudo leer el audio del video.");
        if (audio.size > MAX_AUDIO_BYTES) throw new Error("El video es muy largo para transcribir (máx. unos 20 minutos).");
        const fd = new FormData();
        fd.append("audio", new File([audio], "audio.mp3", { type: "audio/mpeg" }));
        const res = await fetch("/api/editar/transcribir", { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "No se pudo transcribir.");
        paid = true;
        words = d.words || [];
        segments = d.segments || [];
        pagadoRef.current = guardarTranscripcion(pagadoRef.current, files, { words, segments });
      }

      // 2) Cortes: retomas (IA) + silencios (ffmpeg)
      const cuts: Range[] = [];
      const retomas = retomasGuardadas(pagadoRef.current, files, condense);
      if (cutRetakes && retomas) {
        cuts.push(...retomas.cuts);
        if (retomas.warning) setWarning(retomas.warning);
      } else if (cutRetakes && words.length >= 4) {
        setStatus("Buscando retomas y falsos comienzos…");
        const res = await fetch("/api/editar/retomas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ words, condense }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          cuts.push(...(d.cuts || []));
          if (d.warning) setWarning(d.warning);
          if (d.cost > 0) paid = true;
          pagadoRef.current = guardarRetomas(pagadoRef.current, files, condense, { cuts: d.cuts || [], warning: d.warning ?? null, cost: d.cost ?? 0 });
        }
        else setWarning(`Retomas: ${d.error || "no disponibles"}. Se siguió sin cortarlas.`);
      }
      if (cutSilences && !sinSonido) cuts.push(...silencios);
      const conservar = cuts.length && origDur > 0 ? keepSegments(cuts, origDur) : [];
      // Si los cortes cubrieran todo el video no quedaría nada: se entrega sin cortar y se avisa.
      if (cuts.length && !conservar.length) setWarning("Los cortes cubrían todo el video: se dejó sin cortar.");
      const keep = conservar.length ? conservar : [{ start: 0, end: origDur }];
      const newDur = keep.reduce((a, k) => a + (k.end - k.start), 0);
      const hasCuts = conservar.length > 0;
      const sel = hasCuts ? selectExpr(keep) : "";
      const selA = hasCuts ? `aselect='${sel}',asetpts=N/SR/TB,` : "";

      // 3) Subtítulos con los tiempos ya recortados
      let subsReady = false;
      if (subsOn && (words.length || segments.length)) {
        const remapped: SubWord[] = [];
        for (const w of words) {
          const s = mapTime(w.start, keep), e = mapTime(w.end, keep);
          if (s !== null && e !== null && e > s) remapped.push({ word: w.word, start: s, end: e });
        }
        const source = remapped.length ? remapped : segments.flatMap((sg) => {
          const s = mapTime(sg.start, keep), e = mapTime(sg.end, keep);
          return s !== null && e !== null && e > s ? [{ word: sg.text, start: s, end: e }] : [];
        });
        if (source.length) {
          await mountFont(ffmpeg);
          await writeInput(ffmpeg, "sub.ass", buildAss(W, H, source, [], { secondary: "&H0000D3FF" }));
          subsReady = true;
        }
      }

      // 4) Una sola pasada: corte + subtítulos + volumen parejo (+ música). Sin filtros de color.
      setPct(0);
      const vFilters: string[] = [];
      if (hasCuts) vFilters.push(`select='${sel}'`, "setpts=N/FRAME_RATE/TB");
      if (subsReady) vFilters.push("ass=sub.ass:fontsdir=/customfonts");
      const vf = vFilters.join(",");
      const vCodec = vf ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"] : ["-c:v", "copy"];
      setStatus(vf ? (hasCuts ? "Cortando y poniendo subtítulos…" : "Poniendo subtítulos…") : "Ajustando el volumen…");
      if (music) {
        await writeInput(ffmpeg, "music.mp3", music);
        const vNode = vf ? `[0:v]${vf}[v];` : "";
        const fc = `${vNode}[0:a]${selA}loudnorm=I=-16:TP=-1.5[voz];[1:a]volume=${musicVol},aloop=loop=-1:size=2e9[mus];[voz][mus]amix=inputs=2:duration=first:normalize=0[a]`;
        const code = await ffmpeg.exec(["-i", "in.mp4", "-i", "music.mp3", "-filter_complex", fc,
          "-map", vf ? "[v]" : "0:v", "-map", "[a]", ...vCodec, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", "out.mp4"]);
        if (code !== 0) throw new Error("Falló el acabado con música.");
      } else {
        const vArgs = vf ? ["-vf", vf] : [];
        let code = await ffmpeg.exec(["-i", "in.mp4", ...vArgs, "-af", `${selA}loudnorm=I=-16:TP=-1.5`,
          ...vCodec, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", "out.mp4"]);
        if (code !== 0) code = await ffmpeg.exec(["-i", "in.mp4", ...vArgs, "-an", ...vCodec, "-movflags", "+faststart", "-y", "out.mp4"]);
        if (code !== 0) throw new Error("Falló el acabado del video.");
      }

      const blob = await readBlob(ffmpeg, "out.mp4");
      setResult({ url: URL.createObjectURL(blob), name: files[0].name.replace(/\.[^.]+$/, "") + "_editado.mp4", size: fmtMB(blob.size), origDur, newDur });
      setStatus("¡Listo!");
      await safeDelete(ffmpeg, "in.mp4", "sub.ass", "music.mp3", "out.mp4");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("");
      resetEngine();
    } finally {
      off();
      setPct(100);
      setRunning(false);
      if (paid) router.refresh();
    }
  };

  const Toggle = ({ on, set, icon, label, hint }: { on: boolean; set: (v: boolean) => void; icon: React.ReactNode; label: string; hint: string }) => (
    <label className="flex cursor-pointer items-start gap-3 border-t border-line py-3 first:border-t-0">
      <input type="checkbox" checked={on} disabled={running} onChange={(e) => set(e.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />
      <span>
        <span className={`flex items-center gap-2 text-sm font-semibold ${on ? "text-brand-2" : ""}`}>{icon}{label}</span>
        <span className="block text-xs text-mute">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ToolHeader
        icon={<Scissors size={20} />}
        title="Editor de cortos"
        subtitle="Sube tu video hablado: cortamos silencios y retomas, ponemos subtítulos estilo TikTok y dejamos el volumen parejo. El video se edita en tu computadora."
      />

      <VideoPicker
        multiple
        maxMB={MAX_FILE_MB}
        disabled={running}
        onFiles={(fs) => { setError(null); setResult(null); setFiles((p) => [...p, ...fs]); }}
        onError={setError}
        title={files.length ? "Agregar más tomas (se unen en orden)" : "Arrastra tu video o haz clic para elegirlo"}
        hint={`MP4 o MOV · máx. ${MAX_FILE_MB} MB por video · puedes subir varias tomas`}
      />

      {files.length > 0 && (
        <ul className="card mt-3 divide-y divide-line p-3">
          {files.length > 1 && <li className="pb-2 text-xs font-semibold text-brand-2">{files.length} tomas: se cortan y se unen en este orden</li>}
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 py-2 text-sm">
              <span className="w-5 text-xs text-mute">{i + 1}.</span>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-mute">{fmtMB(f.size)}</span>
              {!running && files.length > 1 && (
                <>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-mute hover:text-ink disabled:opacity-30" aria-label="Subir"><ArrowUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === files.length - 1} className="text-mute hover:text-ink disabled:opacity-30" aria-label="Bajar"><ArrowDown size={14} /></button>
                </>
              )}
              {!running && <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-mute hover:text-red-400" aria-label="Quitar"><X size={14} /></button>}
            </li>
          ))}
        </ul>
      )}

      <div className="card mt-4 px-5 py-2">
        <Toggle on={cutRetakes} set={setCutRetakes} icon={<Scissors size={15} />} label="Cortar retomas y falsos comienzos"
          hint={`Cuando te trabas y repites, deja solo la última versión limpia (IA · ${precios.retomas} créditos).`} />
        {cutRetakes && (
          <label className="flex cursor-pointer items-center gap-2 pb-3 pl-7 text-xs text-mute">
            <input type="checkbox" checked={condense} disabled={running} onChange={(e) => setCondense(e.target.checked)} className="accent-cyan-400" />
            Quitar también ideas repetidas (más agresivo)
          </label>
        )}
        <Toggle on={cutSilences} set={setCutSilences} icon={<Scissors size={15} />} label="Cortar silencios" hint="Quita las pausas muertas para un ritmo ágil (gratis)." />
        <Toggle on={subsOn} set={setSubsOn} icon={<Captions size={15} />} label="Subtítulos automáticos" hint="Subtítulos estilo TikTok sincronizados con tu voz." />
        <p className="border-t border-line py-3 text-xs text-mute">
          Se respetan los colores originales. El audio se iguala a un volumen parejo (sin limpieza de ruido).
        </p>
        <div className="border-t border-line py-3">
          <input ref={musicRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setMusic(f); e.target.value = ""; }} />
          {!music ? (
            <button onClick={() => musicRef.current?.click()} disabled={running} className="btn-ghost !py-2 text-xs">
              <Music size={14} className="text-brand-2" /> Agregar música de fondo (opcional)
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="max-w-[220px] truncate text-emerald-400">♪ {music.name}</span>
              {!running && <button onClick={() => setMusic(null)} className="text-mute hover:text-red-400" aria-label="Quitar música"><X size={14} /></button>}
              <span className="text-xs text-mute">Volumen {Math.round(musicVol * 100)}%</span>
              <input type="range" min={0.05} max={0.5} step={0.01} value={musicVol} disabled={running}
                onChange={(e) => setMusicVol(parseFloat(e.target.value))} className="min-w-[120px] flex-1 accent-cyan-400" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button onClick={run} disabled={!files.length || running} className="btn-primary">
          {running ? <><Loader2 size={16} className="animate-spin" /> Editando…</> : <><Scissors size={16} /> {files.length > 1 ? "Unir y editar" : "Editar video"}</>}
        </button>
        <span className="text-sm">
          {cost ? <>Costo: <span className="font-semibold text-brand-2">{cost} créditos</span></> : <span className="font-semibold text-emerald-400">{yaPagado ? "Ya pagado: no se cobra de nuevo" : "Gratis"}</span>}
        </span>
        {running && <span className="text-sm text-mute">{status}</span>}
      </div>
      {running && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {warning && <p className="mt-4 text-sm text-amber-300">{warning}</p>}
      {error && <div className="mt-4"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      {result && (
        <div className="card mt-5 border-emerald-500/40 p-5">
          <p className="mb-3 flex flex-wrap items-center gap-2 font-semibold">
            <CheckCircle2 size={17} className="text-emerald-400" /> Corto editado
            <span className="text-xs font-normal text-mute">
              {result.origDur ? `${Math.round(result.origDur)} s → ${Math.round(result.newDur)} s · ` : ""}{result.size}
            </span>
          </p>
          <video src={result.url} controls className="max-h-[480px] w-full rounded-xl bg-black" />
          <a href={result.url} download={result.name} className="btn-primary mt-4"><Download size={16} /> Descargar</a>
        </div>
      )}
    </div>
  );
}
