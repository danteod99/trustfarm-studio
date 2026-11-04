import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Motor ffmpeg.wasm self-hosted (31 MB): caché larga, CORP y COEP. El script de un
        // Worker creado desde una página con COEP debe traer su propio COEP o el navegador lo
        // bloquea en silencio. Hoy /editar NO lleva COOP/COEP: el core multihilo se cuelga con
        // videos con audio (probado 04-11-2026), así que se usa el de un hilo y no hace falta
        // aislar la página. Si se activa el multihilo (MULTIHILO en app/lib/video/engine.ts),
        // agregar aquí { source: "/editar/:path*" } con COOP same-origin + COEP credentialless.
        source: "/ffmpeg/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
