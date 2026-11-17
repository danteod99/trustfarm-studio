// YouTube sin API key: clasifica el link (video, canal, lista) y lee el feed RSS público del canal.
// Funciones puras (el fetch vive en bucles.ts) para poder probarlas.

export type FuenteYouTube =
  | { kind: "video"; videoId: string }
  | { kind: "channel"; channelId: string }
  | { kind: "handle"; url: string } // @handle, /c/nombre o /user/nombre: hay que leer la página para sacar el id del canal
  | { kind: "playlist"; playlistId: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

/** Clasifica un link de YouTube. null si no es de YouTube o no se entiende. */
export function clasificarYouTube(raw: string): FuenteYouTube | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.split("/")[1] ?? "";
    return VIDEO_ID.test(id) ? { kind: "video", videoId: id } : null;
  }
  if (host !== "youtube.com") return null;
  const parts = u.pathname.split("/").filter(Boolean);
  const v = u.searchParams.get("v");
  if (u.pathname === "/watch" && v && VIDEO_ID.test(v)) return { kind: "video", videoId: v };
  if (["shorts", "live", "embed"].includes(parts[0]) && VIDEO_ID.test(parts[1] ?? "")) return { kind: "video", videoId: parts[1] };
  if (parts[0] === "playlist") {
    const l = u.searchParams.get("list") ?? "";
    return /^[A-Za-z0-9_-]{10,60}$/.test(l) ? { kind: "playlist", playlistId: l } : null;
  }
  if (parts[0] === "channel" && CHANNEL_ID.test(parts[1] ?? "")) return { kind: "channel", channelId: parts[1] };
  if (parts[0]?.startsWith("@") && /^@[\p{L}\p{N}._-]{1,60}$/u.test(parts[0])) {
    return { kind: "handle", url: `https://www.youtube.com/${parts[0]}` };
  }
  if ((parts[0] === "c" || parts[0] === "user") && /^[\p{L}\p{N}._-]{1,60}$/u.test(parts[1] ?? "")) {
    return { kind: "handle", url: `https://www.youtube.com/${parts[0]}/${parts[1]}` };
  }
  return null;
}

/** Saca el id UC… del canal del HTML de su página (varios lugares, por si YouTube cambia uno). */
export function channelIdDeHtml(html: string): string | null {
  const m =
    /"externalId":"(UC[A-Za-z0-9_-]{22})"/.exec(html) ||
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/.exec(html) ||
    /channel_id=(UC[A-Za-z0-9_-]{22})/.exec(html);
  return m ? m[1] : null;
}

export function urlFeed(f: { channelId: string } | { playlistId: string }): string {
  return "channelId" in f
    ? `https://www.youtube.com/feeds/videos.xml?channel_id=${f.channelId}`
    : `https://www.youtube.com/feeds/videos.xml?playlist_id=${f.playlistId}`;
}

export interface VideoFeed { id: string; title: string; published: string }

const desescapar = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");

/** Videos del feed RSS, del más nuevo al más viejo (el feed ya viene así; se reordena por fecha por si acaso). */
export function parseFeed(xml: string): VideoFeed[] {
  const out: VideoFeed[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = /<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/.exec(e)?.[1];
    if (!id) continue;
    out.push({
      id,
      title: desescapar(/<title>([\s\S]*?)<\/title>/.exec(e)?.[1] ?? "").trim(),
      published: /<published>([^<]+)<\/published>/.exec(e)?.[1] ?? "",
    });
  }
  return out.sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));
}

export const urlVideo = (id: string) => `https://www.youtube.com/watch?v=${id}`;
