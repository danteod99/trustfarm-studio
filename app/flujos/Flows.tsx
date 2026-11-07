"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDown, CalendarClock, CheckCircle2, Loader2, Pause, Play, Plus, Repeat, Trash2, TriangleAlert, Workflow, X } from "lucide-react";
import { MODELS, creditCost, getModel, type Aspect, type Resolution } from "@/app/lib/catalog";
import { MOTIONS } from "@/app/lib/templates";
import { FLOW_TEMPLATES } from "@/app/lib/flujos-plantillas";
import type { FlowStep } from "@/app/lib/flujos-validar";
import type { PublicGeneration } from "@/app/components/GenerationCard";

interface Flow { id: string; name: string; steps: FlowStep[] }
interface Run {
  id: string;
  name: string;
  status: "running" | "done" | "failed";
  step: number;
  error: string | null;
  loop_id: string | null;
  created_at: string;
  steps: { title: string; model: string; generation: PublicGeneration | null }[];
}
interface Loop {
  id: string;
  name: string;
  flow_id: string | null;
  per_run: number;
  hour: number;
  minute?: number;
  days: number[];
  once?: boolean;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_error: string | null;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");
/** Fecha de hoy en Lima (UTC-5) como "AAAA-MM-DD", para el mínimo del selector de fecha. */
const limaToday = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString("es", { timeZone: "America/Lima", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-mute";

function stepCost(s: FlowStep) {
  const m = getModel(s.model);
  return m ? creditCost(m, { aspect: s.aspect, duration: s.duration, resolution: s.resolution }) : 0;
}
const flowCost = (steps: FlowStep[]) => steps.reduce((t, s) => t + stepCost(s), 0);

function blankStep(input: "none" | "previous" = "none"): FlowStep {
  return { title: "", model: "z-image", aspect: "9:16", prompt: "", input };
}

/** Ajusta duración/resolución al cambiar de modelo. */
function withModel(s: FlowStep, id: string): FlowStep {
  const m = getModel(id)!;
  const aspect = m.aspects.includes(s.aspect) ? s.aspect : m.aspects[0];
  if (m.kind === "image") return { title: s.title, model: id, aspect, prompt: s.prompt, input: s.input };
  return { ...s, model: id, aspect, duration: m.durations![0], resolution: m.resolutions![0] as Resolution };
}

function StepEditor({ s, i, onChange, onRemove }: { s: FlowStep; i: number; onChange: (s: FlowStep) => void; onRemove?: () => void }) {
  const m = getModel(s.model)!;
  const prev = i > 0;
  return (
    <div className="rounded-xl border border-line bg-panel-2/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/20 text-xs font-bold text-brand-2">{i + 1}</span>
        <input className="input !py-1.5 text-sm" placeholder={`Paso ${i + 1}`} value={s.title} onChange={(e) => onChange({ ...s, title: e.target.value })} />
        <span className="shrink-0 text-xs text-mute">{stepCost(s)} cr</span>
        {onRemove && (
          <button onClick={onRemove} aria-label="Quitar paso" className="text-mute hover:text-error">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className={label}>Modelo</label>
          <select className="input !py-1.5 text-sm" value={s.model} onChange={(e) => onChange(withModel(s, e.target.value))}>
            {MODELS.filter((x) => !x.adminOnly).map((x) => (
              <option key={x.id} value={x.id}>
                {x.kind === "video" ? "🎬" : "🖼️"} {x.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Formato</label>
          <select className="input !py-1.5 text-sm" value={s.aspect} onChange={(e) => onChange({ ...s, aspect: e.target.value as Aspect })}>
            {m.aspects.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        {m.kind === "video" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Duración</label>
              <select className="input !py-1.5 text-sm" value={s.duration} onChange={(e) => onChange({ ...s, duration: Number(e.target.value) })}>
                {m.durations!.map((d) => (
                  <option key={d} value={d}>
                    {d} s
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Calidad</label>
              <select className="input !py-1.5 text-sm" value={s.resolution} onChange={(e) => onChange({ ...s, resolution: e.target.value as Resolution })}>
                {m.resolutions!.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      <label className={`${label} mt-3`}>Descripción</label>
      <textarea className="input min-h-20 resize-y text-sm" value={s.prompt} onChange={(e) => onChange({ ...s, prompt: e.target.value })} />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        {prev && m.acceptsImage && (
          <label className="flex items-center gap-2 text-mute">
            <input type="checkbox" checked={s.input === "previous"} onChange={(e) => onChange({ ...s, input: e.target.checked ? "previous" : "none" })} />
            Usar la imagen del paso anterior {m.kind === "video" ? "(animarla)" : "(como referencia)"}
          </label>
        )}
        {m.kind === "video" && (
          <select className="input !w-auto !py-1.5 text-sm" value={s.motion ?? ""} onChange={(e) => onChange({ ...s, motion: e.target.value || undefined })}>
            <option value="">Cámara: libre</option>
            {MOTIONS.map((x) => (
              <option key={x.id} value={x.id}>
                Cámara: {x.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function RunCard({ run }: { run: Run }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-semibold">
          {run.name} {run.loop_id && <span className="ml-1 text-xs font-normal text-brand-2">· loop</span>}
        </p>
        <span className="flex items-center gap-1.5 text-xs">
          {run.status === "running" && <><Loader2 size={13} className="animate-spin text-brand-2" /> Paso {run.step + 1} de {run.steps.length}</>}
          {run.status === "done" && <><CheckCircle2 size={13} className="text-ok" /> Listo</>}
          {run.status === "failed" && <><TriangleAlert size={13} className="text-amber-400" /> Falló</>}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {run.steps.map((s, i) => {
          const g = s.generation;
          return (
            <div key={i} className="w-28 shrink-0">
              <div className="relative aspect-[9/16] overflow-hidden rounded-lg border border-line bg-panel-2">
                {g?.status === "done" && g.url ? (
                  g.kind === "video" ? (
                    <video src={g.url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.url} alt={s.title} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="grid h-full place-items-center text-mute">
                    {g?.status === "failed" ? <TriangleAlert size={16} /> : i <= run.step && run.status === "running" ? <Loader2 size={16} className="animate-spin" /> : "·"}
                  </div>
                )}
              </div>
              <p className="mt-1 truncate text-[11px] text-mute">{s.title}</p>
              {g?.status === "done" && g.url && (
                <a href={g.url} target="_blank" rel="noreferrer" className="text-[11px] text-brand-2 hover:underline">
                  Descargar
                </a>
              )}
            </div>
          );
        })}
      </div>
      {run.error && <p className="mt-2 text-xs text-amber-300">{run.error}</p>}
    </div>
  );
}

export default function Flows() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loops, setLoops] = useState<Loop[]>([]);
  const [draft, setDraft] = useState<{ name: string; steps: FlowStep[] } | null>(null);
  const [loopFor, setLoopFor] = useState<Flow | null>(null);
  const [loopForm, setLoopForm] = useState({ once: false, per_run: 1, hour: 9, minute: 0, days: [1, 2, 3, 4, 5], date: "", time: "19:00" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [f, l] = await Promise.all([fetch("/api/flows"), fetch("/api/loops")]);
    if (f.ok) {
      const d = await f.json();
      setFlows(d.flows);
      setRuns(d.runs);
    }
    if (l.ok) setLoops((await l.json()).loops);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mientras haya corridas en curso, refresca cada 10 s.
  useEffect(() => {
    if (!runs.some((r) => r.status === "running")) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [runs, load]);

  async function call(key: string, url: string, init?: RequestInit) {
    setBusy(key);
    setError(null);
    const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setError(d.error || "No se pudo completar.");
      return null;
    }
    await load();
    return d;
  }

  async function saveDraft() {
    if (!draft) return;
    const d = await call("save", "/api/flows", { method: "POST", body: JSON.stringify(draft) });
    if (d) setDraft(null);
  }

  async function saveLoop() {
    if (!loopFor) return;
    const d = await call("loop", "/api/loops", {
      method: "POST",
      body: JSON.stringify({ name: loopFor.name, flow_id: loopFor.id, ...loopForm, date: loopForm.date || limaToday() }),
    });
    if (d) setLoopFor(null);
  }

  const flowName = (id: string | null) => flows.find((f) => f.id === id)?.name ?? "Generación";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Automatiza</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Flujos y loops</h1>
          <p className="mt-2 max-w-2xl text-mute">
            Un <b className="text-ink">flujo</b> encadena pasos: cada uno usa el resultado del anterior (personaje → escena → video con voz). Cada{" "}
            <b className="text-ink">flujo</b> se puede <b className="text-ink">programar</b>: una sola vez en la fecha y hora que elijas, o repetirlo cada
            semana. Los resultados llegan a tu galería.
          </p>
        </div>
        <Link href="/desarrolladores" className="btn-ghost">
          API para desarrolladores
        </Link>
      </div>

      {error && <p className="mt-6 rounded-xl bg-rosa/10 p-3 text-sm text-error">{error}</p>}

      {/* Crear */}
      {!draft ? (
        <section className="mt-8">
          <h2 className={label}>Empieza con una receta</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW_TEMPLATES.map((t) => (
              <div key={t.id} className="card grano transition hover:-translate-y-0.5 hover:border-brand/60">
                <button onClick={() => setDraft({ name: t.name, steps: t.steps.map((s) => ({ ...s })) })} className="block h-full w-full p-5 text-left">
                  <div className="text-2xl">{t.emoji}</div>
                  <p className="mt-2 font-semibold">{t.name}</p>
                  <p className="mt-1 text-sm text-mute">{t.pitch}</p>
                  <p className="mt-3 text-xs text-brand-2">
                    {t.steps.length} pasos · {flowCost(t.steps)} créditos por corrida
                  </p>
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => setDraft({ name: "", steps: [blankStep()] })} className="btn-ghost mt-4">
            <Plus size={15} /> Flujo en blanco
          </button>
        </section>
      ) : (
        <section className="card mt-8 border-brand/40 p-5 resplandor">
          <div className="flex flex-wrap items-center gap-3">
            <Workflow size={18} className="text-brand-2" />
            <input className="input max-w-sm" placeholder="Nombre del flujo" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <span className="text-sm text-mute">{flowCost(draft.steps)} créditos por corrida</span>
            <div className="flex-1" />
            <button onClick={() => setDraft(null)} className="btn-ghost">
              Cancelar
            </button>
            <button onClick={saveDraft} disabled={busy === "save"} className="btn-primary">
              {busy === "save" && <Loader2 size={15} className="animate-spin" />} Guardar flujo
            </button>
          </div>
          <div className="mt-5 space-y-2">
            {draft.steps.map((s, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="flex justify-center py-1 text-mute">
                    <ArrowDown size={16} />
                  </div>
                )}
                <StepEditor
                  s={s}
                  i={i}
                  onChange={(n) => setDraft({ ...draft, steps: draft.steps.map((x, k) => (k === i ? n : x)) })}
                  onRemove={draft.steps.length > 1 ? () => setDraft({ ...draft, steps: draft.steps.filter((_, k) => k !== i) }) : undefined}
                />
              </div>
            ))}
          </div>
          {draft.steps.length < 6 && (
            <button onClick={() => setDraft({ ...draft, steps: [...draft.steps, blankStep("previous")] })} className="btn-ghost mt-4">
              <Plus size={15} /> Agregar paso
            </button>
          )}
        </section>
      )}

      {/* Mis flujos */}
      <section className="mt-12">
        <h2 className={label}>Mis flujos</h2>
        {flows.length === 0 ? (
          <p className="text-sm text-mute">Todavía no tienes flujos. Empieza con una receta de arriba.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {flows.map((f) => (
              <div key={f.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{f.name}</p>
                    <p className="mt-1 text-xs text-mute">
                      {f.steps.map((s) => s.title).join(" → ")} · {flowCost(f.steps)} créditos
                    </p>
                  </div>
                  <button onClick={() => call(`del-${f.id}`, `/api/flows/${f.id}`, { method: "DELETE" })} className="text-mute hover:text-error" aria-label="Borrar flujo">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => call(`run-${f.id}`, `/api/flows/${f.id}/run`, { method: "POST" })} disabled={!!busy} className="btn-primary !py-2">
                    {busy === `run-${f.id}` ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Correr ahora
                  </button>
                  <button onClick={() => setLoopFor(f)} className="btn-ghost !py-2">
                    <CalendarClock size={15} /> Programar
                  </button>
                </div>
                {loopFor?.id === f.id && (
                  <div className="mt-4 space-y-3 rounded-xl border border-brand/40 bg-brand/5 p-4 text-sm">
                    <div className="flex gap-1.5">
                      <button onClick={() => setLoopForm({ ...loopForm, once: true })} className={`chip ${loopForm.once ? "chip-on" : ""}`}>
                        Una sola vez
                      </button>
                      <button onClick={() => setLoopForm({ ...loopForm, once: false })} className={`chip ${!loopForm.once ? "chip-on" : ""}`}>
                        <Repeat size={12} /> Repetir cada semana
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Correr</span>
                      <select className="input !w-auto !py-1.5" value={loopForm.per_run} onChange={(e) => setLoopForm({ ...loopForm, per_run: Number(e.target.value) })}>
                        {[1, 2, 3, 5, 10].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? "vez" : "veces"}
                          </option>
                        ))}
                      </select>
                      {loopForm.once ? (
                        <>
                          <span>el</span>
                          <input
                            type="date"
                            className="input !w-auto !py-1.5"
                            min={limaToday()}
                            value={loopForm.date || limaToday()}
                            onChange={(e) => setLoopForm({ ...loopForm, date: e.target.value })}
                          />
                          <span>a las</span>
                          <input type="time" className="input !w-auto !py-1.5" value={loopForm.time} onChange={(e) => setLoopForm({ ...loopForm, time: e.target.value })} />
                        </>
                      ) : (
                        <>
                          <span>a las</span>
                          <select className="input !w-auto !py-1.5" value={loopForm.hour} onChange={(e) => setLoopForm({ ...loopForm, hour: Number(e.target.value) })}>
                            {Array.from({ length: 24 }, (_, h) => (
                              <option key={h} value={h}>
                                {pad(h)}
                              </option>
                            ))}
                          </select>
                          <span>:</span>
                          <select className="input !w-auto !py-1.5" value={loopForm.minute} onChange={(e) => setLoopForm({ ...loopForm, minute: Number(e.target.value) })}>
                            {[0, 15, 30, 45].map((m) => (
                              <option key={m} value={m}>
                                {pad(m)}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      <span className="text-mute">(hora de Lima)</span>
                    </div>
                    {!loopForm.once && (
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS.map((d, k) => (
                          <button
                            key={d}
                            onClick={() =>
                              setLoopForm({ ...loopForm, days: loopForm.days.includes(k) ? loopForm.days.filter((x) => x !== k) : [...loopForm.days, k].sort() })
                            }
                            className={`chip ${loopForm.days.includes(k) ? "chip-on" : ""}`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-mute">
                      ≈ {flowCost(f.steps) * loopForm.per_run} créditos {loopForm.once ? "en total" : "cada vez que corre"}. Si no hay saldo, esa vez se salta.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={saveLoop} disabled={busy === "loop" || (!loopForm.once && loopForm.days.length === 0)} className="btn-primary !py-2">
                        {loopForm.once ? "Programar" : "Activar repetición"}
                      </button>
                      <button onClick={() => setLoopFor(null)} className="btn-ghost !py-2">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Loops */}
      <section className="mt-12">
        <h2 className={label}>Programados</h2>
        {loops.length === 0 ? (
          <p className="text-sm text-mute">Nada programado. En un flujo, toca «Programar».</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {loops.map((l) => (
              <div key={l.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {l.once ? (
                      <CalendarClock size={15} className={l.active ? "text-brand-2" : "text-mute"} />
                    ) : (
                      <Repeat size={15} className={l.active ? "text-brand-2" : "text-mute"} />
                    )}{" "}
                    {l.flow_id ? flowName(l.flow_id) : l.name}
                  </p>
                  <p className="mt-1 text-xs text-mute">
                    {l.once
                      ? `${l.per_run}× · una sola vez · ${whenLabel(l.next_run_at)} Lima`
                      : `${l.per_run}× · ${l.days.map((d) => DAYS[d]).join(", ")} · ${pad(l.hour)}:${pad(l.minute ?? 0)} Lima`}
                  </p>
                  {l.active && !l.once && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-mute">
                      <CalendarClock size={12} /> Próxima: {whenLabel(l.next_run_at)}
                    </p>
                  )}
                  {l.once && !l.active && l.last_run_at && <p className="mt-1 text-xs text-brand-2">Ya corrió ✓</p>}
                  {l.last_error && <p className="mt-1 text-xs text-amber-300">Última vez: {l.last_error}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!(l.once && !l.active && l.last_run_at) && (
                    <button onClick={() => call(`lp-${l.id}`, `/api/loops/${l.id}`, { method: "PATCH", body: JSON.stringify({ active: !l.active }) })} className="btn-ghost !px-3 !py-2" title={l.active ? "Pausar" : "Reanudar"}>
                      {l.active ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                  )}
                  <button onClick={() => call(`ld-${l.id}`, `/api/loops/${l.id}`, { method: "DELETE" })} className="btn-ghost !px-3 !py-2" title="Borrar">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Corridas */}
      <section className="mt-12">
        <h2 className={label}>Corridas recientes</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-mute">Cuando corras un flujo, aquí ves cada paso avanzando.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {runs.map((r) => (
              <RunCard key={r.id} run={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
