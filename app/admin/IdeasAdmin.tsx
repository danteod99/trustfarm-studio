"use client";

import { useEffect, useMemo, useState } from "react";
import { MODELS, getModel } from "@/app/lib/catalog";
import { IDEA_CATEGORIES } from "@/app/lib/ideas";
import { parseVariaciones, variacionesATexto, type IdeaAdmin } from "@/app/lib/ideas-datos";

const MOVIMIENTOS = ["", "acercamiento", "alejamiento", "fija", "orbita", "paneo"];

interface Formulario {
  id: string; category: string; title: string; hook: string; model: string; aspect: string; duration: string; resolution: string;
  motion: string; prompt: string; image: string; video: string; variaciones: string; fuente: string; tendencia: boolean;
}

const VACIO: Formulario = {
  id: "", category: "Tecnología y granjas", title: "", hook: "", model: "z-image", aspect: "9:16", duration: "", resolution: "",
  motion: "", prompt: "", image: "", video: "", variaciones: "", fuente: "", tendencia: true,
};

function aFormulario(i: IdeaAdmin): Formulario {
  return {
    id: i.id, category: i.category, title: i.title, hook: i.hook, model: i.model, aspect: i.aspect, duration: i.duration ? String(i.duration) : "",
    resolution: i.resolution ?? "", motion: i.motion ?? "", prompt: i.prompt, image: i.image ?? "", video: i.video ?? "",
    variaciones: variacionesATexto(i.variaciones), fuente: i.fuente ?? "", tendencia: !!i.tendencia,
  };
}

