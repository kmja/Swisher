"use client";

import { useEffect, useState } from "react";
import { computeRoomShares, formatOre } from "@/lib/money";
import { formatNative, type Fx } from "@/lib/currency";
import { readHistory, removeHistory, type HistoryEntry } from "@/lib/history";
import { formatReceiptDate } from "@/lib/date";
import { readLocalSplit, removeLocalSplit } from "@/lib/local-split";
import LangToggle, { saveLang } from "@/components/LangToggle";
import KvittLogo from "@/components/KvittLogo";
import type { RoomState } from "@/lib/room-do";
import type { Diner } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { detectDefaultLang } from "@/lib/locales";

const sv = {
  title: "Historik",
  empty: "Inga delade kvitton än.",
  emptyHint: "Skanna ett kvitto och bjud in – så dyker det upp här.",
  newReceipt: "Dela nytt kvitto",
  loading: "Laddar…",
  gone: "Rummet är inte längre tillgängligt",
  remove: "Ta bort",
  host: "Du samlar in",
  guest: "Din del",
  paidOf: (paid: number, total: number) => `${paid} av ${total} betalda`,
  outstanding: (amt: string) => `${amt} kvar att få in`,
  allSettled: "Allt inbetalt ✓",
  waitingForGuests: "Väntar på gäster…",
  youOwe: (amt: string) => `Du ska betala ${amt}`,
  youPaid: "Du har betalat ✓",
  nothing: "Inget att betala",
};
const en: typeof sv = {
  title: "History",
  empty: "No split receipts yet.",
  emptyHint: "Scan a receipt and invite people — it'll show up here.",
  newReceipt: "Split a new receipt",
  loading: "Loading…",
  gone: "Room no longer available",
  remove: "Remove",
  host: "You collect",
  guest: "Your share",
  paidOf: (paid, total) => `${paid} of ${total} paid`,
  outstanding: (amt) => `${amt} outstanding`,
  allSettled: "All settled ✓",
  waitingForGuests: "Waiting for guests…",
  youOwe: (amt) => `You owe ${amt}`,
  youPaid: "You're paid up ✓",
  nothing: "Nothing to pay",
};
const de: typeof sv = {
  title: "Verlauf", empty: "Noch keine geteilten Quittungen.",
  emptyHint: "Scanne eine Quittung und lade Leute ein – sie erscheint dann hier.",
  newReceipt: "Neue Quittung teilen", loading: "Lädt…", gone: "Raum nicht mehr verfügbar",
  remove: "Entfernen", host: "Du kassierst", guest: "Dein Anteil",
  paidOf: (paid, total) => `${paid} von ${total} bezahlt`,
  outstanding: (amt) => `${amt} ausstehend`, allSettled: "Alles beglichen ✓",
  waitingForGuests: "Warte auf Gäste…", youOwe: (amt) => `Du schuldest ${amt}`,
  youPaid: "Du hast bezahlt ✓", nothing: "Nichts zu bezahlen",
};
const fr: typeof sv = {
  title: "Historique", empty: "Aucun reçu partagé pour l'instant.",
  emptyHint: "Scanne un reçu et invite des gens — il apparaîtra ici.",
  newReceipt: "Partager un nouveau reçu", loading: "Chargement…", gone: "Salle non disponible",
  remove: "Supprimer", host: "Tu encaisses", guest: "Ta part",
  paidOf: (paid, total) => `${paid} sur ${total} payés`,
  outstanding: (amt) => `${amt} en attente`, allSettled: "Tout est réglé ✓",
  waitingForGuests: "En attente des invités…", youOwe: (amt) => `Tu dois ${amt}`,
  youPaid: "Tu as payé ✓", nothing: "Rien à payer",
};
const es: typeof sv = {
  title: "Historial", empty: "Aún no hay recibos compartidos.",
  emptyHint: "Escanea un recibo e invita a la gente: aparecerá aquí.",
  newReceipt: "Compartir un recibo nuevo", loading: "Cargando…", gone: "Sala ya no disponible",
  remove: "Eliminar", host: "Tú cobras", guest: "Tu parte",
  paidOf: (paid, total) => `${paid} de ${total} pagados`,
  outstanding: (amt) => `${amt} pendiente`, allSettled: "Todo saldado ✓",
  waitingForGuests: "Esperando a los invitados…", youOwe: (amt) => `Debes ${amt}`,
  youPaid: "Has pagado ✓", nothing: "Nada que pagar",
};
const it: typeof sv = {
  title: "Cronologia", empty: "Ancora nessuno scontrino diviso.",
  emptyHint: "Scansiona uno scontrino e invita le persone: apparirà qui.",
  newReceipt: "Dividi un nuovo scontrino", loading: "Caricamento…", gone: "Stanza non più disponibile",
  remove: "Rimuovi", host: "Incassi tu", guest: "La tua parte",
  paidOf: (paid, total) => `${paid} di ${total} pagati`,
  outstanding: (amt) => `${amt} in sospeso`, allSettled: "Tutto saldato ✓",
  waitingForGuests: "In attesa degli ospiti…", youOwe: (amt) => `Devi ${amt}`,
  youPaid: "Hai pagato ✓", nothing: "Niente da pagare",
};
const nl: typeof sv = {
  title: "Geschiedenis", empty: "Nog geen gedeelde bonnetjes.",
  emptyHint: "Scan een bon en nodig mensen uit — hij verschijnt hier.",
  newReceipt: "Nieuwe bon delen", loading: "Laden…", gone: "Kamer niet meer beschikbaar",
  remove: "Verwijderen", host: "Jij int", guest: "Jouw deel",
  paidOf: (paid, total) => `${paid} van ${total} betaald`,
  outstanding: (amt) => `${amt} openstaand`, allSettled: "Alles voldaan ✓",
  waitingForGuests: "Wachten op gasten…", youOwe: (amt) => `Je moet ${amt} betalen`,
  youPaid: "Je hebt betaald ✓", nothing: "Niets te betalen",
};
const da: typeof sv = {
  title: "Historik", empty: "Ingen delte kvitteringer endnu.",
  emptyHint: "Scan en kvittering og inviter folk – så dukker den op her.",
  newReceipt: "Del en ny kvittering", loading: "Indlæser…", gone: "Rummet er ikke længere tilgængeligt",
  remove: "Fjern", host: "Du samler ind", guest: "Din del",
  paidOf: (paid, total) => `${paid} af ${total} betalt`,
  outstanding: (amt) => `${amt} tilbage`, allSettled: "Alt er betalt ✓",
  waitingForGuests: "Venter på gæster…", youOwe: (amt) => `Du skal betale ${amt}`,
  youPaid: "Du har betalt ✓", nothing: "Intet at betale",
};
const no: typeof sv = {
  title: "Historikk", empty: "Ingen delte kvitteringer ennå.",
  emptyHint: "Skann en kvittering og inviter folk – så dukker den opp her.",
  newReceipt: "Del en ny kvittering", loading: "Laster…", gone: "Rommet er ikke lenger tilgjengelig",
  remove: "Fjern", host: "Du samler inn", guest: "Din del",
  paidOf: (paid, total) => `${paid} av ${total} betalt`,
  outstanding: (amt) => `${amt} gjenstår`, allSettled: "Alt er gjort opp ✓",
  waitingForGuests: "Venter på gjester…", youOwe: (amt) => `Du skal betale ${amt}`,
  youPaid: "Du har betalt ✓", nothing: "Ingenting å betale",
};
const fi: typeof sv = {
  title: "Historia", empty: "Ei vielä jaettuja kuitteja.",
  emptyHint: "Skannaa kuitti ja kutsu porukkaa – se ilmestyy tänne.",
  newReceipt: "Jaa uusi kuitti", loading: "Ladataan…", gone: "Huone ei ole enää käytettävissä",
  remove: "Poista", host: "Sinä keräät", guest: "Sinun osuutesi",
  paidOf: (paid, total) => `${paid}/${total} maksettu`,
  outstanding: (amt) => `${amt} maksamatta`, allSettled: "Kaikki maksettu ✓",
  waitingForGuests: "Odotetaan vieraita…", youOwe: (amt) => `Olet velkaa ${amt}`,
  youPaid: "Olet maksanut ✓", nothing: "Ei maksettavaa",
};
const pl: typeof sv = {
  title: "Historia", empty: "Brak podzielonych rachunków.",
  emptyHint: "Zeskanuj rachunek i zaproś znajomych – pojawi się tutaj.",
  newReceipt: "Podziel nowy rachunek", loading: "Ładowanie…", gone: "Pokój już niedostępny",
  remove: "Usuń", host: "Ty zbierasz", guest: "Twoja część",
  paidOf: (paid, total) => `${paid} z ${total} zapłacono`,
  outstanding: (amt) => `${amt} do zapłaty`, allSettled: "Wszystko rozliczone ✓",
  waitingForGuests: "Czekanie na gości…", youOwe: (amt) => `Jesteś winien ${amt}`,
  youPaid: "Zapłacono ✓", nothing: "Nic do zapłaty",
};
const pt: typeof sv = {
  title: "Histórico", empty: "Ainda não há recibos partilhados.",
  emptyHint: "Digitaliza um recibo e convida pessoas — aparece aqui.",
  newReceipt: "Partilhar um novo recibo", loading: "A carregar…", gone: "Sala já não disponível",
  remove: "Remover", host: "Tu recebes", guest: "A tua parte",
  paidOf: (paid, total) => `${paid} de ${total} pagos`,
  outstanding: (amt) => `${amt} em falta`, allSettled: "Tudo acertado ✓",
  waitingForGuests: "À espera de convidados…", youOwe: (amt) => `Deves ${amt}`,
  youPaid: "Já pagaste ✓", nothing: "Nada a pagar",
};
const R: Record<Lang, typeof sv> = { sv, en, de, fr, es, it, nl, da, no, fi, pl, pt };

