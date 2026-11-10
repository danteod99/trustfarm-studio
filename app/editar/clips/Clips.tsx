"use client";

// Multiclipping (portado de TrustMind): sube un video largo directo al servicio de clips (nube),
// que lo transcribe, elige los mejores momentos con IA, pone subtítulos, sigue la cara del
// hablante y devuelve clips 9:16 con orden sugerido de publicación.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Reproductor from "@/app/components/Reproductor";
import { Captions, CheckCircle2, Clapperboard, Download, Loader2, RefreshCw, Trash2, Trophy, Upload, X } from "lucide-react";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import VideoPicker from "@/app/editar/VideoPicker";
import { Link2 } from "lucide-react";
import { YT_RE, type ClipResult, type JobResult } from "@/app/lib/clips";

const MAX_MB = 3000;

interface Job {
  id: string; created_at: string; finished_at: string | null; nombre: string; status: string;
  progress: string | null; error: string | null; result: JobResult | null; expired: boolean;
  options: { clips?: number; cobro?: { creditos: number; reembolsado?: boolean } };
}
type Urls = Record<number, { video: string; srt: string | null }>;

const STATUS: Record<string, { label: string; cls: string }> = {
  subiendo: { label: "Subiendo…", cls: "text-amber-300" },
  pendiente: { label: "En cola", cls: "text-amber-300" },
  procesando: { label: "Procesando…", cls: "text-brand-2" },
  listo: { label: "Listo", cls: "text-emerald-400" },
  error: { label: "Error", cls: "text-red-400" },
};
const fmtDate = (iso: string) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function Clips({ precio, limite }: { precio: number; limite: number }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [numClips, setNumClips] = useState(10);
  const [subs, setSubs] = useState(true);
  const [ytUrl, setYtUrl] = useState("");
  const [conTitulo, setConTitulo] = useState(true);
  const [framing, setFraming] = useState<"auto" | "fit">("auto");
  const [preset, setPreset] = useState<"standard" | "short">("standard");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ job: Job; urls: Urls } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/editar/clips");
      if (r.ok) {
        const d = await r.json();
        setJobs(d.jobs || []);
        setActivo(!!d.activo);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      if (jobs.some((j) => ["pendiente", "procesando"].includes(j.status))) load();
    }, 6000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const openDetail = async (id: string) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetailLoading(true); setDetail(null);
    try {
      const r = await fetch(`/api/editar/clips/${id}`);
      const d = await r.json();
      if (r.ok) setDetail({ job: d.job, urls: d.urls || {} });
      else setError(d.error || "No se pudo abrir el video.");
    } finally {
      setDetailLoading(false);
    }
  };

  const ytValid = YT_RE.test(ytUrl.trim());

  const upload = async () => {
    const link = !file;
    if ((link ? !ytValid : false) || uploading) return;
    setError(null);
    setUploading(true); setUploadPct(0);
    try {
      const ext = file ? (file.name.split(".").pop() || "mp4").toLowerCase() : "mp4";
      const r = await fetch("/api/editar/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre || (file ? file.name.replace(/\.[^.]+$/, "") : "Video de YouTube"),
          ext, clips: numClips, subs, framing, preset, titulo: conTitulo, ...(link ? { url: ytUrl.trim() } : {}),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo crear el trabajo.");
      router.refresh();
      if (link) {
        // Link de YouTube: el servicio de clips baja el video; si no puede iniciar, se borra y se devuelven los créditos.
        const ir = await fetch(d.ingestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-upload-token": d.token },
          body: JSON.stringify({ url: ytUrl.trim() }),
        }).catch(() => null);
        if (!ir || !ir.ok) {
          await fetch(`/api/editar/clips/${d.jobId}`, { method: "DELETE" }).catch(() => {});
          let msg = "No se pudo conectar con el servicio de clips. Intenta de nuevo.";
          try { if (ir) msg = (await ir.json()).detail || msg; } catch { /* noop */ }
          throw new Error(msg);
        }
        setYtUrl(""); setNombre("");
        await load();
        return;
      }
      if (!file) return;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", d.uploadUrl, true);
        xhr.setRequestHeader("x-upload-token", d.token);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let msg = `La subida falló (${xhr.status}).`;
            try { msg = JSON.parse(xhr.responseText).detail || msg; } catch { /* noop */ }
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("No se pudo conectar con el servicio de clips. Revisa tu conexión e intenta de nuevo."));
        xhr.onabort = () => reject(new Error("Subida cancelada."));
        xhr.send(file);
      }).catch(async (e) => {
        // Sin video subido el trabajo nunca corre: borrarlo devuelve los créditos y el cupo del día.
        await fetch(`/api/editar/clips/${d.jobId}`, { method: "DELETE" }).catch(() => {});
        throw e;
      });
      setUploadPct(100);
      setFile(null); setNombre("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      load();
    } finally {
      setUploading(false);
      xhrRef.current = null;
    }
  };

  const remove = async (id: string) => {
    const r = await fetch(`/api/editar/clips/${id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "No se pudo borrar."); return; }
    if (open === id) { setOpen(null); setDetail(null); }
    load();
    router.refresh();
  };

  const renderClips = (job: Job, urls: Urls) => {
    const result = job.result;
    if (!result) return null;
    const rank = new Map(result.publication_order.map((idx, i) => [idx, i + 1]));
    const sorted = [...result.clips].sort((a, b) => (rank.get(a.index) || 99) - (rank.get(b.index) || 99) || a.index - b.index);
    return (
      <div className="mt-4">
        <p className="mb-3 text-xs text-mute">
          {result.clips.length} clips en el orden sugerido para publicar (gancho, claridad, valor y cierre). Los enlaces duran 1 hora: si vencen, vuelve a abrir el video.
        </p>
        {result.video_info && (
          <p className="mb-3 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs text-sky-200">
            <b>Video identificado:</b> {result.video_info.tipo_es}
            {result.video_info.descripcion ? ` — ${result.video_info.descripcion}` : ""}.
            {result.video_info.diseno === "persona_arriba_pantalla_abajo" && " Armamos los clips con la persona arriba y la pantalla abajo."}
          </p>
        )}
        {result.warning && <p className="mb-3 text-xs text-amber-300">La IA no pudo elegir los mejores momentos de este video; se cortó por frases completas.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((c: ClipResult) => {
            const u = urls[c.index];
            return (
              <div key={c.index} className="overflow-hidden rounded-xl border border-line bg-panel-2">
                {u?.video ? (
                  <div className="aspect-[9/16] w-full"><Reproductor src={u.video} /></div>
                ) : (
                  <div className="flex aspect-[9/16] items-center justify-center text-xs text-mute">sin vista previa</div>
                )}
                <div className="space-y-1.5 p-3">
                  <div className="flex items-center gap-1.5 text-xs">
                    {rank.get(c.index) && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <Trophy size={10} /> #{rank.get(c.index)}
                      </span>
                    )}
                    <span className="font-semibold">Clip {String(c.index).padStart(2, "0")}</span>
                    <span className="ml-auto text-[11px] text-mute">{fmtDur(c.duration)}</span>
                  </div>
                  <p className="text-xs leading-snug">{c.titulo || c.hook || "Momento elegido"}</p>
                  {c.score !== null && <p className="text-[11px] text-mute" title={c.score_reason}>Puntaje {c.score}/100</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {u?.video && <a href={u.video} download className="btn-primary !px-2.5 !py-1 text-xs"><Download size={12} /> MP4</a>}
                    {u?.srt && <a href={u.srt} download className="btn-ghost !px-2.5 !py-1 text-xs"><Captions size={12} /> SRT</a>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <ToolHeader
        icon={<Clapperboard size={20} />}
        title="Multiclipping"
        subtitle="Sube un video largo y recibe clips verticales con los mejores momentos, subtítulos y el orden para publicarlos. Se procesa en la nube: puedes cerrar la pestaña cuando termine la subida."
      />

      {!activo && !loading && (
        <div className="mb-4"><ErrorBox msg="Multiclipping todavía no está activo. Vuelve pronto o escríbenos por WhatsApp." /></div>
      )}

      {!file && (
        <VideoPicker
          maxMB={MAX_MB}
          disabled={uploading || !activo}
          onFiles={(fs) => { setError(null); setFile(fs[0]); }}
          onError={setError}
          title="Elige tu video largo"
          hint="Podcast, clase, en vivo o entrevista · MP4/MOV hasta 3 GB · mínimo 30 s hablados"
        />
      )}
      {!file && (
        <div className="card mt-4 p-5">
          <label className="flex items-center gap-2 text-sm font-semibold"><Link2 size={15} className="text-brand-2" /> …o pega un link de YouTube</label>
          <input value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} disabled={uploading || !activo} placeholder="https://www.youtube.com/watch?v=..." className="input mt-2" />
          {ytUrl && !ytValid && <p className="mt-1 text-xs text-red-400">Usa un link de youtube.com o youtu.be</p>}
          <p className="mt-1 text-xs text-mute">Un solo video, hasta 4 horas. Si YouTube bloquea la descarga, se te devuelven los créditos: sube el archivo.</p>
        </div>
      )}
      {(file || ytValid) && (
        <div className="card mt-4 space-y-4 p-5">
          {file && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{file.name} ({(file.size / 1048576).toFixed(0)} MB)</span>
              {!uploading && <button onClick={() => setFile(null)} className="text-mute hover:text-red-400" aria-label="Quitar"><X size={15} /></button>}
            </div>
          )}
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del video (opcional)" disabled={uploading} className="input" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-semibold">Clips máximos: {numClips}</span>
              <input type="range" min={1} max={15} value={numClips} disabled={uploading} onChange={(e) => setNumClips(Number(e.target.value))} className="mt-2 block w-full accent-cyan-400" />
              <span className="text-xs text-mute">Puede salir menos si no hay suficientes ideas completas.</span>
            </label>
            <div className="text-sm">
              <span className="font-semibold">Duración de los clips</span>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setPreset("standard")} disabled={uploading} className={`chip ${preset === "standard" ? "chip-on" : ""}`}>25 a 90 s · podcast, clase</button>
                <button onClick={() => setPreset("short")} disabled={uploading} className={`chip ${preset === "short" ? "chip-on" : ""}`}>15 a 60 s · TikTok</button>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={subs} disabled={uploading} onChange={(e) => setSubs(e.target.checked)} className="mt-1 accent-cyan-400" />
              <span><span className="font-semibold">Subtítulos palabra por palabra</span><span className="block text-xs text-mute">Quemados en el video y también en archivo .srt</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={conTitulo} disabled={uploading} onChange={(e) => setConTitulo(e.target.checked)} className="mt-1 accent-cyan-400" />
              <span><span className="font-semibold">Título arriba del clip</span><span className="block text-xs text-mute">La IA escribe un título corto y llamativo y lo quema en el video</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" checked={framing === "auto"} disabled={uploading} onChange={(e) => setFraming(e.target.checked ? "auto" : "fit")} className="mt-1 accent-cyan-400" />
              <span><span className="font-semibold">Seguir la cara de quien habla</span><span className="block text-xs text-mute">Recorta a vertical siguiendo el rostro. En tutoriales y gameplay con webcam pone a la persona arriba y la pantalla abajo. Identifica el tipo de video solo. Apagado: muestra todo el cuadro.</span></span>
            </label>
          </div>
          {uploading && file ? (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-mute">
                <span>Subiendo {uploadPct}%: no cierres la pestaña hasta que termine</span>
                <button onClick={() => xhrRef.current?.abort()} className="btn-ghost !py-1 text-xs">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={upload} disabled={!activo || uploading} className="btn-primary">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : file ? <Upload size={16} /> : <Link2 size={16} />}
                {file ? "Subir y sacar clips" : uploading ? "Enviando…" : "Sacar clips del link"}
              </button>
              <span className="text-sm">Costo: <span className="font-semibold text-brand-2">{precio} créditos</span> por video</span>
            </div>
          )}
        </div>
      )}

      {error && <div className="mt-4"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      <div className="card mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Mis videos</h2>
          <button onClick={load} className="btn-ghost !py-1.5 text-xs"><RefreshCw size={13} /> Actualizar</button>
        </div>
        {loading ? (
          <p className="text-sm text-mute"><Loader2 size={14} className="mr-2 inline animate-spin" />Cargando…</p>
        ) : !jobs.length ? (
          <p className="text-sm text-mute">Aún no hay videos. Sube el primero arriba.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => {
              const ui = STATUS[j.status] || { label: j.status, cls: "text-mute" };
              const n = j.result?.clips?.length || 0;
              const refunded = j.options?.cobro?.reembolsado;
              return (
                <div key={j.id} className="rounded-xl border border-line bg-panel-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{j.nombre}</p>
                      <p className="text-xs text-mute">
                        {fmtDate(j.created_at)}
                        {j.status === "procesando" && j.progress ? ` · ${j.progress}` : ""}
                        {j.status === "listo" ? ` · ${n} clips${j.expired ? " (archivos borrados a las 48 h)" : ""}` : ""}
                        {j.error ? ` · ${j.error}` : ""}
                        {refunded ? " · créditos devueltos" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${ui.cls}`}>
                        {["pendiente", "procesando", "subiendo"].includes(j.status) && <Loader2 size={11} className="mr-1 inline animate-spin" />}
                        {ui.label}
                      </span>
                      {j.status === "listo" && !j.expired && (
                        <button onClick={() => openDetail(j.id)} className="btn-primary !px-3 !py-1.5 text-xs">
                          <CheckCircle2 size={13} /> {open === j.id ? "Ocultar" : "Ver clips"}
                        </button>
                      )}
                      {j.status !== "procesando" && (
                        <button onClick={() => remove(j.id)} title="Borrar" className="btn-ghost !px-2 !py-1.5"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                  {open === j.id && (detailLoading ? <p className="mt-3 text-xs text-mute">Cargando clips…</p> : detail && renderClips(detail.job, detail.urls))}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-mute">
          Un video de 30 minutos tarda entre 10 y 20 minutos. Máximo {limite} videos por día. Los clips se guardan 48 horas: descárgalos antes.
          Si un video falla, te devolvemos los créditos.
        </p>
      </div>
    </div>
  );
}
