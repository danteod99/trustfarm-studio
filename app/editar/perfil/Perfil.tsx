"use client";

// Perfil de TikTok: pegas tu @usuario, el servicio de clips (nube) baja tus videos sin marca de agua y,
// si quieres, mete cada uno en un dispositivo real (variación «Pantalla real»). Tú descargas todo.
// No publica nada.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Reproductor from "@/app/components/Reproductor";
import { CheckCircle2, Download, FolderDown, Loader2, RefreshCw, Trash2, UserRound } from "lucide-react";
import Bucles from "@/app/editar/Bucles";
import ToolHeader, { ErrorBox } from "@/app/editar/ToolHeader";
import type { JobResult } from "@/app/lib/clips";
import SelectorVariacion, { SelectorVersiones, cuerpoVariacion, type SeleccionVariacion } from "@/app/editar/SelectorVariacion";
import { limpiarUsuario, PERFIL_MAX_VIDEOS, textoPuesto, textoSeleccion } from "@/app/lib/perfil";
import SelectorOrden, { cuerpoOrden, type SeleccionOrden } from "@/app/editar/SelectorOrden";
import { etiquetaPlantilla, textoVariacion } from "@/app/lib/variacion";
import { buildZip } from "@/app/granja/zip";

interface Job {
  id: string; created_at: string; finished_at: string | null; nombre: string; status: string;
  progress: string | null; error: string | null; result: JobResult | null; expired: boolean;
  options: { handle?: string; variacion?: string | null; estilo?: string | null; pantalla?: string | null; versiones?: number; max_videos?: number; orden?: string; saltar?: number; cobro?: { creditos: number; reembolsado?: boolean } };
}
type Urls = Record<number, { video: string; srt: string | null }>;

const STATUS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "En cola", cls: "text-amber-300" },
  procesando: { label: "Procesando…", cls: "text-brand-2" },
  listo: { label: "Listo", cls: "text-emerald-400" },
  error: { label: "Error", cls: "text-red-400" },
};
const fmtDate = (iso: string) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const slug = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "video";

type DirHandle = {
  getDirectoryHandle(name: string, o?: { create: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create: boolean }): Promise<{ createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }> }>;
};
const puedeElegirCarpeta = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

