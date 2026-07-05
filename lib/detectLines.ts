/**
 * Quick client-side text-line detector for receipt photos.
 *
 * Two stages, both cheap at a 360-px sample:
 *   1. Find the PAPER: receipts are the big bright blob in the frame.
 *      Threshold on brightness (adaptive, from the luminance histogram),
 *      take the largest connected bright component, and record its
 *      per-row horizontal extent. This is what makes detection work on
 *      restaurant photos where the receipt covers a third of a dark
 *      table — counting dark pixels frame-wide drowns in the background.
 *   2. Find the INK: within the paper's per-row extent, rows with enough
 *      dark pixels are text rows. The dark threshold adapts to how
 *      brightly the paper is actually lit.
 *
 * Returned rectangles are in percentages of the source image so the
 * caller can position them with `top: ${y}%; left: ${x}%; …`.
 */

export type DetectedLine = {
  /** Y of the line's top edge, as a percentage of the image height. */
  y: number;
  /** X of the line's left edge, as a percentage of the image width. */
  x: number;
  /** Width of the line, as a percentage of the image width. */
  w: number;
  /** Height of the line, as a percentage of the image height. */
  h: number;
};

const SAMPLE_LONG_EDGE = 360;
const MIN_LINE_HEIGHT = 2; // sample px; skip 1-px streaks (paper noise)
const MAX_LINE_HEIGHT_FRAC = 0.12; // of the paper's height; skip logos/art
const MIN_DARK_FRACTION = 0.05; // of the row's paper extent
const MIN_LINE_WIDTH_FRAC = 0.15; // of the row's paper extent
const MIN_COMPONENT_FRAC = 0.02; // bright blob must cover ≥2% of the frame

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = dataUrl;
  });
}

