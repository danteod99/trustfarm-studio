import { advanceActiveRuns, runDueLoops } from "@/app/lib/flujos";

export const maxDuration = 300;

// Lo llama la Mac mini cada 2 min (launchd com.dante.truststudio.tick): dispara los loops que tocan
// y avanza las corridas de flujos. Vercel Hobby solo permite crons diarios.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const loops = await runDueLoops();
  const runs = await advanceActiveRuns(40);
  return Response.json({ loops, runs });
}
