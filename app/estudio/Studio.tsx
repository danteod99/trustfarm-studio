"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, ImageIcon, ImagePlus, Loader2, Palette, Plus, Sparkles, Trash2, UserRound, X } from "lucide-react";
import {
  MAX_PROMPT,
  MODELS,
  creditCost,
  getModel,
  needsLocal,
  validOptions,
  type Aspect,
  type Kind,
  type ModelDef,
  type Resolution,
} from "@/app/lib/catalog";
import { MOTIONS, TEMPLATES, pendingFields, type TemplateGroup, type TemplateStep } from "@/app/lib/templates";
import GenerationCard, { type PublicGeneration } from "@/app/components/GenerationCard";
import { useGenerations } from "@/app/components/useGenerations";

const ASPECT_LABEL: Record<Aspect, string> = { "9:16": "Vertical 9:16", "16:9": "Horizontal 16:9", "1:1": "Cuadrado 1:1" };
const MAX_SIDE = 1536;

type Img = { data: string; mime: string; preview: string };
/** Imagen de la galería usada como primer cuadro del video (no se vuelve a subir). */
type Source = { id: string; preview: string };

interface PresetView {
  id: string;
  kind: "character" | "style";
  name: string;
  description: string;
  imageUrl: string | null;
}

/** Formulario para crear un personaje o estilo (vacío, desde una imagen o desde una plantilla). */
interface Draft {
  kind: "character" | "style";
  name: string;
  description: string;
  fromGeneration?: string;
  preview?: string;
  image?: Img;
}

/** Reduce la foto en el navegador (máx. 1536 px, JPEG) para no subir archivos pesados. */
async function toJpeg(file: File): Promise<Img> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", 0.9);
  return { data: preview.split(",")[1], mime: "image/jpeg", preview };
}

function defaultsFor(m: ModelDef) {
  return {
    aspect: (m.aspects.includes("9:16") ? "9:16" : m.aspects[0]) as Aspect,
    duration: m.durations ? Math.max(...m.durations) : undefined,
    resolution: m.resolutions?.[0] as Resolution | undefined,
  };
}

/** El prompt guardado lleva antepuestos el estilo y el personaje; para reusarlo solo interesa la escena. */
function scenePart(prompt: string): string {
  const i = prompt.lastIndexOf("Escena: ");
  return (i >= 0 ? prompt.slice(i + 8) : prompt).split("\nCámara:")[0].trim();
}

