"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Clapperboard, ImageIcon, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import {
  MAX_PROMPT,
  MODELS,
  creditCost,
  validOptions,
  type Aspect,
  type Kind,
  type ModelDef,
  type Resolution,
} from "@/app/lib/catalog";
import GenerationCard from "@/app/components/GenerationCard";
import { useGenerations } from "@/app/components/useGenerations";

const ASPECT_LABEL: Record<Aspect, string> = { "9:16": "Vertical 9:16", "16:9": "Horizontal 16:9", "1:1": "Cuadrado 1:1" };
const MAX_SIDE = 1536;

/** Reduce la foto en el navegador (máx. 1536 px, JPEG) para no subir archivos pesados. */
async function toJpeg(file: File): Promise<{ data: string; mime: string; preview: string }> {
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

export default function Studio({ initialBalance, free }: { initialBalance: number; free: boolean }) {
  const [kind, setKind] = useState<Kind>("video");
  const models = useMemo(() => MODELS.filter((m) => m.kind === kind), [kind]);
  const [modelId, setModelId] = useState(models[0].id);
  const model = MODELS.find((m) => m.id === modelId)!;
  const [opts, setOpts] = useState(defaultsFor(model));
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<{ data: string; mime: string; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { items, balance: polledBalance, setBalance, prepend } = useGenerations("?limit=12");
  const balance = polledBalance ?? initialBalance;

  useEffect(() => {
    setModelId(models[0].id);
  }, [models]);

  useEffect(() => {
    setOpts(defaultsFor(model));
    if (!model.acceptsImage) setImage(null);
  }, [model]);

  const invalid = validOptions(model, opts);
  const cost = free ? 0 : creditCost(model, opts);
  const notEnough = !free && cost > balance;

  function pickDuration(d: number) {
    // Veo solo hace 1080p en clips de 8 s: al bajar la duración se pasa a 720p.
    setOpts((o) => ({
      ...o,
      duration: d,
      resolution: model.provider === "veo" && d !== 8 && o.resolution === "1080p" ? "720p" : o.resolution,
    }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Sube una imagen JPG, PNG o WEBP.");
    try {
      setImage(await toJpeg(f));
      setError(null);
    } catch {
      setError("No se pudo leer la imagen.");
    }
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

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[400px_1fr]">
      {/* Panel de control */}
      <section className="card h-fit space-y-5 p-5 lg:sticky lg:top-24">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-panel-2 p-1">
          {(["video", "image"] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
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
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-mute">Modelo</label>
          <div className="space-y-2">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => setModelId(m.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  m.id === modelId ? "border-brand bg-brand/10" : "border-line hover:border-mute"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{m.name}</span>
                  {m.badge && <span className="text-xs text-brand-2">{m.badge}</span>}
                </div>
                <p className="mt-0.5 text-xs text-mute">{m.tagline}</p>
              </button>
            ))}
          </div>
        </div>

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
          <p className="mt-1 text-xs text-mute">
            {kind === "video"
              ? "Describe la escena, el movimiento de cámara y lo que se escucha. Los diálogos entre comillas."
              : "Describe el sujeto, el fondo, la luz y el estilo."}
          </p>
        </div>

        {model.acceptsImage && (
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-mute">
              {kind === "video" ? "Imagen inicial (opcional)" : "Imagen de referencia (opcional)"}
            </label>
            {image ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.preview} alt="Referencia" className="max-h-40 rounded-xl border border-line" />
                <button
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 rounded-full border border-line bg-panel p-1 text-mute hover:text-ink"
                  aria-label="Quitar imagen"
                >
                  <X size={14} />
                </button>
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
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-mute">Formato</label>
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-mute">Duración</label>
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
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-mute">Resolución</label>
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

        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

        {notEnough ? (
          <Link href="/creditos" className="btn-primary w-full">
            Te faltan {cost - balance} créditos · Recargar
          </Link>
        ) : (
          <button
            onClick={generate}
            disabled={submitting || !!invalid || prompt.trim().length < 3}
            className="btn-primary w-full !py-3"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {submitting ? "Enviando…" : free ? "Generar (admin, gratis)" : `Generar · ${cost} créditos`}
          </button>
        )}
        <p className="text-center text-xs text-mute">Saldo: {balance} créditos. Si la generación falla, se devuelven.</p>
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
              <GenerationCard key={g.id} g={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
