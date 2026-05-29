"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrCard from "@/components/QrCard";
import { computeShares, estimateGroupSize, formatOre, parseAmountToOre } from "@/lib/money";
import { isValidPhone, normalizePhone } from "@/lib/swish";
import { isValidIban, normalizeIban, formatIban, ibanBankName } from "@/lib/sepa";
import { translations, type Lang, type Strings } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER, sharedSuggestion } from "@/lib/categories";
import ItemEmoji from "@/components/ItemEmoji";
import { Money, FxProvider } from "@/components/Money";
import { flagEmoji, formatNative, regionName, type Fx } from "@/lib/currency";
import { addHistory } from "@/lib/history";
import { readLocalSplit, saveLocalSplit } from "@/lib/local-split";
import LangToggle from "@/components/LangToggle";
import type { Diner, LineItem } from "@/lib/types";

type Step = "capture" | "items" | "assign" | "result";
type UiItem = {
  id: string;
  description: string;
  priceInput: string;
  sharers: string[];
  shared: boolean;
  category: string;
  /** Index into `images` of the photo this row was scanned from; -1 if typed. */
  imgIndex: number;
  /** Vertical position on the source photo (0–1) where OCR found this line. */
  y?: number;
  /** Emoji the model picked for this item (knows brands); fallback when no keyword rule matches. */
  emoji?: string;
  /** Tip row — shared by everyone, kept out of the food/bill total. */
  isTip?: boolean;
  /** Fixed number of ways a shared item splits; falls back to the group size. */
  shareCount?: number;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Stable sort by category (starters → mains → drinks → desserts → other, tip last). */
function sortByCategory(arr: UiItem[]): UiItem[] {
  const rank = (it: UiItem) =>
    it.isTip ? 999 : CATEGORY_ORDER.indexOf(categoryFor(it.description, it.category));
  return [...arr].sort((a, b) => rank(a) - rank(b));
}

/** A sample dinner order for 8 (shared items, drinks, dessert) loaded via
 *  "/?demo=1" — handy for exercising the split flow without a real receipt. */
const DEMO_ORDER: { d: string; o: number; c: string; s?: boolean }[] = [
  { d: "Bröd & smör", o: 6500, c: "starter", s: true },
  { d: "Charkbricka", o: 24500, c: "starter", s: true },
  { d: "Skaldjursplateau", o: 89000, c: "starter", s: true },
  { d: "Oliver", o: 7900, c: "starter", s: true },
  { d: "Flaska Barolo 75cl", o: 79500, c: "drink", s: true },
  { d: "Flaska Barolo 75cl", o: 79500, c: "drink", s: true },
  { d: "Entrecôte 250g", o: 32900, c: "food" },
  { d: "Oxfilé", o: 36900, c: "food" },
  { d: "Fläskkarré", o: 24900, c: "food" },
  { d: "Wallenbergare", o: 26500, c: "food" },
  { d: "Räkpasta", o: 23900, c: "food" },
  { d: "Vegetarisk lasagne", o: 21900, c: "food" },
  { d: "Stekt torsk", o: 27900, c: "food" },
  { d: "Lammracks", o: 33900, c: "food" },
  { d: "Flaska vatten", o: 4500, c: "drink" },
  { d: "Stor stark", o: 8900, c: "drink" },
  { d: "Stor stark", o: 8900, c: "drink" },
  { d: "Stor stark", o: 8900, c: "drink" },
  { d: "Glas rödvin", o: 11500, c: "drink" },
  { d: "Glas rödvin", o: 11500, c: "drink" },
  { d: "Coca-Cola", o: 4500, c: "drink" },
  { d: "Alkoholfri öl", o: 6900, c: "drink" },
  { d: "Bryggkaffe", o: 3900, c: "drink" },
  { d: "Bryggkaffe", o: 3900, c: "drink" },
  { d: "Bryggkaffe", o: 3900, c: "drink" },
  { d: "Bryggkaffe", o: 3900, c: "drink" },
  { d: "Crème brûlée", o: 9900, c: "dessert" },
  { d: "Crème brûlée", o: 9900, c: "dessert" },
  { d: "Kladdkaka med glass", o: 8900, c: "dessert" },
  { d: "Glass", o: 6900, c: "dessert" },
  { d: "Cheesecake", o: 9900, c: "dessert" },
];

/** Currencies the host can pick from when correcting a mis-detected receipt. */
const COMMON_CURRENCIES = [
  "SEK", "EUR", "USD", "GBP", "NOK", "DKK", "CHF", "ISK", "JPY", "THB",
  "AUD", "CAD", "PLN", "CZK", "HUF", "TRY", "SGD", "HKD", "AED", "INR",
  "MXN", "BRL", "ZAR", "NZD",
];

/** Friendly names for the OCR model that answered (from the X-Ocr-Model header). */
const OCR_MODEL_LABEL: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  llama4: "Llama 4 Scout",
  mistral: "Mistral Small",
  llava: "LLaVA",
};

/** Pre-OCR clean-up for receipts shot in dim restaurant light. Three passes,
 *  all gentle so faint thermal print survives:
 *
 *   1. Grayscale + histogram-based auto-levels. The darkest ~0.5% of pixels
 *      become true black, the lightest ~0.5% true white. A fixed contrast
 *      multiplier (what was here before) can't pull up a photo that lives at
 *      40-160 luminance; stretching the actual range does, every time.
 *
 *   2. Adaptive gamma. After stretching we aim the mean luminance at ~140
 *      (slightly bright, where thermal print reads best). Dim photos get
 *      gamma < 1 to lift the midtones, blown-out ones get gamma > 1 to pull
 *      them back. Clamped to [0.5, 1.4] so we never invert detail.
 *
 *   3. Light unsharp mask via a separable 1-2-1 box blur. The mild edge
 *      enhancement crisps the digits without ringing. Skipped on huge
 *      images to keep capture-to-scan latency reasonable. */