export default function Studio({ initialBalance, free }: { initialBalance: number; free: boolean }) {
  const [modelId, setModelId] = useState(MODELS.find((m) => m.kind === "video")!.id);
  const model = getModel(modelId)!;
  const kind = model.kind;
  const models = useMemo(() => MODELS.filter((m) => m.kind === kind), [kind]);
  const [opts, setOpts] = useState(defaultsFor(model));
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<Img | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [motion, setMotion] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftFileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const [group, setGroup] = useState<TemplateGroup | null>(null);
  const [stepTip, setStepTip] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetView[]>([]);
  const [characterId, setCharacterId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [server, setServer] = useState<{ online: string[]; fal: boolean } | null>(null);

  const { items, balance: polledBalance, setBalance, prepend } = useGenerations("?limit=12");
  const balance = polledBalance ?? initialBalance;
  const characters = presets.filter((p) => p.kind === "character");
  const styles = presets.filter((p) => p.kind === "style");
  const character = characters.find((p) => p.id === characterId);

  function selectModel(id: string, overrides: Partial<ReturnType<typeof defaultsFor>> = {}) {
    const m = getModel(id)!;
    setModelId(id);
    setOpts({ ...defaultsFor(m), ...overrides });
    if (!m.acceptsImage) setImage(null);
    if (m.kind !== "video" || !m.acceptsImage) setSource(null);
  }

  async function loadPresets() {
    const r = await fetch("/api/presets");
    if (r.ok) setPresets((await r.json()).presets);
  }

  // Estado del servidor local (GPU en casa): se revisa cada minuto.
  useEffect(() => {
    const check = () =>
      fetch("/api/servidor")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setServer(d))
        .catch(() => {});
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);
  const offline = (m: ModelDef) => !!server && needsLocal(m, server.fal) && !server.online.includes(m.id);

  // Enlaces desde la galería: /estudio?animar=<id> o ?personaje=<id>.
  useEffect(() => {
    loadPresets();
    const q = new URLSearchParams(window.location.search);
    const id = q.get("animar") || q.get("personaje");
    if (!id) return;
    fetch(`/api/generations/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const g = d?.generation as PublicGeneration | undefined;
        if (!g || g.kind !== "image" || !g.url) return;
        if (q.get("animar")) animate(g);
        else saveCharacter(g);
      });
    window.history.replaceState(null, "", "/estudio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalid = validOptions(model, opts);
  const cost = free ? 0 : creditCost(model, opts);
  const notEnough = !free && cost > balance;
  const pending = pendingFields(prompt);
  const modelOffline = offline(model);

  function pickDuration(d: number) {
    // Veo solo hace 1080p en clips de 8 s: al bajar la duración se pasa a 720p.
    setOpts((o) => ({
      ...o,
      duration: d,
      resolution: model.provider === "veo" && d !== 8 && o.resolution === "1080p" ? "720p" : o.resolution,
    }));
  }

  function applyStep(s: TemplateStep) {
    selectModel(s.model, { aspect: s.aspect, ...(s.duration ? { duration: s.duration } : {}) });
    setPrompt(s.prompt);
    setMotion(s.motion ?? null);
    setStepTip(s.tip ?? null);
    setError(null);
  }

  function animate(g: PublicGeneration) {
    const aspect = g.params.aspect as Aspect;
    const fits = (m: ModelDef) => m.kind === "video" && m.acceptsImage && m.aspects.includes(aspect);
    selectModel(fits(model) ? model.id : MODELS.find(fits)!.id, { aspect });
    setImage(null);
    setSource({ id: g.id, preview: g.url! });
    setMotion((m) => m ?? "acercamiento");
    setPrompt(scenePart(g.prompt));
    panelRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function saveCharacter(g: PublicGeneration) {
    setDraft({ kind: "character", name: "", description: scenePart(g.prompt), fromGeneration: g.id, preview: g.url! });
    panelRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Sube una imagen JPG, PNG o WEBP.");
    try {
      setImage(await toJpeg(f));
      setSource(null);
      setError(null);
    } catch {
      setError("No se pudo leer la imagen.");
    }
  }

  async function onDraftFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !draft) return;
    try {
      const img = await toJpeg(f);
      setDraft({ ...draft, image: img, preview: img.preview, fromGeneration: undefined });
    } catch {
      setError("No se pudo leer la imagen.");
    }
  }

  async function submitDraft() {
    if (!draft) return;
    setSavingDraft(true);
    setError(null);
    const r = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: draft.kind,
        name: draft.name,
        description: draft.description,
        fromGeneration: draft.fromGeneration,
        image: draft.image ? { data: draft.image.data, mime: draft.image.mime } : undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setSavingDraft(false);
    if (!r.ok) return setError(d.error || "No se pudo guardar.");
    setPresets((p) => [d.preset, ...p]);
    if (d.preset.kind === "character") setCharacterId(d.preset.id);
    else setStyleId(d.preset.id);
    setDraft(null);
  }

  async function removePreset(id: string) {
    const r = await fetch(`/api/presets/${id}`, { method: "DELETE" });
    if (!r.ok) return;
    setPresets((p) => p.filter((x) => x.id !== id));
    if (characterId === id) setCharacterId("");
    if (styleId === id) setStyleId("");
  }

  async function generate() {
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model.id,
          prompt,
          ...opts,
          image: image ? { data: image.data, mime: image.mime } : undefined,
          fromGeneration: source?.id,
          characterId: characterId || undefined,
          styleId: styleId || undefined,
          motion: kind === "video" ? motion ?? undefined : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "No se pudo generar.");
      } else {
        prepend(d.generation);
        setBalance(d.balance);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    }
    setSubmitting(false);
  }

  const groupStyleSaved = group?.style && styles.some((s) => s.name === group.style!.name);
  const label = "mb-2 block text-xs font-semibold uppercase tracking-wider text-mute";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[400px_1fr]">
      {/* Panel de control */}
      <section ref={panelRef} className="card h-fit scroll-mt-24 space-y-5 p-5 lg:sticky lg:top-24">
        {/* Formatos */}
        <div>
          <label className={label}>Formatos</label>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.filter((t) => t.featured).map((t) => (
              <button
                key={t.id}
                onClick={() => setGroup(group?.id === t.id ? null : t)}
                className={`rounded-xl border p-2 text-center transition ${
                  group?.id === t.id ? "border-brand bg-brand/10" : "border-line hover:border-mute"
                }`}
              >
                <div className="text-xl">{t.emoji}</div>
                <div className="mt-0.5 text-xs font-semibold leading-tight">{t.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TEMPLATES.filter((t) => !t.featured).map((t) => (
              <button key={t.id} onClick={() => setGroup(group?.id === t.id ? null : t)} className={`chip !text-xs ${group?.id === t.id ? "chip-on" : ""}`}>
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
          {group && (
            <div className="mt-3 space-y-2 rounded-xl bg-panel-2 p-3">
              <p className="text-xs text-mute">{group.pitch}</p>
              {group.steps.map((s) => (
                <button key={s.id} onClick={() => applyStep(s)} className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-sm hover:border-brand">
                  <span>{s.title}</span>
                  <span className="text-xs text-mute">{s.kind === "video" ? "Video" : "Imagen"}</span>
                </button>
              ))}
              {group.style && !groupStyleSaved && (
                <button
                  onClick={() => setDraft({ kind: "style", name: group.style!.name, description: group.style!.description })}
                  className="flex items-center gap-1 text-xs text-brand-2 hover:underline"
                >
                  <Palette size={13} /> Guardar el estilo «{group.style.name}» para todas las escenas
                </button>
              )}
            </div>
          )}
        </div>

        {/* Crear personaje / estilo */}
        {draft && (
          <div className="space-y-3 rounded-xl border border-brand/50 bg-brand/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{draft.kind === "character" ? "Nuevo personaje" : "Nuevo estilo"}</span>
              <button onClick={() => setDraft(null)} aria-label="Cerrar" className="text-mute hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <input
              className="input"
              placeholder={draft.kind === "character" ? "Nombre (ej: Fresita Valentina)" : "Nombre del estilo"}
              maxLength={60}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <textarea
              className="input min-h-24 resize-y"
              maxLength={1200}
              placeholder={
                draft.kind === "character"
                  ? "Aspecto exacto: qué es, rasgos, colores, ropa fija, personalidad."
                  : "Estilo visual: técnica, paleta, luz, ambiente."
              }
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
            {draft.kind === "character" && (
              <div className="flex items-center gap-3">
                {draft.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.preview} alt="" className="h-20 rounded-lg border border-line" />
                )}
                <button onClick={() => draftFileRef.current?.click()} className="btn-ghost !py-1.5 text-xs">
                  <ImagePlus size={14} /> {draft.preview ? "Cambiar foto" : "Foto de referencia (opcional)"}
                </button>
                <input ref={draftFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onDraftFile} />
              </div>
            )}
            <button onClick={submitDraft} disabled={savingDraft || !draft.name.trim() || draft.description.trim().length < 10} className="btn-primary w-full">
              {savingDraft ? <Loader2 size={16} className="animate-spin" /> : null} Guardar
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-panel-2 p-1">
          {(["video", "image"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => k !== kind && selectModel(MODELS.find((m) => m.kind === k)!.id)}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
                kind === k ? "bg-brand text-white" : "text-mute hover:text-ink"
              }`}
            >
              {k === "video" ? <Clapperboard size={15} /> : <ImageIcon size={15} />}
              {k === "video" ? "Video" : "Imagen"}
            </button>
          ))}
        </div>

        <div>
          <label className={label}>Modelo</label>
          <div className="space-y-2">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => m.id !== modelId && selectModel(m.id, m.aspects.includes(opts.aspect) ? { aspect: opts.aspect } : {})}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  m.id === modelId ? "border-brand bg-brand/10" : "border-line hover:border-mute"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{m.name}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {server && m.localCapable && (server.online.includes(m.id) || needsLocal(m, server.fal)) && (
                      <span className={server.online.includes(m.id) ? "text-emerald-400" : "text-mute"}>
                        ● {server.online.includes(m.id) ? "Servidor en línea" : "Servidor apagado"}
                      </span>
                    )}
                    {m.badge && <span className="text-brand-2">{m.badge}</span>}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-mute">{m.tagline}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Personaje y estilo guardados */}
        <div className="grid grid-cols-2 gap-2">
          <PresetSelect
            icon={<UserRound size={13} />}
            title="Personaje"
            items={characters}
            value={characterId}
            onChange={setCharacterId}
            onNew={() => setDraft({ kind: "character", name: "", description: "" })}
            onDelete={removePreset}
          />
          <PresetSelect
            icon={<Palette size={13} />}
            title="Estilo"
            items={styles}
            value={styleId}
            onChange={setStyleId}
            onNew={() => setDraft({ kind: "style", name: "", description: "" })}
            onDelete={removePreset}
          />
        </div>
        {character && kind === "video" && !source && (
          <p className="-mt-3 text-xs text-mute">
            En video el personaje va solo por descripción. Para que salga idéntico, genera primero la imagen y toca «Animar».
          </p>
        )}

        <div>
          <label className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-wider text-mute">
            Descripción <span className="font-normal normal-case">{prompt.length}/{MAX_PROMPT}</span>
          </label>
          <textarea
            className="input min-h-32 resize-y"
            maxLength={MAX_PROMPT}
            placeholder={
              kind === "video"
                ? "Ej: Una mujer joven en una cafetería de Lima toma un sorbo de café y dice a cámara: «Este es mi lugar favorito». Luz cálida de mañana, cámara lenta."
                : "Ej: Foto de producto de un frasco de sérum ámbar sobre mármol blanco, luz suave lateral, estilo editorial."
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {pending.length > 0 ? (
            <p className="mt-1 text-xs text-amber-300">Completa lo que está entre corchetes: {pending.slice(0, 3).map((p) => `[${p}]`).join(", ")}{pending.length > 3 ? "…" : ""}</p>
          ) : (
            <p className="mt-1 text-xs text-mute">
              {stepTip ??
                (kind === "video"
                  ? "Describe la escena, el movimiento de cámara y lo que se escucha. Los diálogos entre comillas."
                  : "Describe el sujeto, el fondo, la luz y el estilo.")}
            </p>
          )}
        </div>

        {kind === "video" && (
          <div>
            <label className={label}>Movimiento de cámara</label>
            <div className="flex flex-wrap gap-2">
              {MOTIONS.map((m) => (
                <button key={m.id} onClick={() => setMotion(motion === m.id ? null : m.id)} className={`chip ${motion === m.id ? "chip-on" : ""}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {model.acceptsImage && (
          <div>
            <label className={label}>{kind === "video" ? "Imagen inicial (opcional)" : "Imagen de referencia (opcional)"}</label>
            {image || source ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image?.preview ?? source!.preview} alt="Referencia" className="max-h-40 rounded-xl border border-line" />
                <button
                  onClick={() => {
                    setImage(null);
                    setSource(null);
                  }}
                  className="absolute -right-2 -top-2 rounded-full border border-line bg-panel p-1 text-mute hover:text-ink"
                  aria-label="Quitar imagen"
                >
                  <X size={14} />
                </button>
                {source && <p className="mt-1 text-xs text-mute">De tu galería</p>}
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="btn-ghost w-full border-dashed">
                <ImagePlus size={16} /> Subir imagen
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={label}>Formato</label>
            <div className="flex flex-wrap gap-2">
              {model.aspects.map((a) => (
                <button key={a} onClick={() => setOpts((o) => ({ ...o, aspect: a }))} className={`chip ${opts.aspect === a ? "chip-on" : ""}`}>
                  {ASPECT_LABEL[a]}
                </button>
              ))}
            </div>
          </div>
          {model.durations && model.durations.length > 1 && (
            <div>
              <label className={label}>Duración</label>
              <div className="flex gap-2">
                {model.durations.map((d) => (
                  <button key={d} onClick={() => pickDuration(d)} className={`chip ${opts.duration === d ? "chip-on" : ""}`}>
                    {d} s
                  </button>
                ))}
              </div>
            </div>
          )}
          {model.resolutions && (
            <div>
              <label className={label}>Resolución</label>
              <div className="flex gap-2">
                {model.resolutions.map((r) => {
                  const disabled = model.provider === "veo" && r === "1080p" && opts.duration !== 8;
                  return (
                    <button
                      key={r}
                      disabled={disabled}
                      title={disabled ? "1080p solo en clips de 8 s" : undefined}
                      onClick={() => setOpts((o) => ({ ...o, resolution: r }))}
                      className={`chip disabled:opacity-40 ${opts.resolution === r ? "chip-on" : ""}`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {modelOffline && (
          <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200">
            {model.name} corre en nuestro servidor y ahora está apagado. Elige otro modelo o intenta más tarde.
          </p>
        )}
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        {notEnough ? (
          <Link href="/creditos" className="btn-primary w-full">
            Te faltan {cost - balance} créditos · Recargar
          </Link>
        ) : (
          <button
            onClick={generate}
            disabled={submitting || !!invalid || prompt.trim().length < 3 || pending.length > 0 || modelOffline}
            className="btn-primary w-full !py-3"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {submitting ? "Enviando…" : free ? "Generar (admin, gratis)" : `Generar · ${cost} créditos`}
          </button>
        )}
        <p className="text-center text-xs text-mute">
          Saldo: {balance} créditos. Si la generación falla, se devuelven. Al publicar, marca el video como hecho con IA.
        </p>
      </section>

      {/* Resultados */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recientes</h2>
          <Link href="/galeria" className="text-sm text-brand-2 hover:underline">
            Ver galería
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="card flex flex-col items-center justify-center gap-2 p-16 text-center text-mute">
            <Sparkles className="text-brand-2" />
            <p>Tus creaciones aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((g) => (
              <GenerationCard key={g.id} g={g} onAnimate={animate} onSaveCharacter={saveCharacter} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PresetSelect(props: {
  icon: React.ReactNode;
  title: string;
  items: PresetView[];
  value: string;
  onChange: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  const selected = props.items.find((p) => p.id === props.value);
  return (
    <div>
      <label className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-mute">
        {props.icon} {props.title}
      </label>
      <div className="flex gap-1">
        <select className="input !py-1.5 text-sm" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
          <option value="">Ninguno</option>
          {props.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={props.onNew} className="btn-ghost !px-2 !py-1.5" aria-label={`Nuevo ${props.title.toLowerCase()}`} title="Nuevo">
          <Plus size={14} />
        </button>
      </div>
      {selected && (
        <div className="mt-1.5 flex items-center gap-2">
          {selected.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.imageUrl} alt="" className="h-9 w-9 rounded-md border border-line object-cover" />
          )}
          <p className="line-clamp-2 flex-1 text-[11px] text-mute">{selected.description}</p>
          <button onClick={() => props.onDelete(selected.id)} className="text-mute hover:text-red-300" aria-label="Borrar" title="Borrar">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
