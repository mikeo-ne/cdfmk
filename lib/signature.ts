import type { SignatureStroke } from "./types";

/** Virtual coordinate space used by both the canvas and serialized SVGs. */
export const SIG_WIDTH = 600;
export const SIG_HEIGHT = 220;

/** Build a smooth SVG path (quadratic curves through midpoints) from a stroke. */
function strokeToPath(stroke: SignatureStroke): string {
  const pts = stroke.points;
  if (pts.length === 0) return "";
  if (pts.length === 1) {
    const p = pts[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.1).toFixed(1)} ${p.y.toFixed(1)}`;
  }
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

interface SvgOptions {
  inkColor?: string;
  background?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  idPrefix?: string;
}

/** Serialize drawn strokes into a standalone SVG document string. */
export function strokesToSvg(strokes: SignatureStroke[], opts: SvgOptions = {}): string {
  const {
    inkColor = "#111827",
    background = "transparent",
    width = SIG_WIDTH,
    height = SIG_HEIGHT,
    strokeWidth = 2.4,
    idPrefix = "sig",
  } = opts;
  const paths = strokes
    .map((s, i) => {
      const d = strokeToPath(s);
      return d
        ? `<path id="${idPrefix}-${i}" d="${d}" fill="none" stroke="${inkColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
        : "";
    })
    .join("");
  const bg = background === "transparent" ? "" : `<rect width="${width}" height="${height}" fill="${background}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg}${paths}</svg>`;
}

/** A formal cursive "typed" signature rendered as SVG text. */
export function typedSignatureSvg(name: string): string {
  const safe = name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIG_WIDTH} ${SIG_HEIGHT}" width="${SIG_WIDTH}" height="${SIG_HEIGHT}">
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="'Dancing Script', 'Brush Script MT', cursive" font-weight="700"
        font-size="${name.length > 22 ? 34 : name.length > 15 ? 42 : 52}"
        fill="#111827" font-style="italic">${safe}</text>
  <line x1="90" y1="${SIG_HEIGHT - 46}" x2="${SIG_WIDTH - 90}" y2="${SIG_HEIGHT - 46}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="6 5"/>
</svg>`;
}

/** Convert an SVG string into a data URL safe for <img src>. */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random generator (for seeded mock signatures)   */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a believable mock handwritten signature for seed records.
 * Creates a rough baseline scribble with an underline flourish.
 */
export function mockStrokesForName(name: string, seed: number): SignatureStroke[] {
  const rand = mulberry32(seed);
  const strokes: SignatureStroke[] = [];
  const parts = name.trim().split(/\s+/);
  const wordCount = Math.min(parts.length, 3);
  const startX = 70;
  const gap = (SIG_WIDTH - 140) / wordCount;
  const baseY = SIG_HEIGHT * 0.55;

  for (let w = 0; w < wordCount; w++) {
    const wordLen = Math.max(3, parts[w]?.length ?? 5);
    const points: { x: number; y: number }[] = [];
    const steps = 18 + Math.floor(rand() * 10);
    const x0 = startX + w * gap + gap * 0.12;
    const wWidth = gap * 0.72;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + t * wWidth;
      // cursive wave: two humps per letter
      const wave = Math.sin(t * Math.PI * (wordLen * 0.9)) * 22;
      const jitter = (rand() - 0.5) * 7;
      const y = baseY + wave * (0.55 + rand() * 0.25) + jitter - 8;
      points.push({ x, y });
    }
    strokes.push({ points });
  }

  // underline flourish
  const underline: { x: number; y: number }[] = [];
  const uSteps = 26;
  for (let i = 0; i <= uSteps; i++) {
    const t = i / uSteps;
    underline.push({
      x: 60 + t * (SIG_WIDTH - 120),
      y: baseY + 46 + Math.sin(t * Math.PI * 2) * 5 + (rand() - 0.5) * 3,
    });
  }
  strokes.push({ points: underline });

  return strokes;
}
