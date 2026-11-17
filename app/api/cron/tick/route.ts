import { advanceActiveRuns, runDueLoops } from "@/app/lib/flujos";
import { tickBucles } from "@/app/lib/bucles";

export const maxDuration = 300;

// Reloj de Studio. Lo llama la Mac mini cada 2 min (launchd com.dante.truststudio.tick, que primero pregunta a
// Supabase si hay trabajo) y, como red de seguridad con la Mac apagada, el cron de Vercel cada 15 min (vercel.json;
// Vercel manda solo `Authorization: Bearer $CRON_SECRET`). Dispara los loops de IA, avanza los flujos y mueve los
// bucles de herramienta (vueltas vencidas + resultados terminados → entregas). Todo es idempotente: dos relojes
// a la vez no duplican nada (reclamo con FOR UPDATE SKIP LOCKED / claim atómico).
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const loops = await runDueLoops();
  const runs = await advanceActiveRuns(40);
  const bucles = await tickBucles();
  return Response.json({ loops, runs, bucles });
}
