"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrCard from "@/components/QrCard";
import { computeShares, formatOre, parseAmountToOre, splitOre } from "@/lib/money";
import { isValidPhone, normalizePhone } from "@/lib/swish";
import { translations, type Lang, type Strings } from "@/lib/i18n";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER } from "@/lib/categories";
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
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Grayscale + mild contrast, to give a cleaner "scanned" look and help OCR
 * on faint thermal receipts. Kept gentle so faint text isn't lost. */
function enhanceForScan(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const contrast = 1.35;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      let v = contrast * g + intercept;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i] = d[i + 1] = d[i + 2] = v;
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
        const maxDim = 1280;
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
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);

  const [items, setItems] = useState<UiItem[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null); // öre
  const [zoomItem, setZoomItem] = useState<number | null>(null);
  const zoomScrollRef = useRef<HTMLDivElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const [diners, setDiners] = useState<Diner[]>([{ id: uid(), name: "" }]);
  const [payerPhone, setPayerPhone] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [mealLabel, setMealLabel] = useState(translations.sv.mealDefault);
  const [eventDate, setEventDate] = useState(today);

  const [receiptTipOre, setReceiptTipOre] = useState(0);

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
    () => `${mealLabel} ${eventDate}${t.shareSuffix}`.slice(0, 50),
    [mealLabel, eventDate, t.shareSuffix],
  );

  // Remember the host across sessions so they don't retype their name/number.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("swisher-host") || "null");
      if (saved?.name) setDiners((prev) => prev.map((d, i) => (i === 0 ? { ...d, name: String(saved.name) } : d)));
      if (saved?.number) setPayerPhone(String(saved.number));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const name = diners[0]?.name?.trim();
    if (name && isValidPhone(payerPhone)) {
      try {
        localStorage.setItem("swisher-host", JSON.stringify({ name, number: payerPhone }));
      } catch {
        /* ignore */
      }
    }
  }, [diners, payerPhone]);

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
    const maxDim = 1280;
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
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
      const mapped: UiItem[] = (
        data.items as { description: string; price: number; shared?: boolean; category?: string }[]
      ).map((it) => ({
        id: uid(),
        description: it.description,
        priceInput: formatOre(Math.round(it.price * 100)),
        sharers: [],
        shared: it.shared === true,
        category: it.category ?? "",
        imgIndex,
      }));
      setImages((prev) => (append ? [...prev, img] : [img]));
      setOcrLoading(false);

      if (append) {
        setItems((prev) => [...prev, ...mapped]);
        return;
      }

      setItems(mapped);
      setReceiptTotal(typeof data.total === "number" ? Math.round(data.total * 100) : null);
      setReceiptTipOre(typeof data.dricks === "number" && data.dricks > 0 ? Math.round(data.dricks * 100) : 0);
      if (typeof data.place === "string" && data.place.trim()) setMealLabel(data.place.trim().slice(0, 40));
      if (typeof data.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) setEventDate(data.date);
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
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: "", priceInput: "", sharers: [], shared: false, category: "", imgIndex: -1 }]);
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.id !== id));

  const updateDiner = (id: string, name: string) =>
    setDiners((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  const addDiner = () => setDiners((prev) => [...prev, { id: uid(), name: "" }]);
  const removeDiner = (id: string) => {
    setDiners((prev) => prev.filter((d) => d.id !== id));
    setItems((prev) => prev.map((it) => ({ ...it, sharers: it.sharers.filter((s) => s !== id) })));
  };

  const namedDiners = diners.filter((d) => d.name.trim());
  const itemsSumOre = items.reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
  const validItems = items.filter((it) => (parseAmountToOre(it.priceInput) ?? 0) > 0);
  const hasSharedItems = validItems.some((it) => it.shared);

  const itemsStepValid =
    validItems.length > 0 && namedDiners.length >= 2 && isValidPhone(payerPhone);

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
      prev.map((it) => (it.id === itemId ? { ...it, shared: !it.shared, sharers: [] } : it)),
    );
  }

  // --- live room -------------------------------------------------------------
  const roomReady = validItems.length > 0 && !!diners[0]?.name.trim() && isValidPhone(payerPhone);

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
          message,
          place: mealLabel.trim(),
          date: eventDate,
          tipOre: receiptTipOre,
          items: validItems.flatMap((it) => {
            const priceOre = parseAmountToOre(it.priceInput) ?? 0;
            const desc = it.description.trim() || t.rowFallback;
            const category = categoryFor(it.description, it.category);
            // A shared item with a known group size becomes that many claimable
            // share-slots, so diners can each take one (or several for a partner).
            if (it.shared && groupSize >= 2) {
              return splitOre(priceOre, groupSize).map((slotOre, i) => ({
                description: `${desc} (${i + 1}/${groupSize})`,
                priceOre: slotOre,
                category,
              }));
            }
            return [{ description: desc, priceOre, category }];
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the room.");
      try {
        localStorage.setItem(`swisher-room:${data.id}`, data.personId);
      } catch {
        /* storage unavailable */
      }
      router.push(`/room/${data.id}`);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Could not create the room.");
      setCreatingRoom(false);
    }
  }

  // --- compute ---------------------------------------------------------------
  const lineItems: LineItem[] = useMemo(
    () =>
      validItems.map((it) => ({
        id: it.id,
        description: it.description,
        priceOre: parseAmountToOre(it.priceInput) ?? 0,
        sharers: it.sharers,
        shared: it.shared,
      })),
    [validItems],
  );

  const { shares, unassignedOre } = useMemo(
    () => computeShares(lineItems, namedDiners, receiptTipOre, groupSize),
    [lineItems, namedDiners, receiptTipOre, groupSize],
  );

  const payer = namedDiners[0];
  const normalizedPayer = normalizePhone(payerPhone) ?? "";
  const assignedTotalOre = shares.reduce((acc, s) => acc + s.totalOre, 0);

  // --- render ----------------------------------------------------------------
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-5">
      <div className="mb-3 flex justify-end">
        <LangToggle lang={lang} onChange={(l) => applyLang(l, lang)} />
      </div>

      <Header step={step} t={t} />

      {step === "capture" && (
        <section className="mt-6 flex flex-1 flex-col">
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-gray-600">{t.intro}</p>

          <div className="relative mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="max-h-[46vh] w-full object-contain" />
            ) : null}
            {ocrLoading && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="scanline absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-swish/50 to-transparent" />
                <div className="scan-pulse absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-swish" />
              </div>
            )}
            {imageUrl ? null : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-72 w-full bg-black object-cover ${cameraActive ? "" : "invisible"}`}
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

          <div className="mt-5 space-y-2">
            {ocrLoading ? (
              <div className="py-4 text-center text-sm font-semibold text-swish-dark">{t.scanning}</div>
            ) : scanCount !== null ? (
              <div className="flex flex-col items-center gap-1 py-3">
                <span className="text-5xl font-bold tabular-nums text-swish-dark">{scanCount}</span>
                <span className="text-sm text-gray-600">{t.itemsFound(scanCount)}</span>
              </div>
            ) : (
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
                <button
                  type="button"
                  onClick={skipToManual}
                  className="w-full rounded-xl px-4 py-3 font-medium text-gray-600 active:bg-gray-100"
                >
                  {t.skipManual}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {step === "items" && (
        <section className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold">{t.itemsTitle}</h2>
            <p className="text-sm text-gray-600">{t.itemsHint}</p>
            <div className="mt-3 space-y-2">
              {items.map((it, idx) => (
                <div key={it.id} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
                  <span aria-hidden className="pl-1 text-lg">
                    {CATEGORY_EMOJI[categoryFor(it.description, it.category)]}
                  </span>
                  <input
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    placeholder={t.descPlaceholder}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                  />
                  <input
                    value={it.priceInput}
                    onChange={(e) => updateItem(it.id, { priceInput: e.target.value })}
                    inputMode="decimal"
                    placeholder={t.pricePlaceholder}
                    className="w-20 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                  />
                  {it.imgIndex >= 0 && images[it.imgIndex] && (
                    <button
                      type="button"
                      onClick={() => setZoomItem(idx)}
                      aria-label={t.viewSource}
                      className="px-1 text-gray-400 active:text-swish-dark"
                    >
                      🔍
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    aria-label={t.removeRow}
                    className="px-1 text-gray-400 active:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
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

            <div className="mt-3 flex justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
              <span className="text-gray-600">{t.rowsSum}</span>
              <span className="font-semibold">
                {formatOre(itemsSumOre)} {t.currency}
              </span>
            </div>
            {receiptTotal !== null && Math.abs(receiptTotal - itemsSumOre) > 0 && (
              <p className="mt-1 text-xs text-amber-600">{t.totalMismatch(formatOre(receiptTotal))}</p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold">{t.payerTitle}</h2>
            <p className="text-sm text-gray-600">{t.payerHint}</p>
            <input
              value={diners[0]?.name ?? ""}
              onChange={(e) => updateDiner(diners[0].id, e.target.value)}
              placeholder={t.yourName}
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
            />
            <input
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              inputMode="tel"
              placeholder={t.swishNumber}
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
            />
            {payerPhone && !isValidPhone(payerPhone) && (
              <p className="mt-1 text-xs text-red-600">{t.invalidPhone}</p>
            )}
          </div>

          <div>
            {hasSharedItems && (
              <div className="rounded-xl bg-swish/5 px-4 py-3 ring-1 ring-swish/20">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-700">{t.sharedGroupPrompt}</span>
                  <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="−"
                    onClick={() => setGroupSize(Math.max(0, groupSize - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xl font-bold text-gray-600 active:bg-gray-200"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-lg font-semibold tabular-nums">{groupSize || "–"}</span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => setGroupSize(Math.min(50, groupSize + 1))}
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
            <div className="mt-3 flex gap-2">
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
        </section>
      )}

      {step === "assign" && (
        <section className="mt-6 flex flex-1 flex-col gap-3">
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
              onChange={(e) => setGroupSize(Math.max(0, Math.min(50, Number(e.target.value) || 0)))}
              placeholder={String(namedDiners.length)}
              className="w-16 rounded-lg bg-gray-50 px-2 py-1 text-right outline-none"
            />
          </label>

          {CATEGORY_ORDER.map((cat) => {
            const groupItems = validItems.filter((it) => categoryFor(it.description, it.category) === cat);
            if (groupItems.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-gray-500">
                  <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                  <span>{CATEGORY_LABEL[lang][cat]}</span>
                </div>
                {groupItems.map((it) => {
            const priceOre = parseAmountToOre(it.priceInput) ?? 0;
            const sharedDivisor = groupSize > 0 ? groupSize : namedDiners.length;
            const per = it.shared
              ? sharedDivisor > 0
                ? Math.floor(priceOre / sharedDivisor)
                : 0
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
                  <span className="truncate font-medium">{it.description || t.rowFallback}</span>
                  <span className="shrink-0 text-sm text-gray-600">
                    {formatOre(priceOre)} {t.currency}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleShared(it.id)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 ${
                      it.shared ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200"
                    }`}
                  >
                    {t.sharedToggle}
                  </button>
                  {it.shared && <span className="text-xs text-gray-500">{t.sharedSplit(sharedDivisor, formatOre(per))}</span>}
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
        <section className="mt-6 flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold">{t.payTitle}</h2>

          {receiptTipOre > 0 && (
            <div className="rounded-2xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              {t.tipSplitNote(formatOre(receiptTipOre))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
            <span className="text-sm text-white/70">{t.toDistribute}</span>
            <span className="font-semibold">
              {formatOre(assignedTotalOre)} {t.currency}
            </span>
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
                    <span className="text-gray-600">
                      {formatOre(s.totalOre)} {t.currency}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t.payerCardHint}</p>
                </div>
              ) : s.totalOre > 0 ? (
                <QrCard
                  key={s.dinerId}
                  name={s.name}
                  payee={normalizedPayer}
                  amountOre={s.totalOre}
                  message={message}
                  t={t}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {(() => {
        if (zoomItem === null) return null;
        const it = items[zoomItem];
        const src = it && it.imgIndex >= 0 ? images[it.imgIndex] : null;
        if (!src) return null;
        const sameImg = items.filter((x) => x.imgIndex === it.imgIndex);
        const pos = Math.max(0, sameImg.indexOf(it));
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
            <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
              <span className="min-w-0 truncate text-sm font-medium">{it.description || t.viewSource}</span>
              <button
                type="button"
                onClick={() => setZoomItem(null)}
                className="shrink-0 rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium"
              >
                ✕
              </button>
            </div>
            <p className="px-4 pb-2 text-center text-xs text-white/60">{t.viewSourceHint}</p>
            <div ref={zoomScrollRef} className="flex-1 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                onLoad={(e) => {
                  const c = zoomScrollRef.current;
                  if (!c || sameImg.length === 0) return;
                  const frac = (pos + 0.5) / sameImg.length;
                  c.scrollTop = Math.max(0, frac * e.currentTarget.clientHeight - c.clientHeight / 2);
                }}
                className="w-[230%] max-w-none"
              />
            </div>
          </div>
        );
      })()}

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
          if (step === "assign") setStep("result");
        }}
      />
    </main>
  );
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-full bg-white text-xs font-semibold ring-1 ring-gray-200">
      {(["sv", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onChange(l)}
          className={`px-3 py-1.5 ${lang === l ? "bg-swish text-white" : "text-gray-500 active:bg-gray-100"}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
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
