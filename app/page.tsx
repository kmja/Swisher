"use client";

import { useMemo, useRef, useState } from "react";
import QrCard from "@/components/QrCard";
import { computeShares, formatOre, parseAmountToOre } from "@/lib/money";
import { isValidPhone, normalizePhone } from "@/lib/swish";
import type { Diner, LineItem } from "@/lib/types";

type Step = "capture" | "items" | "assign" | "result";
type UiItem = { id: string; description: string; priceInput: string; sharers: string[] };

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const STEPS: { key: Step; label: string }[] = [
  { key: "capture", label: "Foto" },
  { key: "items", label: "Rader" },
  { key: "assign", label: "Fördela" },
  { key: "result", label: "Betala" },
];

/** Downscale a photo to keep the OCR upload small and fast. */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Kunde inte läsa filen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Kunde inte läsa bilden."));
      img.onload = () => {
        const maxDim = 1600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [step, setStep] = useState<Step>("capture");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const [items, setItems] = useState<UiItem[]>([]);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null); // öre

  const [diners, setDiners] = useState<Diner[]>([{ id: uid(), name: "" }]);
  const [payerPhone, setPayerPhone] = useState("");

  const today = new Date().toISOString().slice(0, 10);
  const [mealLabel, setMealLabel] = useState("Middag");

  const [tipPercent, setTipPercent] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const message = useMemo(
    () => `${mealLabel} ${today} – din del`.slice(0, 50),
    [mealLabel, today],
  );

  // --- capture ---------------------------------------------------------------
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageUrl(dataUrl);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Kunde inte läsa bilden.");
    }
  }

  async function runOcr() {
    if (!imageUrl) return;
    setOcrLoading(true);
    setOcrError(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Avläsningen misslyckades.");
      setItems(
        (data.items as { description: string; price: number }[]).map((it) => ({
          id: uid(),
          description: it.description,
          priceInput: formatOre(Math.round(it.price * 100)),
          sharers: [],
        })),
      );
      setReceiptTotal(typeof data.total === "number" ? Math.round(data.total * 100) : null);
      setStep("items");
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Avläsningen misslyckades.");
    } finally {
      setOcrLoading(false);
    }
  }

  function skipToManual() {
    if (items.length === 0) {
      setItems([{ id: uid(), description: "", priceInput: "", sharers: [] }]);
    }
    setStep("items");
  }

  // --- items -----------------------------------------------------------------
  const updateItem = (id: string, patch: Partial<UiItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: "", priceInput: "", sharers: [] }]);
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
    setItems((prev) => prev.map((it) => ({ ...it, sharers: everyone })));
  }

  // --- compute ---------------------------------------------------------------
  const lineItems: LineItem[] = useMemo(
    () =>
      validItems.map((it) => ({
        id: it.id,
        description: it.description,
        priceOre: parseAmountToOre(it.priceInput) ?? 0,
        sharers: it.sharers,
      })),
    [validItems],
  );

  const { shares, unassignedOre } = useMemo(
    () => computeShares(lineItems, namedDiners, tipPercent),
    [lineItems, namedDiners, tipPercent],
  );

  const payer = namedDiners[0];
  const normalizedPayer = normalizePhone(payerPhone) ?? "";
  const assignedTotalOre = shares.reduce((acc, s) => acc + s.totalOre, 0);

  // --- render ----------------------------------------------------------------
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-28 pt-5">
      <Header step={step} />

      {step === "capture" && (
        <section className="mt-6 flex flex-1 flex-col">
          <h1 className="text-2xl font-bold">Dela kvittot</h1>
          <p className="mt-1 text-sm text-gray-600">
            Fota kvittot, peta i vem som åt vad, och få en låst Swish-QR per person.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Kvitto" className="max-h-[46vh] w-full object-contain" />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-56 w-full flex-col items-center justify-center gap-2 text-gray-500"
              >
                <span className="text-4xl">📷</span>
                <span className="font-medium">Tryck för att fota kvittot</span>
              </button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFile}
            className="hidden"
          />

          {ocrError && <p className="mt-3 text-sm text-red-600">{ocrError}</p>}

          <div className="mt-5 space-y-2">
            {imageUrl && (
              <>
                <button
                  type="button"
                  onClick={runOcr}
                  disabled={ocrLoading}
                  className="w-full rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark disabled:opacity-60"
                >
                  {ocrLoading ? "Läser av…" : "Läs av kvittot"}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200"
                >
                  Välj annan bild
                </button>
              </>
            )}
            {!imageUrl && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark"
              >
                Fota eller välj bild
              </button>
            )}
            <button
              type="button"
              onClick={skipToManual}
              className="w-full rounded-xl px-4 py-3 font-medium text-gray-600 active:bg-gray-100"
            >
              Hoppa över – skriv in själv
            </button>
          </div>
        </section>
      )}

      {step === "items" && (
        <section className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold">Rader</h2>
            <p className="text-sm text-gray-600">Kontrollera och rätta avläsningen. Priser inkl. moms.</p>
            <div className="mt-3 space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
                  <input
                    value={it.description}
                    onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    placeholder="Beskrivning"
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                  />
                  <input
                    value={it.priceInput}
                    onChange={(e) => updateItem(it.id, { priceInput: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="w-24 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    aria-label="Ta bort rad"
                    className="px-2 text-gray-400 active:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 text-sm font-medium text-swish-dark">
              + Lägg till rad
            </button>

            <div className="mt-3 flex justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
              <span className="text-gray-600">Summa rader</span>
              <span className="font-semibold">{formatOre(itemsSumOre)} kr</span>
            </div>
            {receiptTotal !== null && Math.abs(receiptTotal - itemsSumOre) > 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Kvittots total ({formatOre(receiptTotal)} kr) skiljer sig från summan av raderna.
              </p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold">Vem la ut för notan?</h2>
            <p className="text-sm text-gray-600">Den första personen får pengarna via Swish.</p>
            <input
              value={diners[0]?.name ?? ""}
              onChange={(e) => updateDiner(diners[0].id, e.target.value)}
              placeholder="Ditt namn"
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
            />
            <input
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
              inputMode="tel"
              placeholder="Swish-nummer (07XXXXXXXX)"
              className="mt-2 w-full rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
            />
            {payerPhone && !isValidPhone(payerPhone) && (
              <p className="mt-1 text-xs text-red-600">Ange ett giltigt svenskt mobilnummer.</p>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold">Vilka fler var med?</h2>
            <div className="mt-2 space-y-2">
              {diners.slice(1).map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <input
                    value={d.name}
                    onChange={(e) => updateDiner(d.id, e.target.value)}
                    placeholder="Namn"
                    className="flex-1 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeDiner(d.id)}
                    aria-label="Ta bort person"
                    className="px-3 text-gray-400 active:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addDiner} className="mt-2 text-sm font-medium text-swish-dark">
              + Lägg till person
            </button>
          </div>
        </section>
      )}

      {step === "assign" && (
        <section className="mt-6 flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Fördela rader</h2>
            <button type="button" onClick={spreadEverything} className="text-sm font-medium text-swish-dark">
              Dela allt lika
            </button>
          </div>
          <p className="-mt-2 text-sm text-gray-600">Tryck på namnen som var med på varje rad.</p>

          {validItems.map((it) => {
            const priceOre = parseAmountToOre(it.priceInput) ?? 0;
            const per = it.sharers.length > 0 ? Math.floor(priceOre / it.sharers.length) : 0;
            const allSet = namedDiners.length > 0 && namedDiners.every((d) => it.sharers.includes(d.id));
            return (
              <div key={it.id} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{it.description || "Rad"}</span>
                  <span className="shrink-0 text-sm text-gray-600">{formatOre(priceOre)} kr</span>
                </div>
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
                    {allSet ? "Rensa" : "Alla"}
                  </button>
                </div>
                {it.sharers.length > 1 && (
                  <p className="mt-2 text-xs text-gray-500">≈ {formatOre(per)} kr per person</p>
                )}
                {it.sharers.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">Inte fördelad än</p>
                )}
              </div>
            );
          })}

          {unassignedOre > 0 && (
            <p className="text-sm text-amber-600">
              {formatOre(unassignedOre)} kr är inte fördelat och räknas inte med.
            </p>
          )}
        </section>
      )}

      {step === "result" && (
        <section className="mt-6 flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold">Betala</h2>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <span className="font-medium">Dricks</span>
              <span className="text-sm text-gray-600">{tipPercent}%</span>
            </div>
            <div className="mt-2 flex gap-2">
              {[0, 5, 10, 15].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTipPercent(p)}
                  className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ring-1 ${
                    tipPercent === p ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200"
                  }`}
                >
                  {p === 0 ? "Ingen" : `${p}%`}
                </button>
              ))}
            </div>
            <label className="mt-2 block text-xs text-gray-500">
              Eget värde (%)
              <input
                type="number"
                min={0}
                max={100}
                value={tipPercent}
                onChange={(e) => setTipPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                className="ml-2 w-16 rounded-lg bg-gray-50 px-2 py-1 text-ink outline-none"
              />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
            <span className="text-sm text-white/70">Att fördela</span>
            <span className="font-semibold">{formatOre(assignedTotalOre)} kr</span>
          </div>
          {unassignedOre > 0 && (
            <p className="-mt-2 text-sm text-amber-600">
              Obs: {formatOre(unassignedOre)} kr är inte fördelat.
            </p>
          )}

          <div className="space-y-3">
            {shares.map((s) =>
              s.dinerId === payer?.id ? (
                <div
                  key={s.dinerId}
                  className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{s.name} (du – får pengarna)</span>
                    <span className="text-gray-600">{formatOre(s.totalOre)} kr</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Din egen del. Du swishar inte dig själv.</p>
                </div>
              ) : s.totalOre > 0 ? (
                <QrCard
                  key={s.dinerId}
                  name={s.name}
                  payee={normalizedPayer}
                  amountOre={s.totalOre}
                  message={message}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      <Footer
        step={step}
        message={message}
        mealLabel={mealLabel}
        setMealLabel={setMealLabel}
        canForward={
          (step === "capture" && false) ||
          (step === "items" && itemsStepValid) ||
          step === "assign"
        }
        onBack={() => {
          const order: Step[] = ["capture", "items", "assign", "result"];
          const i = order.indexOf(step);
          if (i > 0) setStep(order[i - 1]);
        }}
        onForward={() => {
          if (step === "items") setStep("assign");
          else if (step === "assign") setStep("result");
        }}
      />
    </main>
  );
}

function Header({ step }: { step: Step }) {
  const activeIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <header className="flex items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
          <div
            className={`h-1.5 w-full rounded-full ${i <= activeIndex ? "bg-swish" : "bg-gray-200"}`}
          />
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
  message,
  mealLabel,
  setMealLabel,
  canForward,
  onBack,
  onForward,
}: {
  step: Step;
  message: string;
  mealLabel: string;
  setMealLabel: (v: string) => void;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
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
          Tillbaka
        </button>
        {step === "items" && (
          <input
            value={mealLabel}
            onChange={(e) => setMealLabel(e.target.value)}
            placeholder="Meddelande"
            aria-label="Meddelande-etikett"
            className="min-w-0 flex-1 rounded-xl bg-gray-50 px-3 py-3 text-sm outline-none"
          />
        )}
        {step === "result" ? (
          <div className="flex-1 truncate text-right text-xs text-gray-500">”{message}”</div>
        ) : (
          <button
            type="button"
            onClick={onForward}
            disabled={!canForward}
            className="flex-1 rounded-xl bg-swish px-5 py-3 font-semibold text-white active:bg-swish-dark disabled:opacity-40"
          >
            {step === "assign" ? "Skapa QR-koder" : "Vidare"}
          </button>
        )}
      </div>
    </div>
  );
}
