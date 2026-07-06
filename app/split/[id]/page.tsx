"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import { FxProvider } from "@/components/Money";
import { formatOre, parseAmountToOre } from "@/lib/money";
import { formatNative, flagEmoji, regionName, type Fx } from "@/lib/currency";
import { translations } from "@/lib/i18n";
import { readLocalSplit, saveLocalSplit, toggleLocalPaid, type LocalSplit } from "@/lib/local-split";
import { formatReceiptDate } from "@/lib/date";
import LangToggle, { saveLang } from "@/components/LangToggle";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

import type { Lang } from "@/lib/i18n";
import { detectDefaultLang } from "@/lib/locales";

const sv = {
  loading: "Laddar…",
  notFound: "Den här delningen finns bara på telefonen den skapades på.",
  toStart: "Till start",
  newReceipt: "Nytt kvitto",
  history: "Historik",
  collect: "Att få in",
  allPaid: "Allt inbetalt ✓",
  paidOf: (paid: number, total: number) => `${paid} av ${total} betalda`,
  paid: "Betald",
  markPaid: "Markera betald",
  editItems: "Rätta belopp",
  doneEditing: "Klar",
  addRow: "Lägg till",
  namePh: "Namn",
  pricePh: "0,00",
  removeRow: "Ta bort",
};
const en: typeof sv = {
  loading: "Loading…",
  notFound: "This split only exists on the device it was created on.",
  toStart: "To start",
  newReceipt: "New receipt",
  history: "History",
  collect: "To collect",
  allPaid: "All settled ✓",
  paidOf: (paid, total) => `${paid} of ${total} paid`,
  paid: "Paid",
  markPaid: "Mark paid",
  editItems: "Fix amounts",
  doneEditing: "Done",
  addRow: "Add",
  namePh: "Name",
  pricePh: "0.00",
  removeRow: "Remove",
};
const de: typeof sv = {
  loading: "Lädt…", notFound: "Diese Aufteilung existiert nur auf dem Gerät, auf dem sie erstellt wurde.",
  toStart: "Zum Start", newReceipt: "Neue Quittung", history: "Verlauf", collect: "Einzuziehen",
  allPaid: "Alles beglichen ✓", paidOf: (paid, total) => `${paid} von ${total} bezahlt`,
  paid: "Bezahlt", markPaid: "Als bezahlt markieren", editItems: "Beträge korrigieren",
  doneEditing: "Fertig", addRow: "Hinzufügen", namePh: "Name", pricePh: "0,00", removeRow: "Entfernen",
};
const fr: typeof sv = {
  loading: "Chargement…", notFound: "Ce partage n'existe que sur l'appareil où il a été créé.",
  toStart: "Pour commencer", newReceipt: "Nouveau reçu", history: "Historique", collect: "À encaisser",
  allPaid: "Tout est réglé ✓", paidOf: (paid, total) => `${paid} sur ${total} payés`,
  paid: "Payé", markPaid: "Marquer payé", editItems: "Corriger les montants",
  doneEditing: "Terminé", addRow: "Ajouter", namePh: "Nom", pricePh: "0,00", removeRow: "Supprimer",
};
const es: typeof sv = {
  loading: "Cargando…", notFound: "Esta división solo existe en el dispositivo donde se creó.",
  toStart: "Al inicio", newReceipt: "Nuevo recibo", history: "Historial", collect: "Por cobrar",
  allPaid: "Todo saldado ✓", paidOf: (paid, total) => `${paid} de ${total} pagados`,
  paid: "Pagado", markPaid: "Marcar pagado", editItems: "Corregir importes",
  doneEditing: "Listo", addRow: "Añadir", namePh: "Nombre", pricePh: "0,00", removeRow: "Eliminar",
};
const it: typeof sv = {
  loading: "Caricamento…", notFound: "Questa divisione esiste solo sul dispositivo su cui è stata creata.",
  toStart: "All'inizio", newReceipt: "Nuovo scontrino", history: "Cronologia", collect: "Da incassare",
  allPaid: "Tutto saldato ✓", paidOf: (paid, total) => `${paid} di ${total} pagati`,
  paid: "Pagato", markPaid: "Segna pagato", editItems: "Correggi importi",
  doneEditing: "Fatto", addRow: "Aggiungi", namePh: "Nome", pricePh: "0,00", removeRow: "Rimuovi",
};
const nl: typeof sv = {
  loading: "Laden…", notFound: "Deze verdeling bestaat alleen op het apparaat waarop hij is gemaakt.",
  toStart: "Naar start", newReceipt: "Nieuwe bon", history: "Geschiedenis", collect: "Te innen",
  allPaid: "Alles voldaan ✓", paidOf: (paid, total) => `${paid} van ${total} betaald`,
  paid: "Betaald", markPaid: "Markeer betaald", editItems: "Bedragen aanpassen",
  doneEditing: "Klaar", addRow: "Toevoegen", namePh: "Naam", pricePh: "0,00", removeRow: "Verwijderen",
};
const da: typeof sv = {
  loading: "Indlæser…", notFound: "Denne deling findes kun på den enhed, den blev oprettet på.",
  toStart: "Til start", newReceipt: "Ny kvittering", history: "Historik", collect: "At samle ind",
  allPaid: "Alt er betalt ✓", paidOf: (paid, total) => `${paid} af ${total} betalt`,
  paid: "Betalt", markPaid: "Markér betalt", editItems: "Ret beløb",
  doneEditing: "Færdig", addRow: "Tilføj", namePh: "Navn", pricePh: "0,00", removeRow: "Fjern",
};
const no: typeof sv = {
  loading: "Laster…", notFound: "Denne delingen finnes bare på enheten den ble opprettet på.",
  toStart: "Til start", newReceipt: "Ny kvittering", history: "Historikk", collect: "Å samle inn",
  allPaid: "Alt er gjort opp ✓", paidOf: (paid, total) => `${paid} av ${total} betalt`,
  paid: "Betalt", markPaid: "Merk betalt", editItems: "Rett beløp",
  doneEditing: "Ferdig", addRow: "Legg til", namePh: "Navn", pricePh: "0,00", removeRow: "Fjern",
};
const fi: typeof sv = {
  loading: "Ladataan…", notFound: "Tämä jako on olemassa vain laitteella, jolla se luotiin.",
  toStart: "Alkuun", newReceipt: "Uusi kuitti", history: "Historia", collect: "Kerättävää",
  allPaid: "Kaikki maksettu ✓", paidOf: (paid, total) => `${paid}/${total} maksettu`,
  paid: "Maksettu", markPaid: "Merkitse maksetuksi", editItems: "Korjaa summat",
  doneEditing: "Valmis", addRow: "Lisää", namePh: "Nimi", pricePh: "0,00", removeRow: "Poista",
};
const pl: typeof sv = {
  loading: "Ładowanie…", notFound: "Ten podział istnieje tylko na urządzeniu, na którym go utworzono.",
  toStart: "Do startu", newReceipt: "Nowy rachunek", history: "Historia", collect: "Do zebrania",
  allPaid: "Wszystko rozliczone ✓", paidOf: (paid, total) => `${paid} z ${total} zapłacono`,
  paid: "Zapłacone", markPaid: "Oznacz jako zapłacone", editItems: "Popraw kwoty",
  doneEditing: "Gotowe", addRow: "Dodaj", namePh: "Imię", pricePh: "0,00", removeRow: "Usuń",
};
const pt: typeof sv = {
  loading: "A carregar…", notFound: "Esta divisão só existe no dispositivo onde foi criada.",
  toStart: "Ao início", newReceipt: "Novo recibo", history: "Histórico", collect: "A receber",
  allPaid: "Tudo acertado ✓", paidOf: (paid, total) => `${paid} de ${total} pagos`,
  paid: "Pago", markPaid: "Marcar pago", editItems: "Corrigir valores",
  doneEditing: "Concluído", addRow: "Adicionar", namePh: "Nome", pricePh: "0,00", removeRow: "Remover",
};
const R: Record<Lang, typeof sv> = { sv, en, de, fr, es, it, nl, da, no, fi, pl, pt };

