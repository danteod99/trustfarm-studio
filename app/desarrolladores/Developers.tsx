"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { SITE_URL } from "@/app/lib/brand";

interface Key { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }

const BASE = `${SITE_URL}/api/v1`;

const EXAMPLES: { title: string; code: string }[] = [
  {
    title: "1. Crear un video con voz",
    code: `curl -X POST ${BASE}/generations \\
  -H "Authorization: Bearer $TRUST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "cine-voz",
    "prompt": "Una joven en una cafetería de Lima dice: «Hoy les traigo el mejor café»",
    "aspect": "9:16",
    "duration": 5,
    "resolution": "720p"
  }'`,
  },
  {
    title: "2. Consultar hasta que esté listo",
    code: `curl ${BASE}/generations/GENERATION_ID \\
  -H "Authorization: Bearer $TRUST_API_KEY"

# status: "running" → vuelve a consultar en ~10 s
# status: "done"    → "url" trae el archivo (enlace válido 1 hora)
# status: "failed"  → "error" explica qué pasó; los créditos se devuelven solos`,
  },
  {
    title: "3. Animar una imagen que ya generaste",
    code: `curl -X POST ${BASE}/generations \\
  -H "Authorization: Bearer $TRUST_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "model": "cine-voz", "from_generation": "ID_DE_LA_IMAGEN", "prompt": "La cámara se acerca lento", "aspect": "9:16", "duration": 5, "resolution": "720p" }'`,
  },
  {
    title: "4. JavaScript (Node 18+)",
    code: `const H = { Authorization: \`Bearer \${process.env.TRUST_API_KEY}\`, "Content-Type": "application/json" };
let { generation } = await (await fetch("${BASE}/generations", {
  method: "POST", headers: H,
  body: JSON.stringify({ model: "foto-flash", prompt: "Foto de producto de un perfume negro", aspect: "9:16" }),
})).json();
while (generation.status === "running") {
  await new Promise((r) => setTimeout(r, 10_000));
  ({ generation } = await (await fetch(\`${BASE}/generations/\${generation.id}\`, { headers: H })).json());
}
console.log(generation.status, generation.url);`,
  },
  {
    title: "5. Correr uno de tus flujos",
    code: `curl -X POST ${BASE}/flows/FLOW_ID/run -H "Authorization: Bearer $TRUST_API_KEY"
curl ${BASE}/runs/RUN_ID -H "Authorization: Bearer $TRUST_API_KEY"   # avance y resultado de cada paso`,
  },
];

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/models", "Modelos, opciones y costo en créditos (no pide clave)"],
  ["GET", "/balance", "Créditos disponibles"],
  ["POST", "/generations", "Crea una imagen o un video"],
  ["GET", "/generations/{id}", "Estado y enlace del archivo"],
  ["GET", "/flows", "Tus flujos guardados"],
  ["POST", "/flows/{id}/run", "Corre un flujo"],
  ["GET", "/runs/{id}", "Avance de una corrida"],
];

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="text-mute hover:text-ink"
      aria-label="Copiar"
    >
      {ok ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
    </button>
  );
}

export default function Developers() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [logged, setLogged] = useState(true);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/keys");
    if (r.status === 401) return setLogged(false);
    if (r.ok) setKeys((await r.json()).keys);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "No se pudo crear la clave.");
    setFresh(d.key);
    setName("");
    load();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="eyebrow">Desarrolladores</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">API de generación</h1>
      <p className="mt-2 max-w-2xl text-mute">
        Genera imágenes y videos desde tu código, n8n, Make o Zapier. Cada llamada descuenta créditos de tu cuenta, igual que en
        el estudio, y si algo falla se devuelven solos.
      </p>

      {/* Claves */}
      <section className="card mt-8 border-brand/30 p-6 shadow-[0_0_60px_-18px_rgba(255,255,255,0.4)]">
        <h2 className="flex items-center gap-2 font-semibold">
          <KeyRound size={17} className="text-brand-2" /> Tus claves
        </h2>
        {!logged ? (
          <p className="mt-3 text-sm text-mute">
            <Link href="/entrar?next=/desarrolladores" className="text-brand-2 hover:underline">
              Entra a tu cuenta
            </Link>{" "}
            para crear una clave.
          </p>
        ) : (
          <>
            {fresh && (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
                <p className="font-semibold text-emerald-300">Copia tu clave ahora: no se vuelve a mostrar.</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 font-mono text-xs">
                  <span className="flex-1 break-all">{fresh}</span>
                  <CopyBtn text={fresh} />
                </div>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <input className="input max-w-xs" placeholder="Nombre (ej: n8n, mi app)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <button onClick={create} disabled={busy} className="btn-primary">
                {busy && <Loader2 size={15} className="animate-spin" />} Crear clave
              </button>
            </div>
            {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
            <div className="mt-4 divide-y divide-line">
              {keys?.length === 0 && <p className="py-3 text-sm text-mute">Aún no tienes claves.</p>}
              {keys?.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-mute">
                      {k.prefix}… · creada {new Date(k.created_at).toLocaleDateString("es")}
                      {k.last_used_at ? ` · último uso ${new Date(k.last_used_at).toLocaleString("es")}` : " · sin usar"}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      await fetch(`/api/keys/${k.id}`, { method: "DELETE" });
                      load();
                    }}
                    className="btn-ghost !px-3 !py-2"
                    title="Revocar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Referencia */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">Referencia</h2>
        <p className="mt-1 text-sm text-mute">
          Base: <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">{BASE}</code> · Autenticación:{" "}
          <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer tsk_…</code> · Máximo 3 generaciones en
          curso por cuenta.
        </p>
        <div className="card mt-4 divide-y divide-line">
          {ENDPOINTS.map(([m, p, d]) => (
            <div key={p + m} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className={`w-14 rounded px-2 py-0.5 text-center font-mono text-xs font-bold ${m === "GET" ? "bg-emerald-500/15 text-emerald-300" : "bg-brand/20 text-brand-2"}`}>{m}</span>
              <code className="font-mono text-xs">{p}</code>
              <span className="text-mute">{d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-mute">
          Campos de <code className="font-mono text-xs">POST /generations</code>: <code className="font-mono text-xs">model</code>,{" "}
          <code className="font-mono text-xs">prompt</code>, <code className="font-mono text-xs">aspect</code> (9:16, 16:9, 1:1), y para video{" "}
          <code className="font-mono text-xs">duration</code> y <code className="font-mono text-xs">resolution</code>. Opcionales:{" "}
          <code className="font-mono text-xs">motion</code>, <code className="font-mono text-xs">from_generation</code>,{" "}
          <code className="font-mono text-xs">image</code> ({"{ data: base64, mime }"}), <code className="font-mono text-xs">character_id</code>,{" "}
          <code className="font-mono text-xs">style_id</code>. Errores: <code className="font-mono text-xs">{"{ error: { code, message } }"}</code> con
          401, 402 (sin créditos), 429 (demasiadas en curso) o 503 (modelo no disponible).
        </p>
      </section>

      <section className="mt-8 space-y-4">
        {EXAMPLES.map((e) => (
          <div key={e.title} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2 text-sm">
              <span className="font-medium">{e.title}</span>
              <CopyBtn text={e.code} />
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-mute">{e.code}</pre>
          </div>
        ))}
      </section>
    </div>
  );
}