export default function IdeasAdmin() {
  const [ideas, setIdeas] = useState<IdeaAdmin[]>([]);
  const [faltaTabla, setFaltaTabla] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [form, setForm] = useState<Formulario | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cargar() {
    const r = await fetch("/api/admin/ideas", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg(d.error || "No se pudieron cargar las ideas.");
    setIdeas(d.ideas ?? []);
    setFaltaTabla(!!d.faltaTabla);
    if (d.caida) setMsg("La base no respondió: se muestran las ideas del archivo.");
  }
  useEffect(() => { cargar(); }, []);

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return q ? ideas.filter((i) => `${i.id} ${i.title} ${i.category}`.toLowerCase().includes(q)) : ideas;
  }, [ideas, buscar]);

  const modelo = form ? getModel(form.model) : undefined;
  const set = (c: Partial<Formulario>) => setForm((f) => (f ? { ...f, ...c } : f));

  // Al cambiar de modelo se quedan solo las opciones que ese modelo tiene.
  function cambiarModelo(id: string) {
    const m = getModel(id);
    if (!m || !form) return;
    set({
      model: id,
      aspect: m.aspects.includes(form.aspect as never) ? form.aspect : m.aspects[0],
      duration: m.durations?.includes(Number(form.duration)) ? form.duration : String(m.durations?.[0] ?? ""),
      resolution: m.resolutions?.includes(form.resolution as never) ? form.resolution : (m.resolutions?.[0] ?? ""),
    });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !modelo || ocupado) return;
    setOcupado(true);
    setMsg(null);
    try {
      const cuerpo = {
        ...form,
        kind: modelo.kind,
        duration: form.duration ? Number(form.duration) : undefined,
        variaciones: parseVariaciones(form.variaciones),
      };
      const r = await fetch(editando ? `/api/admin/ideas/${editando}` : "/api/admin/ideas", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setMsg(d.error || "No se pudo guardar.");
      setMsg(`✓ Guardada. Ya está en /ideas y abre con /estudio?idea=${form.id}`);
      setForm(null);
      setEditando(null);
      await cargar();
    } catch {
      setMsg("Sin conexión: no se guardó.");
    } finally {
      setOcupado(false);
    }
  }

  async function alternarOculta(i: IdeaAdmin) {
    setMsg(null);
    const r = await fetch(`/api/admin/ideas/${i.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oculta: !i.oculta }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) return setMsg(d?.error || "No se pudo cambiar.");
    await cargar();
  }

  return (
    <section id="ideas" className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Ideas ({ideas.filter((i) => !i.oculta).length} publicadas de {ideas.length})</h2>
          <p className="mt-1 text-sm text-mute">Crea, edita u oculta las ideas de /ideas sin deploy.</p>
        </div>
        <button onClick={() => { setForm({ ...VACIO }); setEditando(null); setMsg(null); }} disabled={faltaTabla} className="btn-primary !py-2 text-sm">Nueva idea</button>
      </div>

      {faltaTabla && (
        <p className="mt-3 rounded-lg border border-amber-400/50 bg-amber-400/5 p-3 text-sm text-amber-200">
          Falta crear la tabla: corre <code>supabase/15_ideas.sql</code> en el SQL Editor de Supabase. Mientras tanto, /ideas usa las del archivo.
        </p>
      )}
      {msg && <p className="mt-3 text-sm text-mute">{msg}</p>}

      {form && modelo && (
        <form onSubmit={guardar} className="mt-4 grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-2">
          <input className="input" required placeholder="id (ej. granja-miniatura)" value={form.id} disabled={!!editando} onChange={(e) => set({ id: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {IDEA_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="input" required placeholder="Título" maxLength={80} value={form.title} onChange={(e) => set({ title: e.target.value })} />
          <input className="input" required placeholder="Gancho (una línea)" maxLength={200} value={form.hook} onChange={(e) => set({ hook: e.target.value })} />
          <select className="input" value={form.model} onChange={(e) => cambiarModelo(e.target.value)}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.kind === "video" ? "video" : "imagen"}</option>)}
          </select>
          <select className="input" value={form.aspect} onChange={(e) => set({ aspect: e.target.value })}>
            {modelo.aspects.map((a) => <option key={a}>{a}</option>)}
          </select>
          {modelo.kind === "video" && (
            <>
              <select className="input" value={form.duration} onChange={(e) => set({ duration: e.target.value })}>
                {modelo.durations?.map((d) => <option key={d} value={d}>{d} s</option>)}
              </select>
              <select className="input" value={form.resolution} onChange={(e) => set({ resolution: e.target.value })}>
                {modelo.resolutions?.map((r) => <option key={r}>{r}</option>)}
              </select>
              <select className="input" value={form.motion} onChange={(e) => set({ motion: e.target.value })}>
                {MOVIMIENTOS.map((m) => <option key={m} value={m}>{m || "Sin movimiento de cámara"}</option>)}
              </select>
            </>
          )}
          <textarea className="input sm:col-span-2" required rows={4} maxLength={2000} placeholder="Prompt" value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} />
          <textarea className="input sm:col-span-2" rows={3} placeholder="Variaciones (ninguna o de 3 a 5), una por línea: título | prompt con [lugar: una oficina / un garaje]" value={form.variaciones} onChange={(e) => set({ variaciones: e.target.value })} />
          <input className="input" placeholder="Imagen de ejemplo (/showcase/x.jpg)" value={form.image} onChange={(e) => set({ image: e.target.value })} />
          <input className="input" placeholder="Video de ejemplo (/showcase/x.mp4)" value={form.video} onChange={(e) => set({ video: e.target.value })} />
          <input className="input sm:col-span-2" maxLength={300} placeholder="Fuente: de qué tendencia sale (interno)" value={form.fuente} onChange={(e) => set({ fuente: e.target.value })} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.tendencia} onChange={(e) => set({ tendencia: e.target.checked })} className="accent-cyan-400" />
            🔥 Tendencia de la semana (va primero)
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button disabled={ocupado} className="btn-primary !py-2 text-sm">{ocupado ? "Guardando…" : "Guardar"}</button>
            <button type="button" onClick={() => { setForm(null); setEditando(null); }} className="btn-ghost !py-2 text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <input className="input mt-4" placeholder="Buscar idea…" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto">
        {lista.map((i) => (
          <li key={i.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${i.oculta ? "opacity-50" : ""}`}>
            <span className="min-w-0 truncate">
              {i.tendencia ? "🔥 " : ""}<b>{i.title}</b> <span className="text-xs text-mute">· {i.category}{i.oculta ? " · oculta" : ""}{i.enBase ? "" : " · solo archivo"}</span>
            </span>
            <span className="flex shrink-0 gap-2">
              <button onClick={() => { setForm(aFormulario(i)); setEditando(i.id); setMsg(null); document.getElementById("ideas")?.scrollIntoView({ behavior: "smooth" }); }} disabled={faltaTabla} className="btn-ghost !py-1 text-xs">Editar</button>
              <button onClick={() => alternarOculta(i)} disabled={faltaTabla} className="btn-ghost !py-1 text-xs">{i.oculta ? "Mostrar" : "Ocultar"}</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