function money(ore: number, fx: Fx): string {
  const native = formatNative(ore, fx);
  return `${formatOre(ore)} SEK${native ? ` · ${native}` : ""}`;
}

export default function SplitPage() {
  const params = useParams<{ id: string | string[] }>();
  const id = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "");

  const [lang, setLang] = useState<Lang>("sv");
  const [split, setSplit] = useState<LocalSplit | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const t = R[lang];
  const tx = translations[lang];

  useEffect(() => {
    setLang(detectDefaultLang());
    setSplit(readLocalSplit(id));
  }, [id]);

  function toggle(shareId: string) {
    const next = toggleLocalPaid(id, shareId);
    if (next) setSplit({ ...next });
  }

  function update(next: LocalSplit) {
    saveLocalSplit(next);
    setSplit({ ...next });
  }
  function editShare(shareId: string, patch: { name?: string; totalOre?: number }) {
    if (!split) return;
    update({ ...split, shares: split.shares.map((s) => (s.id === shareId ? { ...s, ...patch } : s)) });
  }
  function removeShare(shareId: string) {
    if (!split) return;
    update({
      ...split,
      shares: split.shares.filter((s) => s.id !== shareId),
      paidBy: split.paidBy.filter((p) => p !== shareId),
    });
  }
  function addShare() {
    const ore = parseAmountToOre(newAmount) ?? 0;
    if (!split || !newName.trim() || ore <= 0) return;
    update({ ...split, shares: [...split.shares, { id: uid(), name: newName.trim(), totalOre: ore }] });
    setNewName("");
    setNewAmount("");
  }

  if (split === undefined) return <Centered>{t.loading}</Centered>;
  if (!split)
    return (
      <Centered>
        <p>{t.notFound}</p>
        <HomeLink label={t.toStart} />
      </Centered>
    );

  const fx: Fx = split.currency !== "SEK" && split.rate > 0 ? { currency: split.currency, rate: split.rate } : null;
  const paid = new Set(split.paidBy);
  const payees = split.shares.filter((s) => s.totalOre > 0);
  const paidCount = payees.filter((s) => paid.has(s.id)).length;
  const outstanding = payees.filter((s) => !paid.has(s.id)).reduce((a, s) => a + s.totalOre, 0);
  const eurCentsFor = (ore: number) => (split.rate > 0 ? Math.round(ore / split.rate) : 0);

  return (
    <FxProvider value={fx}>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-16 pt-5">
        <nav className="flex items-center justify-between gap-2 text-xs font-semibold">
          <a href="/" className="inline-flex items-center gap-1 rounded-full bg-swish px-3 py-1.5 text-white active:bg-swish-dark">
            + {t.newReceipt}
          </a>
          <div className="flex items-center gap-2">
            <a href="/history" className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-swish-dark ring-1 ring-gray-200 active:bg-gray-100">
              🕘 {t.history}
            </a>
            <LangToggle lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
          </div>
        </nav>

        <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="truncate text-lg font-bold">{split.place || "Kvitt"}</p>
          <p className="text-sm text-gray-500">{formatReceiptDate(split.date, lang)}</p>
          {fx && (
            <p className="mt-0.5 text-xs text-gray-400">
              {split.country ? `${flagEmoji(split.country)} ${regionName(split.country, lang)} · ` : ""}
              {`1 ${fx.currency} ≈ ${formatOre(Math.round(fx.rate * 100))} SEK`}
            </p>
          )}
          <div className="mt-2 flex items-baseline justify-between border-t border-gray-100 pt-2">
            <span className="text-sm text-gray-500">{outstanding > 0 ? t.paidOf(paidCount, payees.length) : t.allPaid}</span>
            {outstanding > 0 && <span className="font-semibold text-swish-dark">{money(outstanding, fx)}</span>}
          </div>
        </header>

        {!editing && (
          <div className="-mt-1 flex justify-end">
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium text-swish-dark active:opacity-70">
              ✏️ {t.editItems}
            </button>
          </div>
        )}

        {editing ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.editItems}</h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full bg-swish px-4 py-1.5 text-sm font-semibold text-white active:bg-swish-dark"
              >
                {t.doneEditing}
              </button>
            </div>
            <div className="space-y-2">
              {split.shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
                  <input
                    defaultValue={s.name}
                    onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== s.name && editShare(s.id, { name: e.target.value.trim() })}
                    placeholder={t.namePh}
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                  />
                  <input
                    defaultValue={formatOre(s.totalOre)}
                    onBlur={(e) => {
                      const o = parseAmountToOre(e.target.value);
                      if (o != null && o !== s.totalOre) editShare(s.id, { totalOre: o });
                    }}
                    inputMode="decimal"
                    placeholder={t.pricePh}
                    className="w-24 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                  />
                  <button type="button" onClick={() => removeShare(s.id)} aria-label={t.removeRow} className="px-1 text-gray-400 active:text-red-500">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.namePh}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
              />
              <input
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                inputMode="decimal"
                placeholder={t.pricePh}
                className="w-24 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
              />
              <button
                type="button"
                onClick={addShare}
                disabled={!newName.trim() || (parseAmountToOre(newAmount) ?? 0) <= 0}
                className="rounded-lg bg-swish px-3 py-2 text-sm font-semibold text-white active:bg-swish-dark disabled:opacity-40"
              >
                {t.addRow}
              </button>
            </div>
          </section>
        ) : (
          <div className="space-y-3">
            {payees.map((s) =>
              paid.has(s.id) ? (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-black/5"
                >
                  <span className="font-medium text-emerald-600">✓ {s.name}</span>
                  <span className="text-sm text-gray-400 line-through">{money(s.totalOre, fx)}</span>
                </button>
              ) : (
                <div key={s.id}>
                  <QrCard
                    name={s.name}
                    method={split.method === "sepa" ? "sepa" : "swish"}
                    amountOre={s.totalOre}
                    swishPayee={split.payeeNumber || undefined}
                    iban={split.method === "sepa" ? split.payeeIban : undefined}
                    payeeName={split.payeeName}
                    eurCents={split.method === "sepa" ? eurCentsFor(s.totalOre) : undefined}
                    message={`${s.name} - ${split.message}`.slice(0, 50)}
                    t={tx}
                  />
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="mt-2 w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-ink active:bg-gray-200"
                  >
                    {t.markPaid}
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </main>
    </FxProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center text-gray-600">
      {children}
    </main>
  );
}

function HomeLink({ label }: { label: string }) {
  return (
    <a href="/" className="rounded-xl bg-swish px-5 py-2.5 text-sm font-semibold text-white active:bg-swish-dark">
      {label}
    </a>
  );
}
