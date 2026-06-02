/**
 * Lightweight client-side image quality check. Runs on a 200-px
 * sampled copy of the receipt photo so it stays well under one
 * frame on a phone, then returns the metrics + a single most-
 * actionable warning the capture UI can show before the host
 * commits to a full OCR round-trip.
 *
 * Metrics:
 *   - blur    — Laplacian variance over the grayscale plane. Sharp
 *               edges → high variance; out-of-focus / motion-
 *               blurred photos → low. A receipt that's readable to
 *               a human typically scores well over a few hundred.
 *   - contrast — standard deviation of grayscale values. Faded
 *               thermal-printer receipts or photos in low light
 *               score low.
 *   - brightness — mean grayscale value (0 – 255). Tells us if the
 *               photo is mostly black / mostly washed-out white.
 *
 * The warning is the single most likely reason a human reader
 * would also struggle with the photo. We surface only one so the
 * UI doesn't pile up scary chips on top of the capture preview.
 */

export type ImageQuality = {
  blur: number;
  contrast: number;
  brightness: number;
  /** The single most-actionable hint, or null when the photo looks fine. */
  warning: "blur" | "contrast" | "dark" | "bright" | null;
};

const BLUR_THRESHOLD = 90; // laplacian variance below this reads as blurry
const CONTRAST_THRESHOLD = 28; // std-dev below this reads as washed out
const DARK_THRESHOLD = 55; // mean below this reads as too dark
const BRIGHT_THRESHOLD = 225; // mean above this reads as glare / blown-out
const SAMPLE_LONG_EDGE = 200; // downscale long edge to this many px

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for analysis."));
    img.src = dataUrl;
  });
}

export async function analyzeImageQuality(dataUrl: string): Promise<ImageQuality | null> {
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
  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch {
    // Cross-origin or other security issue — skip the check rather
    // than block the capture flow.
    return null;
  }
  const px = imgData.data;
  const len = w * h;
  const gray = new Uint8ClampedArray(len);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const v = (r * 299 + g * 587 + b * 114) / 1000;
    gray[i] = v;
    sum += v;
  }
  const mean = sum / len;

  let sqSum = 0;
  for (let i = 0; i < len; i++) {
    const d = gray[i] - mean;
    sqSum += d * d;
  }
  const contrast = Math.sqrt(sqSum / len);

  // Laplacian via the 4-neighbour kernel: ∇²I = N + S + E + W − 4·C.
  // Drop the 1-px border so we don't read past the edges.
  let lapSum = 0;
  let lapSqSum = 0;
  let lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const c = gray[row + x];
      const lap = gray[row - w + x] + gray[row + w + x] + gray[row + x - 1] + gray[row + x + 1] - 4 * c;
      lapSum += lap;
      lapSqSum += lap * lap;
      lapN++;
    }
  }
  const lapMean = lapN > 0 ? lapSum / lapN : 0;
  const blur = lapN > 0 ? lapSqSum / lapN - lapMean * lapMean : 0;

  // Pick the single most-actionable warning. Order matters: blur and
  // glare wreck OCR more reliably than mid-range darkness, so we
  // surface them first.
  let warning: ImageQuality["warning"] = null;
  if (blur < BLUR_THRESHOLD) warning = "blur";
  else if (mean > BRIGHT_THRESHOLD) warning = "bright";
  else if (mean < DARK_THRESHOLD) warning = "dark";
  else if (contrast < CONTRAST_THRESHOLD) warning = "contrast";

  return { blur, contrast, brightness: mean, warning };
}
