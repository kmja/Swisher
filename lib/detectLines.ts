/**
 * Quick client-side text-line detector for receipt photos. Receipts
 * are essentially black ink on white paper, so finding rows of the
 * image with enough dark pixels is a decent approximation of where
 * each text row sits — and it's fast enough to run while OCR is
 * still grinding in the background.
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
const DARK_THRESHOLD = 115; // luminance below this counts as ink
const MIN_DARK_FRACTION = 0.04; // a row must have ≥ this fraction of dark px to be "text"
const MIN_LINE_HEIGHT = 2; // skip 1-px streaks (often paper noise)
const MAX_LINE_HEIGHT_FRAC = 0.12; // skip very tall dark bands (logos, art)
const MIN_LINE_WIDTH_FRAC = 0.04;

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

  // Per-row aggregate: count of dark pixels + leftmost / rightmost dark x.
  // One pass over the image, O(w·h) — well under a frame at 360 px wide.
  const counts = new Int32Array(h);
  const lefts = new Int32Array(h);
  const rights = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    let left = w;
    let right = -1;
    const rowStart = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = rowStart + x * 4;
      const lum = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      if (lum < DARK_THRESHOLD) {
        count++;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    counts[y] = count;
    lefts[y] = left;
    rights[y] = right;
  }

  const minDarkPerRow = w * MIN_DARK_FRACTION;
  const maxLineHeight = Math.round(h * MAX_LINE_HEIGHT_FRAC);
  const minLineWidth = w * MIN_LINE_WIDTH_FRAC;
  const lines: DetectedLine[] = [];

  let inLine = false;
  let startY = 0;
  let leftMin = w;
  let rightMax = 0;

  const closeLine = (endY: number) => {
    const lineH = endY - startY;
    const lineW = rightMax - leftMin;
    if (lineH >= MIN_LINE_HEIGHT && lineH <= maxLineHeight && lineW >= minLineWidth) {
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
    const isText = counts[y] > minDarkPerRow;
    if (isText) {
      const l = lefts[y];
      const r = rights[y];
      if (!inLine) {
        inLine = true;
        startY = y;
        leftMin = l;
        rightMax = r;
      } else {
        if (l < leftMin) leftMin = l;
        if (r > rightMax) rightMax = r;
      }
    } else if (inLine) {
      closeLine(y);
    }
  }
  if (inLine) closeLine(h);

  return lines;
}
