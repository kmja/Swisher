/**
 * Build a "scanner" overlay for a receipt photo: the paper outlined, and
 * its ink (the actual printed text) highlighted.
 *
 * Why this works where per-row text detection didn't: we first find the
 * PAPER (the largest bright blob — reliable across crisp receipts, dim
 * shots, curled paper, even photos of a screen), then highlight ink using
 * a LOCAL adaptive threshold — each pixel compared to the mean of its own
 * neighbourhood (Bradley's method, via an integral image). A local
 * threshold tracks uneven lighting and low contrast that no single global
 * cut-off can, and because we only paint pixels (not detect rows) an
 * imperfect edge still just looks like softly highlighted text.
 *
 * Returns a PNG data URL sized to the sampled image (full frame, non-paper
 * areas transparent) so the caller can stretch it over the displayed image
 * rect and it lines up 1:1.
 */

const SAMPLE_LONG_EDGE = 500;
const MIN_COMPONENT_FRAC = 0.02; // paper blob must cover ≥2% of the frame
const ADAPT_RADIUS_FRAC = 0.02; // local-mean window radius, of the long edge
const ADAPT_T = 0.14; // ink if pixel is ≥14% darker than its local mean
const INK_RGBA = [246, 92, 156]; // swish-ish pink

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image."));
    img.src = dataUrl;
  });
}

export async function buildScanOverlay(dataUrl: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    return null;
  }
  const aspect = img.width / Math.max(1, img.height);
  const w = aspect >= 1 ? SAMPLE_LONG_EDGE : Math.max(1, Math.round(SAMPLE_LONG_EDGE * aspect));
  const h = aspect >= 1 ? Math.max(1, Math.round(SAMPLE_LONG_EDGE / aspect)) : SAMPLE_LONG_EDGE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let src: ImageData;
  try {
    src = ctx.getImageData(0, 0, w, h);
  } catch {
    return null;
  }
  const data = src.data;
  const n = w * h;

  // Luminance + histogram.
  const lum = new Uint8Array(n);
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const v = ((data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000) | 0;
    lum[i] = v;
    hist[v]++;
  }

  // Bright threshold from the histogram's upper tail → the paper.
  let acc = 0;
  let p88 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * 0.88) { p88 = v; break; }
  }
  const brightTh = Math.max(110, Math.min(200, p88 - 25));

  // Largest 4-connected bright component (the paper), by flood fill.
  const label = new Uint8Array(n); // 0 unvisited, 1 visited, 2 winner
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
    if (count > bestCount) { bestCount = count; bestSeed = i; }
  }
  if (bestSeed < 0 || bestCount < n * MIN_COMPONENT_FRAC) return null;

  // Mark the winner (label 2) and record its width per row for the outline.
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

  // Integral image of luminance for O(1) local means.
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += lum[y * w + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }
  const r = Math.max(4, Math.round(SAMPLE_LONG_EDGE * ADAPT_RADIUS_FRAC));

  // ── Paint the overlay ───────────────────────────────────────────────
  // "Inside the paper" = within the bright blob's horizontal span at that
  // row — NOT the bright pixels themselves, since ink is dark and would be
  // a hole in the blob. Inset a hair so the paper's shadowed edge doesn't
  // register as ink.
  const out = ctx.createImageData(w, h);
  const od = out.data;
  const [IR, IG, IB] = INK_RGBA;
  for (let y = 0; y < h; y++) {
    if (rowRight[y] < 0) continue;
    const rl = rowLeft[y] + 2;
    const rr = rowRight[y] - 2;
    const y1 = Math.max(0, y - r);
    const y2 = Math.min(h - 1, y + r);
    for (let x = rl; x <= rr; x++) {
      const p = y * w + x;
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(w - 1, x + r);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * iw + (x2 + 1)] -
        integral[y1 * iw + (x2 + 1)] -
        integral[(y2 + 1) * iw + x1] +
        integral[y1 * iw + x1];
      const mean = sum / area;
      if (lum[p] < mean * (1 - ADAPT_T)) {
        // Darker pixels highlight more strongly (denser ink → hotter).
        const strength = Math.min(1, (mean * (1 - ADAPT_T) - lum[p]) / 60 + 0.45);
        const o = p * 4;
        od[o] = IR;
        od[o + 1] = IG;
        od[o + 2] = IB;
        od[o + 3] = Math.round(235 * strength);
      }
    }
  }
  ctx.putImageData(out, 0, 0);

  // ── Outline the paper ───────────────────────────────────────────────
  // Smooth the per-row edges a little so the stroke reads as a clean
  // border rather than a jagged mask boundary.
  const ys: number[] = [];
  const ls: number[] = [];
  const rs: number[] = [];
  for (let y = 0; y < h; y += 3) {
    if (rowRight[y] < 0) continue;
    let sl = 0;
    let sr = 0;
    let c = 0;
    for (let k = -3; k <= 3; k++) {
      const yy = y + k;
      if (yy < 0 || yy >= h || rowRight[yy] < 0) continue;
      sl += rowLeft[yy];
      sr += rowRight[yy];
      c++;
    }
    if (!c) continue;
    ys.push(y);
    ls.push(sl / c);
    rs.push(sr / c);
  }
  if (ys.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(ls[0], ys[0]);
    for (let i = 1; i < ys.length; i++) ctx.lineTo(ls[i], ys[i]);
    for (let i = ys.length - 1; i >= 0; i--) ctx.lineTo(rs[i], ys[i]);
    ctx.closePath();
    ctx.strokeStyle = `rgba(${IR}, ${IG}, ${IB}, 0.95)`;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.shadowColor = `rgba(${IR}, ${IG}, ${IB}, 0.9)`;
    ctx.shadowBlur = 6;
    ctx.stroke();
  }

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