function enhanceForScan(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const n = w * h;

    // Pass 1: grayscale + per-pixel luminance + 8-bit histogram.
    const lum = new Uint8ClampedArray(n);
    const hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
      lum[j] = g;
      hist[g]++;
    }

    // Percentile-based black/white points. Outliers (a few stray dark pixels
    // in a shadow, glints off cutlery) shouldn't be allowed to define "true
    // black" / "true white" — we skip the 0.5% tails.
    const tail = Math.max(1, Math.floor(n * 0.005));
    let acc = 0;
    let black = 0;
    let white = 255;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= tail) {
        black = i;
        break;
      }
    }
    acc = 0;
    for (let i = 255; i >= 0; i--) {
      acc += hist[i];
      if (acc >= tail) {
        white = i;
        break;
      }
    }
    // Guarantee some usable span; otherwise the LUT collapses to a binary.
    if (white - black < 40) {
      black = Math.max(0, black - 20);
      white = Math.min(255, white + 20);
    }

    // Pass 2: adaptive gamma to aim the stretched mean at ~140.
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    const meanIn = sum / n;
    const span = Math.max(1, white - black);
    const meanStretched = Math.max(1, Math.min(254, ((meanIn - black) * 255) / span));
    const targetMean = 140;
    const rawGamma = Math.log(targetMean / 255) / Math.log(meanStretched / 255);
    const gamma = Math.max(0.5, Math.min(1.4, isFinite(rawGamma) ? rawGamma : 1));

    // LUT: stretch then gamma in one table.
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const stretched = Math.max(0, Math.min(255, ((i - black) * 255) / span));
      lut[i] = (255 * Math.pow(stretched / 255, gamma)) | 0;
    }

    // Apply the LUT and produce the grayscale buffer we'll sharpen.
    const gray = new Uint8ClampedArray(n);
    for (let j = 0; j < n; j++) gray[j] = lut[lum[j]];

    // Pass 3: light unsharp mask. Skip if the image is huge — the sharpening
    // pass is the slowest part and ~6 MP * two passes can push the capture
    // delay past a second on mid-range phones. The level/gamma work is the
    // big win anyway; sharpening is icing.
    let out: Uint8ClampedArray = gray;
    if (n <= 4_500_000) {
      // Separable 1-2-1 box blur (horizontal then vertical), then combine.
      const tmp = new Uint8ClampedArray(n);
      const blurred = new Uint8ClampedArray(n);
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const l = gray[row + Math.max(0, x - 1)];
          const c = gray[row + x];
          const r = gray[row + Math.min(w - 1, x + 1)];
          tmp[row + x] = (l + 2 * c + r) >> 2;
        }
      }
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          const u = tmp[Math.max(0, y - 1) * w + x];
          const c = tmp[y * w + x];
          const d2 = tmp[Math.min(h - 1, y + 1) * w + x];
          blurred[y * w + x] = (u + 2 * c + d2) >> 2;
        }
      }
      const amount = 0.6;
      out = new Uint8ClampedArray(n);
      for (let j = 0; j < n; j++) {
        const v = gray[j] + amount * (gray[j] - blurred[j]);
        out[j] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }

    // Write the enhanced grayscale back into the RGB canvas.
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      d[i] = d[i + 1] = d[i + 2] = out[j];
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* getImageData can throw on tainted canvas — skip enhancement */
  }
}