export async function detectTextLines(dataUrl: string): Promise<DetectedLine[]> {
  if (typeof window === "undefined") return [];
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return [];
  }
  const aspect = img.width / Math.max(1, img.height);
  const w = aspect >= 1 ? SAMPLE_LONG_EDGE : Math.max(1, Math.round(SAMPLE_LONG_EDGE * aspect));
  const h = aspect >= 1 ? Math.max(1, Math.round(SAMPLE_LONG_EDGE / aspect)) : SAMPLE_LONG_EDGE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch {
    return [];
  }
  const data = imgData.data;
  const n = w * h;

  // Luminance plane + histogram, one pass.
  const lum = new Uint8Array(n);
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const v = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000;
    const b = v | 0;
    lum[i] = b;
    hist[b]++;
  }

  // ── Stage 1: the paper ──────────────────────────────────────────────
  // Bright threshold from the histogram's upper tail: the paper is the
  // brightest sizeable thing, so anchor just below its 88th percentile.
  let acc = 0;
  let p88 = 255;
  const target = n * 0.88;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) {
      p88 = v;
      break;
    }
  }
  const brightTh = Math.max(110, Math.min(200, p88 - 25));

  // Largest 4-connected bright component via an explicit stack flood
  // fill — labels: 0 unvisited, 1 visited-not-paper, 2 the winner.
  const label = new Uint8Array(n);
  const stack = new Int32Array(n);
  let bestCount = 0;
  let bestSeed = -1;
  for (let i = 0; i < n; i++) {
    if (label[i] !== 0 || lum[i] < brightTh) continue;
    let top = 0;
    stack[top++] = i;
    label[i] = 1;
    let count = 0;
    while (top > 0) {
      const p = stack[--top];
      count++;
      const px = p % w;
      const py = (p / w) | 0;
      if (px > 0 && label[p - 1] === 0 && lum[p - 1] >= brightTh) { label[p - 1] = 1; stack[top++] = p - 1; }
      if (px < w - 1 && label[p + 1] === 0 && lum[p + 1] >= brightTh) { label[p + 1] = 1; stack[top++] = p + 1; }
      if (py > 0 && label[p - w] === 0 && lum[p - w] >= brightTh) { label[p - w] = 1; stack[top++] = p - w; }
      if (py < h - 1 && label[p + w] === 0 && lum[p + w] >= brightTh) { label[p + w] = 1; stack[top++] = p + w; }
    }
    if (count > bestCount) {
      bestCount = count;
      bestSeed = i;
    }
  }
  if (bestSeed < 0 || bestCount < n * MIN_COMPONENT_FRAC) return [];

  // Re-flood the winner to mark it (label 2) and collect per-row extents
  // + its mean brightness (for the adaptive ink threshold). Per-row
  // extents rather than a bounding box so a tilted receipt doesn't drag
  // dark table corners into the ink counts.
  const rowLeft = new Int32Array(h).fill(w);
  const rowRight = new Int32Array(h).fill(-1);
  let paperLumSum = 0;
  {
    let top = 0;
    stack[top++] = bestSeed;
    label[bestSeed] = 2;
    while (top > 0) {
      const p = stack[--top];
      const px = p % w;
      const py = (p / w) | 0;
      paperLumSum += lum[p];
      if (px < rowLeft[py]) rowLeft[py] = px;
      if (px > rowRight[py]) rowRight[py] = px;
      if (px > 0 && label[p - 1] === 1 && lum[p - 1] >= brightTh) { label[p - 1] = 2; stack[top++] = p - 1; }
      if (px < w - 1 && label[p + 1] === 1 && lum[p + 1] >= brightTh) { label[p + 1] = 2; stack[top++] = p + 1; }
      if (py > 0 && label[p - w] === 1 && lum[p - w] >= brightTh) { label[p - w] = 2; stack[top++] = p - w; }
      if (py < h - 1 && label[p + w] === 1 && lum[p + w] >= brightTh) { label[p + w] = 2; stack[top++] = p + w; }
    }
  }
  const paperMean = paperLumSum / bestCount;
  // Ink is well below the paper's own brightness — a dim shot lowers
  // both, so the threshold follows the paper instead of a fixed 115.
  const darkTh = Math.max(70, Math.min(140, paperMean - 70));

  // ── Stage 2: ink rows within the paper ─────────────────────────────
  const paperTop = rowRight.findIndex((r) => r >= 0);
  let paperBottom = h - 1;
  while (paperBottom > 0 && rowRight[paperBottom] < 0) paperBottom--;
  const maxLineHeight = Math.max(MIN_LINE_HEIGHT + 1, Math.round((paperBottom - paperTop) * MAX_LINE_HEIGHT_FRAC));

  const counts = new Int32Array(h);
  const lefts = new Int32Array(h).fill(w);
  const rights = new Int32Array(h).fill(-1);
  const extents = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    const l = rowLeft[y];
    const r = rowRight[y];
    if (r < 0 || r - l < 8) continue;
    extents[y] = r - l;
    let count = 0;
    const rowStart = y * w;
    // Inset by a couple of px so the paper's own shadowed edge doesn't
    // register as ink.
    for (let x = l + 2; x <= r - 2; x++) {
      if (lum[rowStart + x] < darkTh) {
        count++;
        if (x < lefts[y]) lefts[y] = x;
        if (x > rights[y]) rights[y] = x;
      }
    }
    counts[y] = count;
  }

  const lines: DetectedLine[] = [];
  let inLine = false;
  let startY = 0;
  let leftMin = w;
  let rightMax = 0;

  const closeLine = (endY: number) => {
    const lineH = endY - startY;
    const lineW = rightMax - leftMin;
    const midExtent = extents[Math.min(h - 1, startY + (lineH >> 1))] || 1;
    if (lineH >= MIN_LINE_HEIGHT && lineH <= maxLineHeight && lineW >= midExtent * MIN_LINE_WIDTH_FRAC) {
      lines.push({
        y: (startY / h) * 100,
        x: (leftMin / w) * 100,
        w: (lineW / w) * 100,
        h: (lineH / h) * 100,
      });
    }
    inLine = false;
  };

  for (let y = 0; y < h; y++) {
    const isText = extents[y] > 0 && counts[y] >= extents[y] * MIN_DARK_FRACTION;
    if (isText) {
      if (!inLine) {
        inLine = true;
        startY = y;
        leftMin = lefts[y];
        rightMax = rights[y];
      } else {
        if (lefts[y] < leftMin) leftMin = lefts[y];
        if (rights[y] > rightMax) rightMax = rights[y];
      }
    } else if (inLine) {
      closeLine(y);
    }
  }
  if (inLine) closeLine(h);

  return lines;
}
