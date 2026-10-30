// RunPod Serverless: el mismo worker del servidor de casa corriendo en GPUs alquiladas por segundo.
// Solo se le manda el id de la generación; el worker la toma de Supabase, genera y sube el archivo.

const API = "https://api.runpod.ai/v2";

export function runpodConfigured(): boolean {
  return !!process.env.RUNPOD_API_KEY && !!process.env.RUNPOD_ENDPOINT_ID;
}

function headers() {
  return { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json" };
}

export async function submit(genId: string): Promise<string> {
  const r = await fetch(`${API}/${process.env.RUNPOD_ENDPOINT_ID}/run`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ input: { gen_id: genId } }),
  });
  if (!r.ok) throw new Error(`RunPod: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).id as string;
}

/** Estado del trabajo en RunPod. "done" solo dice que terminó: el resultado lo guarda el worker. */
export async function status(id: string): Promise<{ state: "running" | "done" | "failed"; error?: string }> {
  const r = await fetch(`${API}/${process.env.RUNPOD_ENDPOINT_ID}/status/${id}`, { headers: headers() });
  if (!r.ok) throw new Error(`RunPod status: HTTP ${r.status}`);
  const d = await r.json();
  if (["IN_QUEUE", "IN_PROGRESS"].includes(d.status)) return { state: "running" };
  if (d.status === "COMPLETED" && !d.output?.error) return { state: "done" };
  return { state: "failed", error: d.output?.error || d.error || `RunPod: ${d.status}` };
}