/** Downscale a photo to keep the OCR upload small and fast. */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read the image."));
      img.onload = () => {
        // Keep receipts detailed: faint thermal digits (e.g. 1180 vs 118) need
        // pixels, so cap the long side generously rather than at 1280.
        const maxDim = 2200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        enhanceForScan(ctx, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [lang, setLang] = useState<Lang>("sv");
  const t = translations[lang];

  const [step, setStep] = useState<Step>("capture");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrModel, setOcrModel] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [scanPhase, setScanPhase] = useState(0);

  const [items, setItems] = useState<UiItem[]>([]);
  const [removedItems, setRemovedItems] = useState<UiItem[]>([]);
  const [undoItem, setUndoItem] = useState<UiItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How the items list is ordered. Sort is applied at scan/toggle time so rows
  // don't reshuffle while you're editing a description.
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // "/?demo=1": load a sample order so the split flow can be tested end-to-end.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") == null) return;
    const demoItems: UiItem[] = DEMO_ORDER.map((x) => ({
      id: uid(),
      description: x.d,
      priceInput: formatOre(x.o),
      sharers: [],
      shared: !!x.s,
      category: x.c,
      imgIndex: -1,
    }));
    setItems(sortByCategory(demoItems));
    setMealLabel("Demomiddag");
    setStep("items");
  }, []);
  const [images, setImages] = useState<string[]>([]);
  // Foreign-currency context: amounts are always stored in SEK öre; these drive
  // the dual-currency display. null currency / rate=1 means a plain SEK receipt.
  const [currency, setCurrency] = useState<string>("SEK");
  const [fxRate, setFxRate] = useState<number | null>(1);
  const [rateApprox, setRateApprox] = useState(false);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [fxChanging, setFxChanging] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null); // öre
  const [receiptOpen, setReceiptOpen] = useState(false);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const [diners, setDiners] = useState<Diner[]>([{ id: uid(), name: "" }]);
  const [payerPhone, setPayerPhone] = useState("");
  // Payout rail: Swish (SEK) by default; SEPA/EPC (EUR) for euro receipts.
  const [payMethod, setPayMethod] = useState<"swish" | "sepa">("swish");
  const [payeeIban, setPayeeIban] = useState("");
  const [splitId, setSplitId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [mealLabel, setMealLabel] = useState(translations.sv.mealDefault);
  const [eventDate, setEventDate] = useState(today);

  const [receiptChargedOre, setReceiptChargedOre] = useState(0);

  const [groupSize, setGroupSize] = useState(0);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const router = useRouter();

  // Switch language; carry over the meal label only if it is still the
  // untouched default, and remember the choice.
  const applyLang = useCallback((next: Lang, prev: Lang) => {
    setMealLabel((cur) => (cur === translations[prev].mealDefault ? translations[next].mealDefault : cur));
    setLang(next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
    try {
      localStorage.setItem("swisher-lang", next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("swisher-lang");
    } catch {
      /* storage unavailable */
    }
    if (stored === "sv" || stored === "en") applyLang(stored, "sv");
    else if (
      typeof navigator !== "undefined" &&
      navigator.language &&
      !navigator.language.toLowerCase().startsWith("sv")
    ) {
      applyLang("en", "sv");
    }
  }, [applyLang]);

  const message = useMemo(
    () => `${mealLabel} ${eventDate}`.trim().slice(0, 50),
    [mealLabel, eventDate],
  );

  const isForeign = currency !== "SEK";
  const fx: Fx = isForeign && fxRate ? { currency, rate: fxRate, approx: rateApprox } : null;
  const rateMissing = isForeign && !fxRate;
  // SEPA/EPC settles in euros, so it's only offered for euro receipts.
  const sepaAvailable = currency === "EUR" && !!fxRate;
  const method: "swish" | "sepa" = sepaAvailable && payMethod === "sepa" ? "sepa" : "swish";
  const ibanValid = isValidIban(payeeIban);
  const ibanCc = payeeIban.slice(0, 2);
  const ibanCountryLabel = /^[A-Z]{2}$/.test(ibanCc) ? `${flagEmoji(ibanCc)} ${regionName(ibanCc, lang)}` : "";
  const payDestOk = method === "sepa" ? ibanValid : isValidPhone(payerPhone);
  const eurCentsFor = (ore: number) => (fxRate ? Math.round(ore / fxRate) : 0);
  const currencyOptions = Array.from(new Set([currency, ...COMMON_CURRENCIES]));

  // Host corrects a mis-detected currency: re-fetch its rate for the receipt
  // date and re-scale every amount (recovering the printed figure, then
  // converting it at the new rate). All amounts stay stored as SEK öre.
  async function changeCurrency(next: string) {
    if (next === currency || fxChanging) return;
    const oldRate = fxRate ?? 1;
    let newRate: number | null = 1;
    let approx = false;
    let date = rateDate;
    if (next === "SEK") {
      newRate = 1;
      date = null;
    } else {
      setFxChanging(true);
      try {
        const r = await fetch(`/api/fx?currency=${next}&date=${encodeURIComponent(eventDate)}`).then((x) => x.json());
        if (r && typeof r.rate === "number" && r.rate > 0) {
          newRate = r.rate;
          approx = r.approx === true;
          if (typeof r.date === "string") date = r.date;
        } else {
          newRate = null;
        }
      } catch {
        newRate = null;
      } finally {
        setFxChanging(false);
      }
    }
    const factor = newRate && oldRate ? newRate / oldRate : null;
    if (factor && factor > 0 && Math.abs(factor - 1) > 1e-9) {
      const rescale = (s: string) => {
        const ore = parseAmountToOre(s);
        return ore == null ? s : formatOre(Math.round(ore * factor));
      };
      setItems((prev) => prev.map((it) => ({ ...it, priceInput: rescale(it.priceInput) })));
      setReceiptTotal((v) => (v == null ? v : Math.round(v * factor)));
      setReceiptChargedOre((v) => Math.round(v * factor));
    }
    setCurrency(next);
    setFxRate(newRate);
    setRateApprox(approx);
    setRateDate(date);
    setPayMethod(next === "EUR" ? "sepa" : "swish");
  }

  // Cycle the scanning status text while OCR runs.
  useEffect(() => {
    if (!ocrLoading) return;
    setScanPhase(0);
    const iv = setInterval(() => setScanPhase((p) => p + 1), 900);
    return () => clearInterval(iv);
  }, [ocrLoading]);

  // Remember the host across sessions so they don't retype their name/number.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("swisher-host") || "null");
      if (saved?.name) setDiners((prev) => prev.map((d, i) => (i === 0 ? { ...d, name: String(saved.name) } : d)));
      if (saved?.number) setPayerPhone(String(saved.number));
      if (saved?.iban) setPayeeIban(normalizeIban(String(saved.iban)));
    } catch {
      /* ignore */
    }
  }, []);

  // Remember the host's details (name, Swish number, IBAN) so they only ever
  // type them once. Merge so filling one field doesn't wipe a saved other.
  useEffect(() => {
    const name = diners[0]?.name?.trim();
    if (!name) return;
    try {
      const prev = JSON.parse(localStorage.getItem("swisher-host") || "{}");
      const next: Record<string, string> = { ...prev, name };
      if (isValidPhone(payerPhone)) next.number = payerPhone;
      if (isValidIban(payeeIban)) next.iban = normalizeIban(payeeIban);
      localStorage.setItem("swisher-host", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [diners, payerPhone, payeeIban]);

  // --- capture ---------------------------------------------------------------
  // Live camera preview on the capture step. Falls back silently (cameraActive
  // stays false) when there's no camera or permission is denied.
  useEffect(() => {
    if (step !== "capture" || imageUrl) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            /* autoplay may be deferred; the element still shows the stream */
          }
        }
        setCameraActive(true);
      } catch {
        setCameraActive(false);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
    };
  }, [step, imageUrl]);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    enhanceForScan(ctx, canvas.width, canvas.height);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
    setOcrError(null);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setImageUrl(dataUrl);
    runOcr(dataUrl); // scan automatically
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageUrl(dataUrl);
      runOcr(dataUrl); // scan automatically — no extra confirm tap
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Could not read the image.");
    }
  }

  async function runOcr(img: string = imageUrl ?? "", opts: { append?: boolean } = {}) {
    if (!img || ocrLoading) return;
    const append = opts.append === true;
    const imgIndex = append ? images.length : 0;
    setOcrLoading(true);
    setOcrError(null);
    setScanCount(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: img }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed.");
      setOcrModel(res.headers.get("X-Ocr-Model"));
      const mapped: UiItem[] = (
        data.items as { description: string; price: number; shared?: boolean; category?: string; emoji?: string; y?: number }[]
      ).map((it) => ({
        id: uid(),
        description: it.description,
        priceInput: formatOre(Math.round(it.price * 100)),
        sharers: [],
        // Trust the model's call, but auto-mark near-certain shared lines it missed
        // (a 75cl bottle, a sharing platter, "att dela", …).
        shared: it.shared === true || sharedSuggestion(it.description) === "auto",
        category: it.category ?? "",
        emoji: it.emoji,
        imgIndex,
        y: typeof it.y === "number" && Number.isFinite(it.y) ? Math.max(0, Math.min(1, it.y / 100)) : undefined,
      }));
      setImages((prev) => (append ? [...prev, img] : [img]));
      setOcrLoading(false);

      if (append) {
        // Long receipts get scanned in overlapping photos; drop items in this
        // batch that already appeared in earlier batches with the same name and
        // price (multiset, so a legitimate triple "3× Bryggkaffe" stays a triple).
        setItems((prev) => {
          const keyOf = (it: UiItem) => `${(it.description ?? "").trim().toLowerCase()}|${parseAmountToOre(it.priceInput) ?? 0}`;
          const budget = new Map<string, number>();
          for (const it of prev) budget.set(keyOf(it), (budget.get(keyOf(it)) ?? 0) + 1);
          const filtered = mapped.filter((it) => {
            const k = keyOf(it);
            const left = budget.get(k) ?? 0;
            if (left > 0) {
              budget.set(k, left - 1);
              return false;
            }
            return true;
          });
          return [...prev, ...filtered];
        });
        return;
      }

      const cur = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "SEK";
      setCurrency(cur);
      setPayMethod(cur === "EUR" ? "sepa" : "swish");
      setFxRate(typeof data.rate === "number" && data.rate > 0 ? data.rate : cur === "SEK" ? 1 : null);
      setRateApprox(data.rateApprox === true);
      setRateDate(typeof data.rateDate === "string" ? data.rateDate : null);
      setCountry(typeof data.country === "string" && /^[A-Z]{2}$/.test(data.country) ? data.country : null);

      const totalOre = typeof data.total === "number" ? Math.round(data.total * 100) : null;
      const chargedOre = typeof data.charged === "number" && data.charged > 0 ? Math.round(data.charged * 100) : 0;
      const dricksOre = typeof data.dricks === "number" && data.dricks > 0 ? Math.round(data.dricks * 100) : 0;
      // Tip: a printed tip line if there is one, otherwise the excess of the
      // actual card charge over the bill (host rounded up / tipped at the terminal).
      const billOre = totalOre ?? mapped.reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
      const impliedTipOre = chargedOre - billOre >= 100 ? chargedOre - billOre : 0;
      const tipOre = dricksOre > 0 ? dricksOre : impliedTipOre;
      // Add the tip as a shared row so it shows in the list and splits evenly.
      if (tipOre > 0) {
        mapped.push({
          id: uid(),
          description: t.tip,
          priceInput: formatOre(tipOre),
          sharers: [],
          shared: true,
          category: "other",
          imgIndex: -1,
          isTip: true,
        });
      }
      setItems(sortByCategory(mapped));
      setRemovedItems([]);
      setUndoItem(null);
      // Reset the group size for the new receipt; it's re-seeded (below) once a
      // shared item or tip is present, whether detected now or toggled later.
      setGroupSize(0);
      setReceiptTotal(totalOre);
      setReceiptChargedOre(chargedOre);
      if (typeof data.place === "string" && data.place.trim()) setMealLabel(data.place.trim().slice(0, 40));
      // Only trust a plausible receipt date (a mis-read year shouldn't set 2107
      // or 1917); otherwise keep today's default.
      if (
        typeof data.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.date) &&
        data.date >= "2000-01-01" &&
        data.date <= today
      ) {
        setEventDate(data.date);
      }
      // Tick a counter through the found rows, then move on.
      const n = mapped.length;
      if (n === 0) {
        setStep("items");
        return;
      }
      setScanCount(0);
      let c = 0;
      const delay = Math.max(45, Math.min(160, Math.round(750 / n)));
      const iv = setInterval(() => {
        c += 1;
        setScanCount(c);
        if (c >= n) {
          clearInterval(iv);
          setTimeout(() => {
            setScanCount(null);
            setStep("items");
          }, 500);
        }
      }, delay);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed.");
      setOcrLoading(false);
    }
  }

  async function onAppendFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      runOcr(dataUrl, { append: true });
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Could not read the image.");
    }
  }

  function skipToManual() {
    if (items.length === 0) {
      setItems([{ id: uid(), description: "", priceInput: "", sharers: [], shared: false, category: "", imgIndex: -1 }]);
    }
    setStep("items");
  }

  // --- items -----------------------------------------------------------------
  const updateItem = (id: string, patch: Partial<UiItem>) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        // Editing the text invalidates the model's emoji guess for the old text,
        // so drop it and let the icon re-derive live from the new description.
        if ("description" in patch) next.emoji = undefined;
        return next;
      }),
    );
  // Identical OCR copies group into one card with an "×N" badge (mirrors the
  // diner view). Editing the card propagates to every copy via updateGroup so
  // they stay in lockstep; removing a copy still soft-deletes one at a time.
  const itemGroupKey = (it: UiItem) =>
    `${it.description.toLowerCase().trim()}|${it.priceInput}|${it.shared ? 1 : 0}|${it.shareCount ?? ""}|${it.category ?? ""}|${it.isTip ? 1 : 0}`;
  const updateGroup = (rep: UiItem, patch: Partial<UiItem>) => {
    const key = itemGroupKey(rep);
    setItems((prev) =>
      prev.map((it) => {
        if (itemGroupKey(it) !== key) return it;
        const next = { ...it, ...patch };
        if ("description" in patch) next.emoji = undefined;
        return next;
      }),
    );
  };
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: "", priceInput: "", sharers: [], shared: false, category: "", imgIndex: -1 }]);
  // Soft-delete: move to the removed list (kept out of the totals/shares), with
  // a transient undo and a persistent collapsed list to restore from.
  const removeItem = (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    setRemovedItems((r) => [it, ...r.filter((x) => x.id !== id)]);
    setUndoItem(it);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 6000);
  };
  const restoreItem = (id: string) => {
    const it = removedItems.find((x) => x.id === id);
    if (!it) return;
    setRemovedItems((r) => r.filter((x) => x.id !== id));
    setItems((prev) => [...prev, it]);
    setUndoItem((u) => (u?.id === id ? null : u));
  };

  const updateDiner = (id: string, name: string) =>
    setDiners((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  const addDiner = () => setDiners((prev) => [...prev, { id: uid(), name: "" }]);
  const removeDiner = (id: string) => {
    setDiners((prev) => prev.filter((d) => d.id !== id));
    setItems((prev) => prev.map((it) => ({ ...it, sharers: it.sharers.filter((s) => s !== id) })));
  };

  const namedDiners = diners.filter((d) => d.name.trim());
  const validItems = items.filter((it) => (parseAmountToOre(it.priceInput) ?? 0) > 0);
  // The tip is its own shared row; keep it out of the food total and the
  // bill reconciliation, and split it equally via tipOre instead.
  const foodItems = validItems.filter((it) => !it.isTip);
  const tipOre = validItems
    .filter((it) => it.isTip)
    .reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
  const itemsSumOre = foodItems.reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
  // The scanned items should add up to the printed bill total (the tip is added
  // on top via the card charge, not part of the bill). Allow up to 1 kr of slack
  // for Swedish öre rounding (öresavrundning).
  const totalDiffOre = receiptTotal === null ? 0 : receiptTotal - itemsSumOre;
  const totalReconciles = receiptTotal === null || Math.abs(totalDiffOre) < 100;
  const hasSharedItems = foodItems.some((it) => it.shared);
  // The tip is itself a shared item, so the group-size control matters whenever
  // there's a shared row or a tip.
  const needsGroupSize = hasSharedItems || tipOre > 0;

  // When shared items (or a tip) first appear, seed a sensible group size from
  // the individual items by category (mains ≈ heads), so the picker is never
  // blank. Editable afterwards.
  useEffect(() => {
    if (!needsGroupSize || groupSize !== 0) return;
    const indiv = foodItems.filter((it) => !it.shared);
    const byCat = (c: string) => indiv.filter((it) => categoryFor(it.description, it.category) === c).length;
    setGroupSize(
      estimateGroupSize({ food: byCat("food"), drink: byCat("drink"), dessert: byCat("dessert"), total: indiv.length }),
    );
  }, [needsGroupSize, groupSize, foodItems]);

  const itemsStepValid =
    validItems.length > 0 && namedDiners.length >= 2 && payDestOk;

  // --- assign ----------------------------------------------------------------
  function toggleSharer(itemId: string, dinerId: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const has = it.sharers.includes(dinerId);
        return { ...it, sharers: has ? it.sharers.filter((s) => s !== dinerId) : [...it.sharers, dinerId] };
      }),
    );
  }
  function assignAllTo(itemId: string) {
    const everyone = namedDiners.map((d) => d.id);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const allSet = everyone.every((id) => it.sharers.includes(id));
        return { ...it, sharers: allSet ? [] : everyone };
      }),
    );
  }
  function spreadEverything() {
    const everyone = namedDiners.map((d) => d.id);
    setItems((prev) => prev.map((it) => ({ ...it, shared: false, sharers: everyone })));
  }
  function toggleShared(itemId: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, shared: !it.shared, sharers: [], shareCount: undefined } : it)),
    );
  }
  // Ways a shared item splits: its own count, else the group size, else the
  // number of diners — never below 2 (sharing one way makes no sense).
  const itemDivisorFor = (it: UiItem) =>
    Math.max(2, it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize > 0 ? groupSize : namedDiners.length);
  const setShareCount = (id: string, n: number) => updateItem(id, { shareCount: Math.max(2, Math.min(50, n)) });

  // --- live room -------------------------------------------------------------
  const roomReady = validItems.length > 0 && !!diners[0]?.name.trim() && payDestOk;

  async function createRoom() {
    if (!roomReady || creatingRoom) return;
    setCreatingRoom(true);
    setRoomError(null);
    try {
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payeeName: diners[0].name,
          payeeNumber: payerPhone,
          method,
          payeeIban: method === "sepa" ? normalizeIban(payeeIban) : "",
          message,
          place: mealLabel.trim(),
          date: eventDate,
          tipOre,
          currency,
          rate: fxRate ?? 1,
          country: country ?? "",
          images: images.slice(0, 5),
          groupSize: groupSize >= 2 ? groupSize : undefined,
          items: foodItems.map((it) => ({
            description: it.description.trim() || t.rowFallback,
            priceOre: parseAmountToOre(it.priceInput) ?? 0,
            category: categoryFor(it.description, it.category),
            emoji: it.emoji,
            // Shared items split across the whole room (pre-claimed for everyone),
            // rather than becoming separate claimable slots.
            shared: it.shared,
            // Freeze the group size onto each shared item so the room uses it as
            // the divisor — otherwise the room falls back to "current people in
            // the room", which is just the host (→ 2) until others join.
            shareCount: it.shareCount && it.shareCount > 0
              ? it.shareCount
              : it.shared && groupSize > 0 ? groupSize : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the room.");
      try {
        localStorage.setItem(`swisher-room:${data.id}`, data.personId);
      } catch {
        /* storage unavailable */
      }
      addHistory({ id: data.id, place: mealLabel.trim(), date: eventDate, role: "host" });
      // Replace, not push: the items/setup step shouldn't be reachable via the
      // back button once a room exists (it'd risk spawning a second room and
      // orphaning the first). Going back from the room goes outside the app;
      // "New receipt" in the room nav is the way to start fresh.
      // ?invite=1 tells the room page to pop the QR/share dialog straight away
      // — the host's first job is to invite the table, not to scroll items.
      router.replace(`/room/${data.id}?invite=1`);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Could not create the room.");
      setCreatingRoom(false);
    }
  }

  // --- compute ---------------------------------------------------------------
  const lineItems: LineItem[] = useMemo(
    () =>
      foodItems.map((it) => ({
        id: it.id,
        description: it.description,
        priceOre: parseAmountToOre(it.priceInput) ?? 0,
        sharers: it.sharers,
        shared: it.shared,
        shareCount: it.shareCount,
      })),
    [foodItems],
  );

  const { shares, unassignedOre } = useMemo(
    () => computeShares(lineItems, namedDiners, tipOre, groupSize),
    [lineItems, namedDiners, tipOre, groupSize],
  );

  // Collapse identical OCR copies into display groups. The display order is the
  // first appearance of each group, so editing doesn't make rows jump around.
  const itemGroups = useMemo(() => {
    const groups: UiItem[][] = [];
    const indexOf = new Map<string, number>();
    for (const it of items) {
      const key = itemGroupKey(it);
      const i = indexOf.get(key);
      if (i === undefined) {
        indexOf.set(key, groups.length);
        groups.push([it]);
      } else {
        groups[i].push(it);
      }
    }
    return groups;
    // itemGroupKey is referentially stable (function expression captured above);
    // the only input that matters is `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const payer = namedDiners[0];
  const normalizedPayer = normalizePhone(payerPhone) ?? "";
  const assignedTotalOre = shares.reduce((acc, s) => acc + s.totalOre, 0);

  // Persist a local (no-room) split so it lands in history and the host can
  // reopen it to show the QR codes again and track who's paid.
  function persistLocalSplit() {
    const payees = shares
      .filter((s) => s.dinerId !== payer?.id && s.totalOre > 0)
      .map((s) => ({ id: s.dinerId, name: s.name, totalOre: s.totalOre }));
    if (payees.length === 0) return;
    let id = splitId;
    if (!id) {
      id = uid();
      setSplitId(id);
    }
    const prev = readLocalSplit(id);
    saveLocalSplit({
      id,
      createdAt: prev?.createdAt ?? Date.now(),
      place: mealLabel.trim(),
      date: eventDate,
      message,
      currency,
      rate: fxRate ?? 1,
      country: country ?? "",
      method,
      payeeName: payer?.name ?? "",
      payeeNumber: normalizedPayer,
      payeeIban: method === "sepa" ? normalizeIban(payeeIban) : "",
      shares: payees,
      paidBy: prev?.paidBy ?? [],
    });
    addHistory({ id, place: mealLabel.trim(), date: eventDate, role: "host", kind: "local" });
  }

  // --- render ----------------------------------------------------------------
  return (
    <FxProvider value={fx}>
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-5">
      <div className="mb-3 flex items-center justify-between">
        {step === "capture" ? (
          <a href="/history" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-swish-dark ring-1 ring-gray-200 active:bg-gray-100">
            🕘 {t.history}
          </a>
        ) : (
          <span />
        )}
        <LangToggle lang={lang} onChange={(l) => applyLang(l, lang)} />
      </div>

      {step !== "capture" && <Header step={step} t={t} />}

      {step === "capture" && (
        <section key="capture" className="step-enter mt-2 flex flex-1 flex-col">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-[11px] text-gray-300">
            {process.env.NEXT_PUBLIC_APP_VERSION && <>v{process.env.NEXT_PUBLIC_APP_VERSION} · </>}
            {process.env.NEXT_PUBLIC_BUILD_ID && <>{process.env.NEXT_PUBLIC_BUILD_ID} · </>}
            <a href="/debug/icons" className="underline">icons</a> · <a href="/?demo=1" className="underline">demo</a>
          </p>

          <div
            className={`relative mt-4 flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 ${
              ocrLoading || scanCount !== null
                ? "h-44 shrink-0"
                : "min-h-0 flex-1"
            }`}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-contain" />
            ) : null}
            {ocrLoading && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-black/40" />
                <div className="scan-grid absolute inset-0 opacity-40" />
                {/* sweeping band + bright glowing beam */}
                <div className="scanline absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-swish/45 to-transparent" />
                <div className="scanline absolute inset-x-0 top-0 h-[3px] bg-swish shadow-[0_0_18px_5px_rgba(238,92,154,0.85)]" />
                {/* glowing corner brackets */}
                <div className="scan-glow pointer-events-none absolute inset-4">
                  <span className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-swish" />
                  <span className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-swish" />
                  <span className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-swish" />
                  <span className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-swish" />
                </div>
                <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-1 text-white">
                  <span className="text-2xl">🔎</span>
                  <span className="text-sm font-semibold drop-shadow">
                    {t.scanPhrases[scanPhase % t.scanPhrases.length]}
                  </span>
                </div>
              </div>
            )}
            {imageUrl ? null : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full bg-black object-cover ${cameraActive ? "" : "invisible"}`}
                />
                {cameraActive && !ocrLoading && (
                  <div className="pointer-events-none absolute inset-5">
                    <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l-4 border-t-4 border-white/90" />
                    <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r-4 border-t-4 border-white/90" />
                    <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b-4 border-l-4 border-white/90" />
                    <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b-4 border-r-4 border-white/90" />
                    <span className="absolute inset-x-0 bottom-1 text-center text-xs font-medium text-white/90 drop-shadow">
                      {t.scanGuide}
                    </span>
                  </div>
                )}
                {!cameraActive && (
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-gray-500"
                  >
                    <span className="text-4xl">📷</span>
                    <span className="font-medium">{t.tapToPhoto}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

          {ocrError && <p className="mt-3 text-sm text-red-600">{ocrError}</p>}

          {(ocrLoading || scanCount !== null) && (
            <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {ocrLoading ? t.scanning : t.itemsFound(scanCount ?? 0)}
                </p>
                {ocrLoading && (
                  <span className="scan-pulse inline-block h-2 w-2 rounded-full bg-swish" aria-hidden />
                )}
              </div>
              <div className="flex items-stretch gap-2">
                <input
                  value={diners[0]?.name ?? ""}
                  onChange={(e) => updateDiner(diners[0].id, e.target.value)}
                  placeholder={t.yourName}
                  className="min-w-0 flex-1 rounded-xl bg-gray-50 px-4 py-3 outline-none"
                />
                <div className="relative min-w-0 flex-1">
                  <input
                    value={payerPhone}
                    onChange={(e) => {
                      setPayerPhone(e.target.value);
                      // Once the number's valid, drop the keyboard — saves a tap
                      // and signals "this looks right" without a separate "next".
                      if (isValidPhone(e.target.value)) e.target.blur();
                    }}
                    inputMode="tel"
                    placeholder={t.swishNumber}
                    className="w-full rounded-xl bg-gray-50 px-4 py-3 pr-9 outline-none"
                  />
                  {isValidPhone(payerPhone) && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-bold text-emerald-600"
                    >
                      ✓
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">{t.groupSizeLabel}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => setGroupSize(Math.max(2, (groupSize || 2) - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-lg font-semibold tabular-nums">{groupSize || "–"}</span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => setGroupSize(Math.min(50, Math.max(2, (groupSize || 1) + 1)))}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-swish text-2xl font-bold leading-none text-white active:bg-swish-dark"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2">
            {ocrLoading || scanCount !== null ? null : (
              <>
                {imageUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={() => runOcr()}
                      className="w-full rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark"
                    >
                      {t.readReceipt}
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageUrl(null)}
                        className="rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200"
                      >
                        {t.takePhoto}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200"
                      >
                        {t.chooseLibrary}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {cameraActive && (
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="w-full rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark"
                      >
                        {t.scanCta}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200"
                    >
                      {t.chooseLibrary}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {step === "items" && (
        <section key="items" className="step-enter mt-6 flex flex-1 flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold">{t.payerTitle}</h2>

            {sepaAvailable && (
              <div className="mt-2 inline-flex overflow-hidden rounded-xl text-sm font-semibold ring-1 ring-gray-200">
                {(["swish", "sepa"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={method === m}
                    onClick={() => setPayMethod(m)}
                    className={`px-4 py-2 ${method === m ? "bg-swish text-white" : "bg-white text-gray-500 active:bg-gray-100"}`}
                  >
                    {m === "swish" ? t.payMethodSwish : t.payMethodSepa}
                  </button>
                ))}
              </div>
            )}

            {method === "sepa" ? (
              <div className="mt-2 space-y-2">
                <input
                  value={diners[0]?.name ?? ""}
                  onChange={(e) => updateDiner(diners[0].id, e.target.value)}
                  placeholder={t.yourName}
                  className="w-full rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
                />
                <input
                  value={formatIban(payeeIban)}
                  onChange={(e) => setPayeeIban(normalizeIban(e.target.value))}
                  placeholder={t.ibanPlaceholder}
                  autoCapitalize="characters"
                  autoComplete="on"
                  name="iban"
                  spellCheck={false}
                  className="w-full rounded-xl bg-white px-4 py-3 font-mono uppercase tracking-wide shadow-sm ring-1 ring-black/5 outline-none"
                />
                {ibanValid ? (
                  <p className="text-xs text-emerald-600">
                    ✓ {ibanCountryLabel}
                    {ibanBankName(payeeIban) && <span className="text-gray-500"> · {ibanBankName(payeeIban)}</span>}
                  </p>
                ) : payeeIban.length >= 15 ? (
                  <p className="text-xs text-red-600">{t.ibanInvalid}</p>
                ) : ibanCountryLabel ? (
                  <p className="text-xs text-gray-400">{ibanCountryLabel}</p>
                ) : null}
                <div className="relative">
                  <input
                    value={payerPhone}
                    onChange={(e) => {
                      setPayerPhone(e.target.value);
                      if (isValidPhone(e.target.value)) e.target.blur();
                    }}
                    inputMode="tel"
                    placeholder={t.swishOptional}
                    className="w-full rounded-xl bg-white px-4 py-3 pr-9 shadow-sm ring-1 ring-black/5 outline-none"
                  />
                  {isValidPhone(payerPhone) && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-bold text-emerald-600"
                    >
                      ✓
                    </span>
                  )}
                </div>
                {payerPhone && !isValidPhone(payerPhone) && <p className="text-xs text-red-600">{t.invalidPhone}</p>}
                <p className="px-1 text-xs text-gray-400">{t.sepaSettlesEur}</p>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex items-stretch gap-2">
                  <input
                    value={diners[0]?.name ?? ""}
                    onChange={(e) => updateDiner(diners[0].id, e.target.value)}
                    placeholder={t.yourName}
                    className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
                  />
                  <div className="relative min-w-0 flex-1">
                    <input
                      value={payerPhone}
                      onChange={(e) => {
                        setPayerPhone(e.target.value);
                        if (isValidPhone(e.target.value)) e.target.blur();
                      }}
                      inputMode="tel"
                      placeholder={t.swishNumber}
                      className="w-full rounded-xl bg-white px-4 py-3 pr-9 shadow-sm ring-1 ring-black/5 outline-none"
                    />
                    {isValidPhone(payerPhone) && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base font-bold text-emerald-600"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
                {payerPhone && !isValidPhone(payerPhone) && (
                  <p className="px-1 text-xs text-red-600">{t.invalidPhone}</p>
                )}
              </div>
            )}
          </div>

          {needsGroupSize && (
            <div className="rounded-xl bg-swish/5 px-4 py-3 ring-1 ring-swish/20">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-700">{t.sharedGroupPrompt}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => setGroupSize(Math.max(2, groupSize - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600 active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-lg font-semibold tabular-nums">{groupSize || "–"}</span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => setGroupSize(Math.min(50, Math.max(2, groupSize + 1)))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-swish text-xl font-bold text-white active:bg-swish-dark"
                  >
                    +
                  </button>
                </div>
              </div>
              {groupSize > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-xl">
                  {Array.from({ length: Math.min(groupSize, 20) }).map((_, i) => (
                    <span key={i} className="pop-in" aria-hidden>
                      🧍
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{t.itemsTitle}</h2>
                <p className="text-sm text-gray-600">{t.itemsHint}</p>
              </div>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  aria-label={t.showReceipt}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-swish-dark shadow-sm ring-1 ring-gray-200 active:bg-gray-100"
                >
                  🧾 {t.showReceipt}
                </button>
              )}
            </div>
            {ocrModel && (
              <p className="mt-0.5 text-xs text-gray-400">{t.readBy(OCR_MODEL_LABEL[ocrModel] ?? ocrModel)}</p>
            )}
            {ocrModel && !ocrModel.startsWith("claude") && (
              <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
                {t.ocrFallback}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span>{t.currencyLabel}</span>
              <select
                value={currency}
                onChange={(e) => changeCurrency(e.target.value)}
                disabled={fxChanging}
                className="rounded-lg bg-white px-2 py-1 font-medium text-ink ring-1 ring-black/10 outline-none disabled:opacity-50"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {fxChanging && <span className="text-gray-400">…</span>}
            </div>
            {isForeign && (fx ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
                {t.fxLine(
                  country ? `${flagEmoji(country)} ${regionName(country, lang)}` : "🌍",
                  currency,
                  `${formatOre(Math.round((fxRate ?? 0) * 100))} SEK${rateDate ? `, ${rateDate}` : ""}`,
                )}
                {rateApprox && ` · ${t.fxApprox}`}
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 ring-1 ring-red-200">
                {t.fxMissing(currency)}
              </p>
            ))}
            <div className="mt-3 space-y-2">
              {itemGroups.map((copies) => {
                const rep = copies[0];
                const rowOre = parseAmountToOre(rep.priceInput) ?? 0;
                const divisor = groupSize > 0 ? groupSize : namedDiners.length;
                const d = itemDivisorFor(rep);
                // "Low confidence" = the keyword layer couldn't categorise this
                // line and the description is mostly non-alphabetic. Subtle tint
                // so the host's eyes go to the rows that might need checking.
                const letters = (rep.description.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0);
                const lowConfidence = !rep.isTip && !rep.shared && (
                  categoryFor(rep.description, rep.category) === "other" || letters < 2
                );
                return (
                <div key={rep.id} className="flex items-stretch gap-2">
                  <div
                    className={`min-w-0 flex-1 rounded-xl p-2 shadow-sm ring-1 ${rep.shared ? "bg-swish/5 ring-swish/30" : lowConfidence ? "bg-amber-50/70 ring-amber-200" : "bg-white ring-black/5"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="pl-1 text-3xl leading-none">
                        {rep.isTip ? "💝" : <ItemEmoji description={rep.description} hint={rep.category} modelEmoji={rep.emoji} />}
                      </span>
                      <input
                        value={rep.description}
                        onChange={(e) => updateGroup(rep, { description: e.target.value })}
                        placeholder={t.descPlaceholder}
                        className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                      />
                      {copies.length > 1 && (
                        <span className="shrink-0 text-sm font-semibold text-gray-400">×{copies.length}</span>
                      )}
                      <div className="flex w-20 shrink-0 flex-col items-stretch">
                        <input
                          value={rep.priceInput}
                          onChange={(e) => updateGroup(rep, { priceInput: e.target.value })}
                          inputMode="decimal"
                          placeholder={t.pricePlaceholder}
                          className="w-full rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                        />
                        {fx && rowOre > 0 && (
                          <span className="mt-0.5 pr-1 text-right text-[10px] text-gray-400">{formatNative(rowOre, fx)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(rep.id)}
                        aria-label={t.removeRow}
                        className="px-1 text-gray-400 active:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                    {!rep.isTip && rep.shared && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1 text-sm text-gray-500">
                        <span>{t.splitWays}</span>
                        <button
                          type="button"
                          aria-label="−"
                          onClick={() => updateGroup(rep, { shareCount: Math.max(2, d - 1) })}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-lg font-semibold tabular-nums text-gray-700">{d}</span>
                        <button
                          type="button"
                          aria-label="+"
                          onClick={() => updateGroup(rep, { shareCount: Math.min(50, d + 1) })}
                          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                        >
                          +
                        </button>
                        <span className="text-gray-400">≈ {formatOre(Math.floor(rowOre / d))} SEK</span>
                      </div>
                    )}
                    {!rep.isTip && !rep.shared && sharedSuggestion(rep.description) && (
                      <div className="mt-2 pl-1 text-sm">
                        <button
                          type="button"
                          onClick={() => updateGroup(rep, { shared: true, sharers: [], shareCount: undefined })}
                          className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200 active:bg-amber-100"
                        >
                          {t.maybeShared}
                        </button>
                      </div>
                    )}
                    {rep.isTip && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1 text-sm">
                        <span className="rounded-full bg-swish/15 px-2 py-0.5 font-semibold text-swish-dark">{t.sharedToggle}</span>
                        {divisor >= 2 && (
                          <span className="text-gray-500">{t.sharedSplit(divisor, formatOre(Math.floor(rowOre / divisor)))}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {!rep.isTip && (
                    <button
                      type="button"
                      role="switch"
                      onClick={() => updateGroup(rep, { shared: !rep.shared, sharers: [], shareCount: rep.shared ? undefined : rep.shareCount })}
                      aria-checked={rep.shared}
                      aria-label={t.sharedToggle}
                      title={t.sharedToggle}
                      className="flex w-14 shrink-0 flex-col items-center justify-center gap-1.5"
                    >
                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${rep.shared ? "text-swish-dark" : "text-gray-500"}`}>
                        {t.sharedLabel}
                      </span>
                      <span
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          rep.shared ? "bg-swish" : "bg-gray-300"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                            rep.shared ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  )}
                </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" onClick={addItem} className="text-sm font-medium text-swish-dark">
                {t.addRow}
              </button>
              <button
                type="button"
                onClick={() => addMoreRef.current?.click()}
                disabled={ocrLoading}
                className="text-sm font-medium text-swish-dark disabled:opacity-50"
              >
                {ocrLoading ? t.addingPhoto : t.addPhoto}
              </button>
            </div>
            <input ref={addMoreRef} type="file" accept="image/*" onChange={onAppendFile} className="hidden" />

            <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.rowsSum}</span>
                <Money ore={itemsSumOre} className="font-semibold" />
              </div>
              {receiptTotal !== null && (
                <div className="mt-1 flex justify-between">
                  <span className="text-gray-600">{t.receiptTotalLabel}</span>
                  <Money ore={receiptTotal} className={`font-semibold ${totalReconciles ? "text-green-600" : "text-amber-600"}`} />
                </div>
              )}
              {tipOre > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-gray-600">{t.tip}</span>
                  <span className="font-semibold">+<Money ore={tipOre} /></span>
                </div>
              )}
              {receiptChargedOre > 0 && receiptChargedOre !== receiptTotal && (
                <div className="mt-1 flex justify-between border-t border-gray-100 pt-1">
                  <span className="text-gray-600">{t.chargedLabel}</span>
                  <Money ore={receiptChargedOre} className="font-semibold" />
                </div>
              )}
            </div>
            {!totalReconciles && (
              <p className="mt-1 text-xs text-amber-600">{t.totalDiff(formatOre(Math.abs(totalDiffOre)))}</p>
            )}
            {removedItems.length > 0 && (
              <details className="mt-3 rounded-xl bg-white/60 px-4 py-2 ring-1 ring-black/5">
                <summary className="cursor-pointer text-sm font-medium text-gray-500">{t.removedTitle(removedItems.length)}</summary>
                <div className="mt-2 space-y-1.5">
                  {removedItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-gray-400 line-through">{it.description || t.rowFallback}</span>
                      <span className="shrink-0 text-gray-400">{it.priceInput}</span>
                      <button type="button" onClick={() => restoreItem(it.id)} className="shrink-0 font-medium text-swish-dark active:opacity-70">
                        {t.restore}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div>
            <div className="flex flex-wrap gap-1.5">
              {t.mealPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMealLabel(preset)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${mealLabel.trim() === preset ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200 active:bg-gray-100"}`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder={t.placePlaceholder}
                aria-label={t.placePlaceholder}
                className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5 outline-none"
              />
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value || today)}
                aria-label={t.messageAria}
                className="rounded-xl bg-white px-3 py-3 text-sm shadow-sm ring-1 ring-black/5 outline-none"
              />
            </div>
            <p className="mt-1 px-1 text-xs text-gray-400">”{message}”</p>
            {roomError && <p className="mt-2 text-sm text-red-600">{roomError}</p>}
          </div>

          <details className="rounded-xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-medium text-gray-600">{t.splitYourself}</summary>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-gray-500">{t.whoElse}</h3>
              <div className="mt-2 space-y-2">
                {diners.slice(1).map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <input
                      value={d.name}
                      onChange={(e) => updateDiner(d.id, e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="flex-1 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeDiner(d.id)}
                      aria-label={t.removePerson}
                      className="px-3 text-gray-400 active:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addDiner} className="mt-2 text-sm font-medium text-swish-dark">
                {t.addPerson}
              </button>
              <button
                type="button"
                onClick={() => itemsStepValid && setStep("assign")}
                disabled={!itemsStepValid}
                className="mt-3 w-full rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200 disabled:opacity-40"
              >
                {t.assignManually}
              </button>
            </div>
          </details>
          {undoItem && (
            <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-md px-4">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2.5 text-sm text-white shadow-lg">
                <span className="min-w-0 truncate">🗑 {t.removedItem(undoItem.description || t.rowFallback)}</span>
                <button
                  type="button"
                  onClick={() => restoreItem(undoItem.id)}
                  className="shrink-0 rounded-lg bg-swish px-3 py-1 font-semibold text-white active:bg-swish-dark"
                >
                  {t.undo}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {step === "assign" && (
        <section key="assign" className="step-enter mt-6 flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t.assignTitle}</h2>
            <button type="button" onClick={spreadEverything} className="text-sm font-medium text-swish-dark">
              {t.splitAll}
            </button>
          </div>
          <p className="-mt-2 text-sm text-gray-600">{t.assignHint}</p>

          <label className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
            <span className="text-gray-600">{t.groupSizeLabel}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={groupSize || ""}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setGroupSize(v <= 0 ? 0 : Math.max(2, Math.min(50, v)));
              }}
              placeholder={String(namedDiners.length)}
              className="w-16 rounded-lg bg-gray-50 px-2 py-1 text-right outline-none"
            />
          </label>

          {CATEGORY_ORDER.map((cat) => {
            const groupItems = foodItems.filter((it) => categoryFor(it.description, it.category) === cat);
            if (groupItems.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-gray-500">
                  <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                  <span>{CATEGORY_LABEL[lang][cat]}</span>
                </div>
                {groupItems.map((it) => {
            const priceOre = parseAmountToOre(it.priceInput) ?? 0;
            const d = itemDivisorFor(it);
            const per = it.shared
              ? Math.floor(priceOre / d)
              : it.sharers.length > 0
                ? Math.floor(priceOre / it.sharers.length)
                : 0;
            const allSet = namedDiners.length > 0 && namedDiners.every((d) => it.sharers.includes(d.id));
            return (
              <div
                key={it.id}
                className={`rounded-2xl p-3 shadow-sm ring-1 ${it.shared ? "bg-swish/5 ring-swish/30" : "bg-white ring-black/5"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">
                    <span aria-hidden className="mr-1.5 inline-block align-[-0.1em] text-3xl leading-none"><ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} /></span>
                    {it.description || t.rowFallback}
                  </span>
                  <Money ore={priceOre} className="shrink-0 text-sm text-gray-600" />
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={it.shared}
                      onChange={() => toggleShared(it.id)}
                      className="h-6 w-6 rounded border-gray-300 accent-swish"
                    />
                    {t.sharedToggle}
                  </label>
                  {it.shared && (
                    <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <span>{t.splitWays}</span>
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => setShareCount(it.id, d - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-9 text-center text-lg font-semibold tabular-nums text-gray-700">{d}</span>
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setShareCount(it.id, d + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                      >
                        +
                      </button>
                      <span className="text-gray-400">≈ {formatOre(per)} SEK</span>
                    </span>
                  )}
                </div>

                {!it.shared && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {namedDiners.map((d) => {
                        const on = it.sharers.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleSharer(it.id, d.id)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                              on ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200"
                            }`}
                          >
                            {d.name}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => assignAllTo(it.id)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-swish-dark ring-1 ring-gray-200"
                      >
                        {allSet ? t.clear : t.all}
                      </button>
                    </div>
                    {it.sharers.length > 1 && <p className="mt-2 text-xs text-gray-500">{t.perPerson(formatOre(per))}</p>}
                    {it.sharers.length === 0 && <p className="mt-2 text-xs text-amber-600">{t.notAssignedYet}</p>}
                  </>
                )}
              </div>
            );
          })}
              </div>
            );
          })}

          {unassignedOre > 0 && (
            <p className="text-sm text-amber-600">{t.unassignedNote(formatOre(unassignedOre))}</p>
          )}
        </section>
      )}

      {step === "result" && (
        <section key="result" className="step-enter mt-6 flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold">{t.payTitle}</h2>

          {tipOre > 0 && (
            <div className="rounded-2xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              {t.tipSplitNote(formatOre(tipOre))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
            <span className="text-sm text-white/70">{t.toDistribute}</span>
            <Money ore={assignedTotalOre} className="font-semibold" nativeClassName="ml-1 text-xs font-normal text-white/60" />
          </div>
          {unassignedOre > 0 && (
            <p className="-mt-2 text-sm text-amber-600">{t.unassignedWarn(formatOre(unassignedOre))}</p>
          )}

          <div className="space-y-3">
            {shares.map((s) =>
              s.dinerId === payer?.id ? (
                <div
                  key={s.dinerId}
                  className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{t.payerCard(s.name)}</span>
                    <Money ore={s.totalOre} className="text-gray-600" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t.payerCardHint}</p>
                </div>
              ) : s.totalOre > 0 ? (
                <QrCard
                  key={s.dinerId}
                  name={s.name}
                  method={method}
                  amountOre={s.totalOre}
                  swishPayee={normalizedPayer || undefined}
                  iban={method === "sepa" ? normalizeIban(payeeIban) : undefined}
                  payeeName={payer?.name}
                  eurCents={method === "sepa" ? eurCentsFor(s.totalOre) : undefined}
                  message={`${s.name} - ${message}`.slice(0, 50)}
                  t={t}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {receiptOpen && images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReceiptOpen(false)}
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
            <span className="text-sm font-medium">{t.showReceipt}</span>
            <button
              type="button"
              onClick={() => setReceiptOpen(false)}
              className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium active:bg-white/25"
            >
              ✕
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto px-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              {images.map((src, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={src}
                  alt={`${t.showReceipt} ${i + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer
        step={step}
        t={t}
        message={message}
        canForward={step === "assign"}
        onCreateRoom={createRoom}
        creatingRoom={creatingRoom}
        roomReady={roomReady}
        onBack={() => {
          const order: Step[] = ["capture", "items", "assign", "result"];
          const i = order.indexOf(step);
          if (i > 0) setStep(order[i - 1]);
        }}
        onForward={() => {
          if (step === "assign") {
            persistLocalSplit();
            setStep("result");
          }
        }}
      />
    </main>
    </FxProvider>
  );
}

function Header({ step, t }: { step: Step; t: Strings }) {
  const order: { key: Step; label: string }[] = [
    { key: "capture", label: t.steps.capture },
    { key: "items", label: t.steps.items },
    { key: "assign", label: t.steps.assign },
    { key: "result", label: t.steps.pay },
  ];
  const activeIndex = order.findIndex((s) => s.key === step);
  return (
    <header className="flex items-center gap-2">
      {order.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
          <div className={`h-1.5 w-full rounded-full ${i <= activeIndex ? "bg-swish" : "bg-gray-200"}`} />
          <span className={`text-[11px] ${i === activeIndex ? "font-semibold text-swish-dark" : "text-gray-400"}`}>
            {s.label}
          </span>
        </div>
      ))}
    </header>
  );
}

function Footer({
  step,
  t,
  message,
  canForward,
  onBack,
  onForward,
  onCreateRoom,
  creatingRoom,
  roomReady,
}: {
  step: Step;
  t: Strings;
  message: string;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onCreateRoom: () => void;
  creatingRoom: boolean;
  roomReady: boolean;
}) {
  if (step === "capture") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-gray-100 px-5 py-3 font-medium active:bg-gray-200"
        >
          {t.back}
        </button>
        {step === "items" && (
          <button
            type="button"
            onClick={onCreateRoom}
            disabled={!roomReady || creatingRoom}
            className="flex-1 rounded-xl bg-swish px-5 py-3 font-semibold text-white active:bg-swish-dark disabled:opacity-40"
          >
            {creatingRoom ? t.creatingRoom : t.createRoom}
          </button>
        )}
        {step === "assign" && (
          <button
            type="button"
            onClick={onForward}
            disabled={!canForward}
            className="flex-1 rounded-xl bg-swish px-5 py-3 font-semibold text-white active:bg-swish-dark disabled:opacity-40"
          >
            {t.createQr}
          </button>
        )}
        {step === "result" && (
          <div className="flex-1 truncate text-right text-xs text-gray-500">”{message}”</div>
        )}
      </div>
    </div>
  );
}