export default function Perfil({ precio, precioVariacion, limite }: { precio: number; precioVariacion: number; limite: number }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState("");
  const [seleccion, setSeleccion] = useState<SeleccionOrden>({ orden: "recientes", saltar: 0, cantidad: PERFIL_MAX_VIDEOS });
  const cantidad = seleccion.cantidad;
  const [versiones, setVersiones] = useState(1);
  const [sel, setSel] = useState<SeleccionVariacion>({ variacion: "pantalla_real", pantalla: "mixto", estilo: "mixto" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ job: Job; urls: Urls } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bajando, setBajando] = useState<{ job: string; hechos: number; total: number } | null>(null);

  const handle = limpiarUsuario(usuario);
  const costo = sel.variacion ? precioVariacion : precio;

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/editar/perfil");
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
    }, 5000);
    return () => clearInterval(t);
  }, [jobs, load]);

  const enviar = async () => {
    if (!handle || enviando) return;
    setError(null); setEnviando(true);
    try {
      const r = await fetch("/api/editar/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: handle, ...cuerpoOrden(seleccion), versiones, ...cuerpoVariacion(sel) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo crear el trabajo.");
      setUsuario("");
      router.refresh();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  };

  const openDetail = async (id: string) => {
    if (open === id) { setOpen(null); setDetail(null); return; }
    setOpen(id); setDetailLoading(true); setDetail(null);
    try {
      const r = await fetch(`/api/editar/clips/${id}`);
      const d = await r.json();
      if (r.ok) setDetail({ job: d.job, urls: d.urls || {} });
      else setError(d.error || "No se pudo abrir el trabajo.");
    } finally {
      setDetailLoading(false);
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

  // Baja todos los videos a una carpeta elegida (Chrome/Edge) o en un ZIP.
  const descargarTodo = async (job: Job, urls: Urls, modo: "carpeta" | "zip") => {
    const clips = job.result?.clips || [];
    const archivos = clips
      .filter((c) => urls[c.index]?.video)
      .map((c) => ({ nombre: `${String(c.index).padStart(2, "0")}-${slug(c.titulo)}.mp4`, url: urls[c.index].video }));
    if (!archivos.length) { setError("No hay videos para descargar. Abre el trabajo de nuevo para renovar los enlaces."); return; }
    setError(null);
    const carpeta = `tiktok-${slug(job.options.handle || job.nombre)}${job.options.variacion === "marco" ? "-marco" : job.options.variacion ? "-pantalla-real" : ""}`;
    try {
      setBajando({ job: job.id, hechos: 0, total: archivos.length });
      if (modo === "carpeta") {
        const raiz = await (window as unknown as { showDirectoryPicker(o: { mode: string }): Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite" });
        const dir = await raiz.getDirectoryHandle(carpeta, { create: true });
        let n = 0;
        for (const a of archivos) {
          const r = await fetch(a.url);
          if (!r.ok) throw new Error("Un enlace venció. Abre el trabajo de nuevo y repite.");
          const w = await (await dir.getFileHandle(a.nombre, { create: true })).createWritable();
          await w.write(await r.blob());
          await w.close();
          setBajando({ job: job.id, hechos: ++n, total: archivos.length });
        }
      } else {
        const entradas: { path: string; data: Blob }[] = [];
        for (const a of archivos) {
          const r = await fetch(a.url);
          if (!r.ok) throw new Error("Un enlace venció. Abre el trabajo de nuevo y repite.");
          entradas.push({ path: `${carpeta}/${a.nombre}`, data: await r.blob() });
          setBajando({ job: job.id, hechos: entradas.length, total: archivos.length });
        }
        const blob = await buildZip(entradas);
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href; a.download = `${carpeta}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") setError(e instanceof Error ? e.message : "No se pudo descargar.");
    } finally {
      setBajando(null);
    }
  };

  const renderVideos = (job: Job, urls: Urls) => {
    const clips = job.result?.clips || [];
    if (!clips.length) return null;
    return (
      <div className="mt-4">
        <p className="mb-3 text-xs text-mute">Los enlaces duran 1 hora: si vencen, vuelve a abrir el trabajo.</p>
        {job.result?.aviso && <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{job.result.aviso}</p>}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {puedeElegirCarpeta() && (
            <button type="button" disabled={!!bajando} onClick={() => descargarTodo(job, urls, "carpeta")} className="btn-primary !px-3 !py-1.5 text-xs">
              <FolderDown size={13} /> Descargar todos (elegir carpeta)
            </button>
          )}
          <button type="button" disabled={!!bajando} onClick={() => descargarTodo(job, urls, "zip")} className={`${puedeElegirCarpeta() ? "btn-ghost" : "btn-primary"} !px-3 !py-1.5 text-xs`}>
            <Download size={13} /> Descargar todos en ZIP
          </button>
          {bajando?.job === job.id && (
            <span className="flex items-center gap-2 text-xs text-mute"><Loader2 size={13} className="animate-spin" /> Descargando {bajando.hechos}/{bajando.total}…</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {clips.map((c) => {
            const u = urls[c.index];
            const plantilla = (c as { plantilla?: string | null }).plantilla;
            const estiloMarco = (c as { estilo_marco?: string | null }).estilo_marco;
            return (
              <div key={c.index} className="overflow-hidden rounded-xl border border-line bg-panel-2">
                {u?.video ? <div className="aspect-[9/16] w-full"><Reproductor src={u.video} /></div> : (
                  <div className="flex aspect-[9/16] items-center justify-center text-xs text-mute">sin vista previa</div>
                )}
                <div className="space-y-1.5 p-3">
                  <p className="line-clamp-2 text-xs leading-snug">{c.titulo}</p>
                  {textoPuesto(c as { views?: number | null; puesto?: number | null; orden?: string | null }) && <p className="text-[11px] font-semibold text-emerald-400">{textoPuesto(c as { views?: number | null; puesto?: number | null; orden?: string | null })}</p>}
                  {plantilla && <p className="text-[11px] text-mute">{etiquetaPlantilla(plantilla)}</p>}
                  {(c as { version?: number }).version && (c as { version?: number }).version! > 1 && <p className="text-[11px] font-semibold text-brand-2">v{(c as { version?: number }).version}</p>}
                  {estiloMarco && <p className="text-[11px] text-mute">Marco · {estiloMarco}</p>}
                  <div className="pt-1">
                    {u?.video && <a href={u.video} download className="btn-primary !px-2.5 !py-1 text-xs"><Download size={12} /> MP4</a>}
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
        icon={<UserRound size={20} />}
        title="Perfil de TikTok"
        subtitle="Pega el @usuario de tu perfil y bajamos tus videos sin marca de agua. Opcional: cada video se mete dentro de una laptop, TV, celular, tablet o monitor reales, o sobre un fondo o marco, para que se vea distinto. No publica nada: tú descargas y subes."
      />

      {!activo && !loading && <div className="mb-4"><ErrorBox msg="Esta herramienta todavía no está activa. Vuelve pronto o escríbenos por WhatsApp." /></div>}

      <div className="card space-y-4 p-5">
        <label className="block text-sm">
          <span className="font-semibold">Usuario de TikTok</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
            disabled={enviando || !activo}
            placeholder="@tucuenta o el link de tu perfil"
            className="input mt-2"
          />
          {usuario && !handle && <span className="mt-1 block text-xs text-red-400">Solo letras, números, punto y guion bajo (por ejemplo @tucuenta).</span>}
          <span className="mt-1 block text-xs text-mute">Úsalo con tu propio perfil, que sea público. Elige si bajas los más recientes o los más virales.</span>
        </label>
        <SelectorOrden value={seleccion} onChange={setSeleccion} disabled={enviando} />
        <SelectorVariacion value={sel} onChange={setSel} disabled={enviando} />
        <SelectorVersiones value={versiones} onChange={setVersiones} videos={cantidad} disabled={enviando} />
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={enviar} disabled={!activo || !handle || enviando} className="btn-primary">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <UserRound size={16} />}
            {enviando ? "Enviando…" : "Bajar videos"}
          </button>
          <span className="text-sm">Costo: <span className="font-semibold text-brand-2">{costo} créditos</span> por trabajo</span>
        </div>
      </div>

      {error && <div className="mt-4"><ErrorBox msg={error} onClose={() => setError(null)} /></div>}

      <div className="card mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Mis descargas</h2>
          <button onClick={load} className="btn-ghost !py-1.5 text-xs"><RefreshCw size={13} /> Actualizar</button>
        </div>
        {loading ? (
          <p className="text-sm text-mute"><Loader2 size={14} className="mr-2 inline animate-spin" />Cargando…</p>
        ) : !jobs.length ? (
          <p className="text-sm text-mute">Aún no hay descargas. Pega tu usuario arriba.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((j) => {
              const ui = STATUS[j.status] || { label: j.status, cls: "text-mute" };
              const n = j.result?.clips?.length || 0;
              return (
                <div key={j.id} className="rounded-xl border border-line bg-panel-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{j.nombre}{j.options.orden === "virales" || j.options.saltar ? ` · ${textoSeleccion(j.options.orden, j.options.saltar, j.options.max_videos || 1)}` : ""}{(j.options.versiones || 1) > 1 ? ` · ${j.options.versiones} versiones` : ""}{j.options.variacion ? ` · ${textoVariacion(j.options.variacion, j.options.estilo, j.options.pantalla)}` : ""}</p>
                      <p className="text-xs text-mute">
                        {fmtDate(j.created_at)}
                        {j.status === "procesando" && j.progress ? ` · ${j.progress}` : ""}
                        {j.status === "listo" ? ` · ${n} videos${j.expired ? " (archivos borrados a las 48 h)" : ""}` : ""}
                        {j.error ? ` · ${j.error}` : ""}
                        {j.options.cobro?.reembolsado ? " · créditos devueltos" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${ui.cls}`}>
                        {["pendiente", "procesando"].includes(j.status) && <Loader2 size={11} className="mr-1 inline animate-spin" />}
                        {ui.label}
                      </span>
                      {j.status === "listo" && !j.expired && (
                        <button onClick={() => openDetail(j.id)} className="btn-primary !px-3 !py-1.5 text-xs">
                          <CheckCircle2 size={13} /> {open === j.id ? "Ocultar" : "Ver videos"}
                        </button>
                      )}
                      {j.status !== "procesando" && (
                        <button onClick={() => remove(j.id)} title="Borrar" className="btn-ghost !px-2 !py-1.5"><Trash2 size={13} /></button>
                      )}
                    </div>
                  </div>
                  {open === j.id && (detailLoading ? <p className="mt-3 text-xs text-mute">Cargando videos…</p> : detail && renderVideos(detail.job, detail.urls))}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-mute">
          Con pantalla real tarda unos 2 a 4 minutos por video; con marco o fondo, menos de un minuto; sin variación, unos segundos. Máximo {limite} trabajos por día. Los videos se guardan 48 horas: descárgalos antes.
          Si un trabajo falla, te devolvemos los créditos.
        </p>
      </div>
      <Bucles tool="perfil" precio={precio} precioVariacion={precioVariacion} />
    </div>
  );
}
