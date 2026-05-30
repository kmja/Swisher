/**
 * Local vertical photo stitching for tall receipts.
 *
 * Strategy: for each consecutive pair, downscale both to a narrow detection
 * canvas, take their grayscale, and slide A's bottom strip over B's top
 * strip computing normalized cross-correlation (NCC) at each candidate
 * overlap. Best NCC → that's the overlap. Paste full-resolution images
 * onto one tall canvas at the resolved offsets and export as a single JPEG.
 *
 * NCC is brightness-invariant, which matters: consecutive phone shots can
 * differ a stop or two in exposure even half a second apart, so a plain
 * SSD/absolute-diff would prefer "darker = lower diff" and pick the wrong
 * overlap. NCC normalizes the means out.
 *
 * Performance plan: do the search at 160 px wide. A 200-candidate sweep
 * on a 160×~250 grayscale strip is ~8 M ops per pair — well under 100 ms
 * on a phone. The expensive part is the final composite onto a tall
 * canvas; we cap it at MAX_H to keep memory sensible.
 */

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

type Gray = { data: Uint8Array; w: number; h: number };

/** Draw the image into a downscaled offscreen canvas and extract a Y-channel
 *  (luminance) buffer for alignment. */
function downscaleGray(img: HTMLImageElement, targetW: number): Gray {
  const w = Math.max(2, targetW);
  const h = Math.max(2, Math.round(img.naturalHeight * (w / img.naturalWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < src.length; i += 4, j++) {
    gray[j] = (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) | 0;
  }
  return { data: gray, w, h };
}

/**
 * For each candidate overlap in [minOvl, maxOvl] (in scaled rows), compute
 * NCC of A's bottom strip vs B's top strip and pick the best. Returns the
 * overlap in scaled rows + the correlation score (1.0 = perfect).
 *
 * Two-stage pick: find the global best NCC, then among candidates within a
 * small tolerance (0.02) of that score, choose the HIGHEST overlap. This
 * matters for nearly-stationary frames — when the user pans slowly enough
 * that two consecutive frames look almost identical, NCC stays near 1.0
 * across most candidate offsets. Without the bias toward higher overlap,
 * the algorithm picks the smallest overlap in the tie and leaves a near-
 * duplicate frame's worth of content in the composite.
 */
function findOverlap(a: Gray, b: Gray): { overlap: number; score: number } {
  if (a.w !== b.w) throw new Error("width mismatch");
  const W = a.w;
  // Generous window so slow pans (95 %+ overlap) and brisk pans (~5 %)
  // both fall inside the search.
  const minOvl = Math.max(10, Math.floor(Math.min(a.h, b.h) * 0.03));
  const maxOvl = Math.floor(Math.min(a.h, b.h) * 0.97);
  const step = 2; // half the work, ~1 row resolution at detect scale

  const scores: number[] = [];
  let bestScore = -Infinity;

  for (let ovl = minOvl; ovl <= maxOvl; ovl += step) {
    const aStart = (a.h - ovl) * W;
    const count = ovl * W;
    let sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0, cross = 0;
    for (let i = 0; i < count; i++) {
      const va = a.data[aStart + i];
      const vb = b.data[i];
      sumA += va; sumA2 += va * va;
      sumB += vb; sumB2 += vb * vb;
      cross += va * vb;
    }
    const meanA = sumA / count;
    const meanB = sumB / count;
    const varA = sumA2 / count - meanA * meanA;
    const varB = sumB2 / count - meanB * meanB;
    if (varA <= 0 || varB <= 0) {
      scores.push(-Infinity);
      continue;
    }
    const cov = cross / count - meanA * meanB;
    const score = cov / Math.sqrt(varA * varB);
    scores.push(score);
    if (score > bestScore) bestScore = score;
  }

  // Walk down from the highest candidate overlap; the first score within
  // the tolerance of best wins. Near-stationary case → maxOvl.
  const TIE_TOLERANCE = 0.02;
  const threshold = bestScore - TIE_TOLERANCE;
  let bestOvl = minOvl;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] >= threshold) {
      bestOvl = minOvl + i * step;
      break;
    }
  }

  return { overlap: bestOvl, score: bestScore };
}

export type StitchResult = {
  dataUrl: string;
  width: number;
  height: number;
  /** NCC scores per seam (n-1 entries). Low scores (≪ 0.5) mean the seam is
   *  probably wrong — useful for debugging or to fall back to "no overlap". */
  seamScores: number[];
};

/**
 * Stitch a list of image data URLs into one tall vertical image.
 *
 * - srcs are processed in order (top → bottom).
 * - If all images don't share the same width, they're scaled to the median
 *   width before compositing.
 * - The final canvas is capped at MAX_H px tall (12 000) to keep memory
 *   bounded; if the natural stitch is taller it's uniformly downscaled.
 */
export async function stitchVertically(srcs: string[]): Promise<StitchResult> {
  if (srcs.length === 0) throw new Error("nothing to stitch");
  const imgs = await Promise.all(srcs.map(loadImg));

  if (imgs.length === 1) {
    return {
      dataUrl: srcs[0],
      width: imgs[0].naturalWidth,
      height: imgs[0].naturalHeight,
      seamScores: [],
    };
  }

  // Canvas width: median of natural widths (robust to one stray zoom level).
  const sortedWidths = [...imgs.map((i) => i.naturalWidth)].sort((a, b) => a - b);
  const W = sortedWidths[Math.floor(sortedWidths.length / 2)];
  // Per-image rendered heights after fitting to canvas width.
  const renderedH = imgs.map((img) => Math.round(img.naturalHeight * (W / img.naturalWidth)));

  // Detection-resolution grayscales (cheap NCC).
  const DETECT_W = 160;
  const detect = imgs.map((img) => downscaleGray(img, DETECT_W));

  const offsets: number[] = [0];
  const seamScores: number[] = [];
  let totalH = renderedH[0];

  for (let i = 1; i < imgs.length; i++) {
    const { overlap: scaledOvl, score } = findOverlap(detect[i - 1], detect[i]);
    // Translate the overlap from detect-resolution into rendered (W-wide) rows.
    const overlapPx = Math.round(scaledOvl * (renderedH[i - 1] / detect[i - 1].h));
    const startY = offsets[i - 1] + renderedH[i - 1] - overlapPx;
    offsets.push(startY);
    totalH = startY + renderedH[i];
    seamScores.push(score);
  }

  // Bound the final canvas size so we don't crash a phone with 30 megapixels.
  const MAX_H = 12000;
  const scale = totalH > MAX_H ? MAX_H / totalH : 1;
  const canvasW = Math.round(W * scale);
  const canvasH = Math.round(totalH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (let i = 0; i < imgs.length; i++) {
    const y = Math.round(offsets[i] * scale);
    const h = Math.round(renderedH[i] * scale);
    ctx.drawImage(imgs[i], 0, y, canvasW, h);
  }

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.88),
    width: canvasW,
    height: canvasH,
    seamScores,
  };
}
