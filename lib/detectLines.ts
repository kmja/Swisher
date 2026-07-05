/**
 * Locate the receipt in a photo and lay out scan bars across it.
 *
 * We deliberately do NOT try to detect individual text rows by pixel
 * darkness — across real photos (crisp white receipts, dim shots, photos
 * of a screen, curled paper with shadows) no single ink threshold holds,
 * and a wrong one yields either zero markers or one giant blob. What IS
 * reliable is finding the PAPER: it's the largest bright blob in the
 * frame. So we find the paper, trace its width at each height (so the
 * bars follow a tilted or curved receipt), and spread evenly-spaced bars
 * down its text area. The bars read as a scanner sweeping the receipt
 * line by line and always land on the actual paper.
 *
 * Rectangles are in percentages of the source image so the caller can
 * position them within the displayed image rect.
 */

export type DetectedLine = {
  /** Y of the bar's centre-ish top, as a percentage of image height. */
  y: number;
  /** X of the bar's left edge, as a percentage of image width. */
  x: number;
  /** Width of the bar, as a percentage of image width. */
  w: number;
  /** Height of the bar, as a percentage of image height. */
  h: number;
};

const SAMPLE_LONG_EDGE = 360;
const MIN_COMPONENT_FRAC = 0.02; // paper blob must cover ≥2% of the frame
const BAR_COUNT = 18; // scan bars spread down the receipt
const EDGE_MARGIN = 0.08; // skip the top/bottom 8% of the paper (blank margins)
const SIDE_INSET = 0.06; // pull bars in from the paper edges a touch

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

  // Bright threshold from the histogram's upper tail — the paper is the
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

  // Largest 4-connected bright component via an explicit stack flood fill.
  const label = new Uint8Array(n); // 0 unvisited, 1 visited, 2 the winner
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

  // Re-flood the winner and record its width at every row. Per-row extents
  // (not a bounding box) so a tilted receipt's bars slant with the paper
  // instead of overhanging the dark background.
  const rowLeft = new Int32Array(h).fill(w);
  const rowRight = new Int32Array(h).fill(-1);
  {
    let top = 0;
    stack[top++] = bestSeed;
    label[bestSeed] = 2;
    while (top > 0) {
      const p = stack[--top];
      const px = p % w;
      const py = (p / w) | 0;
      if (px < rowLeft[py]) rowLeft[py] = px;
      if (px > rowRight[py]) rowRight[py] = px;
      if (px > 0 && label[p - 1] === 1 && lum[p - 1] >= brightTh) { label[p - 1] = 2; stack[top++] = p - 1; }
      if (px < w - 1 && label[p + 1] === 1 && lum[p + 1] >= brightTh) { label[p + 1] = 2; stack[top++] = p + 1; }
      if (py > 0 && label[p - w] === 1 && lum[p - w] >= brightTh) { label[p - w] = 2; stack[top++] = p - w; }
      if (py < h - 1 && label[p + w] === 1 && lum[p + w] >= brightTh) { label[p + w] = 2; stack[top++] = p + w; }
    }
  }

  let paperTop = rowRight.findIndex((r) => r >= 0);
  let paperBottom = h - 1;
  while (paperBottom > 0 && rowRight[paperBottom] < 0) paperBottom--;
  if (paperTop < 0 || paperBottom <= paperTop) return [];
  const paperH = paperBottom - paperTop;

  // Widest row ≈ how wide the receipt really is; skip rows narrower than
  // half of it (a curled corner tapering to a point) when placing bars.
  let maxWidth = 0;
  for (let y = paperTop; y <= paperBottom; y++) {
    const rw = rowRight[y] - rowLeft[y];
    if (rw > maxWidth) maxWidth = rw;
  }

  const barH = Math.max(0.8, (paperH / h) * 100 / BAR_COUNT * 0.5);
  const lines: DetectedLine[] = [];
  for (let k = 0; k < BAR_COUNT; k++) {
    const frac = EDGE_MARGIN + (k / (BAR_COUNT - 1)) * (1 - 2 * EDGE_MARGIN);
    let yPx = Math.round(paperTop + frac * paperH);
    // Nudge to the nearest row that actually has decent paper width.
    let l = rowLeft[yPx];
    let r = rowRight[yPx];
    if (r - l < maxWidth * 0.5) {
      for (let d = 1; d <= 4; d++) {
        for (const yy of [yPx - d, yPx + d]) {
          if (yy < paperTop || yy > paperBottom) continue;
          if (rowRight[yy] - rowLeft[yy] >= maxWidth * 0.5) { yPx = yy; l = rowLeft[yy]; r = rowRight[yy]; break; }
        }
        if (r - l >= maxWidth * 0.5) break;
      }
    }
    if (r <= l) continue;
    const inset = (r - l) * SIDE_INSET;
    lines.push({
      y: (yPx / h) * 100,
      x: ((l + inset) / w) * 100,
      w: ((r - l - 2 * inset) / w) * 100,
      h: barH,
    });
  }
  return lines;
}