type Summary =
  | { status: "loading" }
  | { status: "gone" }
  | {
      status: "ok";
      place: string;
      date: string;
      isHost: boolean;
      fx: Fx;
      paidCount: number;
      payeeCount: number;
      outstandingOre: number;
      waitingForGuests: boolean;
      myOre: number;
      iPaid: boolean;
    };

function money(ore: number, fx: Fx): string {
  const native = formatNative(ore, fx);
  return `${formatOre(ore)} SEK${native ? ` · ${native}` : ""}`;
}

export default function HistoryPage() {
  const [lang, setLang] = useState<Lang>("sv");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const t = R[lang];

  useEffect(() => {
    setLang(detectDefaultLang());
    setEntries(readHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;
    entries.forEach((e) => {
      if (e.kind === "local") {
        const split = readLocalSplit(e.id);
        if (!split) {
          setSummaries((prev) => ({ ...prev, [e.id]: { status: "gone" } }));
          return;
        }
        const fx: Fx = split.currency !== "SEK" && split.rate > 0 ? { currency: split.currency, rate: split.rate } : null;
        const paid = new Set(split.paidBy);
        const payees = split.shares.filter((s) => s.totalOre > 0);
        setSummaries((prev) => ({
          ...prev,
          [e.id]: {
            status: "ok",
            place: split.place || "Kvitt",
            date: split.date,
            isHost: true,
            fx,
            paidCount: payees.filter((s) => paid.has(s.id)).length,
            payeeCount: payees.length,
            outstandingOre: payees.filter((s) => !paid.has(s.id)).reduce((a, s) => a + s.totalOre, 0),
            waitingForGuests: false,
            myOre: 0,
            iPaid: false,
          },
        }));
        return;
      }
      setSummaries((prev) => (prev[e.id] ? prev : { ...prev, [e.id]: { status: "loading" } }));
      (async () => {
        try {
          const res = await fetch(`/api/room/${e.id}`, { cache: "no-store" });
          if (!res.ok) {
            if (!cancelled) setSummaries((prev) => ({ ...prev, [e.id]: { status: "gone" } }));
            return;
          }
          const state = (await res.json()) as RoomState;
          let personId: string | null = null;
          try {
            personId = localStorage.getItem(`swisher-room:${e.id}`);
          } catch {
            /* ignore */
          }
          const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
          const { shares } = computeRoomShares(state.items, diners, state.tipOre);
          const paidBy = state.paidBy ?? [];
          const isHost = !!personId && personId === state.payeePersonId;
          const payees = shares.filter((s) => s.dinerId !== state.payeePersonId && s.totalOre > 0);
          const paidCount = payees.filter((s) => paidBy.includes(s.dinerId)).length;
          const outstandingOre = payees
            .filter((s) => !paidBy.includes(s.dinerId))
            .reduce((acc, s) => acc + s.totalOre, 0);
          // The host picks groupSize during scan, so we know roughly how
          // many guests SHOULD eventually join — show "0 of 4" while we
          // wait instead of "0 of 0 · all settled", which read as "done"
          // for an empty just-created room.
          const expectedPayees = Math.max(0, (state.groupSize ?? state.people.length) - 1);
          const displayPayeeCount = Math.max(payees.length, expectedPayees);
          const waitingForGuests = payees.length === 0 && expectedPayees > 0;
          const mine = shares.find((s) => s.dinerId === personId);
          const fx: Fx =
            state.currency && state.currency !== "SEK" && state.rate > 0
              ? { currency: state.currency, rate: state.rate }
              : null;
          if (!cancelled)
            setSummaries((prev) => ({
              ...prev,
              [e.id]: {
                status: "ok",
                place: state.place || "Kvitt",
                date: state.date,
                isHost,
                fx,
                paidCount,
                payeeCount: displayPayeeCount,
                outstandingOre,
                waitingForGuests,
                myOre: mine?.totalOre ?? 0,
                iPaid: !!personId && paidBy.includes(personId),
              },
            }));
        } catch {
          /* transient — leave as loading */
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [entries]);

  function remove(id: string) {
    removeHistory(id);
    removeLocalSplit(id);
    setEntries(readHistory());
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-8">
      <header className="sticky top-0 z-30 -mx-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-2">
          <a
            href="/"
            aria-label={t.newReceipt}
            title={t.newReceipt}
            className="flex h-11 w-11 items-center justify-center justify-self-start rounded-xl bg-swish text-2xl font-semibold leading-none text-white shadow-sm active:bg-swish-dark"
          >
            +
          </a>
          <KvittLogo className="justify-self-center" />
          <div className="justify-self-end">
            <LangToggle lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
          </div>
        </div>
      </header>
      <h1 className="text-2xl font-bold">{t.title}</h1>

      {entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center text-gray-500">
          <span className="text-4xl">🧾</span>
          <p className="font-medium">{t.empty}</p>
          <p className="text-sm text-gray-400">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const s = summaries[e.id];
            return (
              <div key={e.id} className="relative rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <a href={e.kind === "local" ? `/split/${e.id}` : `/room/${e.id}`} className="block px-4 py-3 active:bg-gray-50">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{(s && s.status === "ok" && s.place) || e.place || "Kvitt"}</span>
                    <span className="shrink-0 text-xs text-gray-400">{[formatReceiptDate((s && s.status === "ok" ? s.date : e.date) ?? "", lang), e.kind === "room" ? e.id : null].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="mt-1 text-sm">
                    {!s || s.status === "loading" ? (
                      <span className="text-gray-400">{t.loading}</span>
                    ) : s.status === "gone" ? (
                      <span className="text-gray-400">{t.gone}</span>
                    ) : s.isHost ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-500">{t.paidOf(s.paidCount, s.payeeCount)}</span>
                        <span className={s.waitingForGuests ? "font-medium text-gray-400" : s.outstandingOre > 0 ? "font-semibold text-swish-dark" : "font-semibold text-emerald-600"}>
                          {s.waitingForGuests
                            ? t.waitingForGuests
                            : s.outstandingOre > 0
                              ? t.outstanding(money(s.outstandingOre, s.fx))
                              : t.allSettled}
                        </span>
                      </div>
                    ) : s.myOre > 0 ? (
                      <span className={s.iPaid ? "font-medium text-emerald-600" : "font-semibold text-swish-dark"}>
                        {s.iPaid ? t.youPaid : t.youOwe(money(s.myOre, s.fx))}
                      </span>
                    ) : (
                      <span className="text-gray-400">{t.nothing}</span>
                    )}
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  aria-label={t.remove}
                  className="absolute right-1 top-1 px-2 py-1 text-xs text-gray-300 active:text-red-500"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

    </main>
  );
}
