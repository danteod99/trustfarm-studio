// Subtítulos ASS (libass dentro de ffmpeg.wasm). Funciones puras: sin DOM ni ffmpeg,
// así se prueban con node --test y se reusan en Modo Granja (texto del gancho por cuenta).

export interface SubWord { word: string; start: number; end: number }
export interface SubSegment { start: number; end: number; text: string }

/** Ruta donde engine.mountFont() deja la fuente y nombre con que la usa el ASS. */
export const FONTS_DIR = "/customfonts";
export const FONT_NAME = "Anton";

/** Timestamp ASS: H:MM:SS.CC */
export function assTime(t: number): string {
  const cl = Math.max(0, t);
  const h = Math.floor(cl / 3600), m = Math.floor((cl % 3600) / 60), s = Math.floor(cl % 60);
  const cs = Math.floor((cl - Math.floor(cl)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** Quita lo que rompe una línea Dialogue (llaves de override, barras, saltos). */
export function assEscape(s: string): string {
  return s.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\r?\n/g, " ").trim();
}

export interface AssOptions {
  /** Color secundario ASS (&HAABBGGRR). Por defecto celeste. */
  secondary?: string;
  /** Texto fijo arriba (gancho) durante [hookStart, hookEnd). Sin hookEnd = todo el video. */
  hook?: string;
  hookStart?: number;
  hookEnd?: number;
}

function header(W: number, H: number, secondary: string): string {
  const capSize = Math.max(26, Math.round(H * 0.045));
  const capMarginV = Math.round(H * 0.10);
  const outline = Math.max(2, Math.round(H * 0.0035));
  const hookSize = Math.max(28, Math.round(H * 0.05));
  const hookMarginV = Math.round(H * 0.09);
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,${FONT_NAME},${capSize},&H00FFFFFF,${secondary},&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,${outline},2,2,80,80,${capMarginV},1
Style: Hook,${FONT_NAME},${hookSize},&H00FFFFFF,${secondary},&H00000000,&H96000000,0,0,0,0,100,100,1,0,1,${outline + 1},2,8,70,70,${hookMarginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

/** Agrupa palabras en frases cortas estilo TikTok (máx. 4 palabras o ~1,8 s, corta en puntuación). */
export function captionLines(words: SubWord[], segments: SubSegment[] = []): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  if (words.length > 0) {
    let chunk: SubWord[] = [];
    const flush = () => {
      if (!chunk.length) return;
      const st = Math.max(0, chunk[0].start);
      const en = chunk[chunk.length - 1].end;
      const text = assEscape(chunk.map((w) => w.word).join(" ").toUpperCase());
      if (text && en > st) out.push({ start: st, end: en, text });
      chunk = [];
    };
    for (const w of words) {
      chunk.push(w);
      const span = w.end - chunk[0].start;
      if (chunk.length >= 4 || span >= 1.8 || /[.!?…]$/.test(w.word)) flush();
    }
    flush();
  } else {
    for (const s of segments) {
      const text = assEscape(s.text.toUpperCase());
      if (text && s.end > s.start) out.push({ start: s.start, end: s.end, text });
    }
  }
  return out;
}

/**
 * ASS completo para un video de W×H: subtítulos abajo (palabras o segmentos) y, opcional,
 * un gancho fijo arriba. Tiempos absolutos del video.
 */
export function buildAss(W: number, H: number, words: SubWord[] = [], segments: SubSegment[] = [], opts: AssOptions = {}): string {
  const lines: string[] = [];
  const hook = opts.hook ? assEscape(opts.hook) : "";
  if (hook) {
    const st = Math.max(0, opts.hookStart ?? 0);
    const en = opts.hookEnd && opts.hookEnd > st ? opts.hookEnd : 359999;
    lines.push(`Dialogue: 1,${assTime(st)},${assTime(en)},Hook,,0,0,0,,${hook}`);
  }
  for (const l of captionLines(words, segments)) {
    lines.push(`Dialogue: 0,${assTime(l.start)},${assTime(l.end)},Caption,,0,0,0,,${l.text}`);
  }
  return header(W, H, opts.secondary ?? "&H00FFD3E2") + lines.join("\n") + "\n";
}
