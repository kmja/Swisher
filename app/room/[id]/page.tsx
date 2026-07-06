"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import QrCard from "@/components/QrCard";
import SwishLogo from "@/components/SwishLogo";
import { computeRoomShares, formatOre, parseAmountToOre, isFullyShared } from "@/lib/money";
import { translations } from "@/lib/i18n";
import { categoryFor, emojiFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER, type Category } from "@/lib/categories";
import { formatReceiptDate } from "@/lib/date";
import ItemEmoji from "@/components/ItemEmoji";
import QrDialog from "@/components/QrDialog";
import LangToggle, { saveLang } from "@/components/LangToggle";
import { detectDefaultLang, detectCountry } from "@/lib/locales";
import KvittLogo from "@/components/KvittLogo";
import StepHeader from "@/components/StepHeader";
import { Money, FxProvider } from "@/components/Money";
import { flagEmoji, regionName, formatNative, type Fx } from "@/lib/currency";
import { addHistory } from "@/lib/history";
import { buildSwishUri } from "@/lib/swish";
import type { RoomState } from "@/lib/room-do";
import type { Diner, Share } from "@/lib/types";
import { pendingCreateKey, type PendingCreatePayload } from "@/lib/optimisticRoom";

import type { Lang } from "@/lib/i18n";

const R = {
  sv: {
    loading: "Laddar rummet…",
    notFound: "Hittade inget rum med den koden.",
    unavailable: "Live-rum kräver den driftsatta versionen.",
    toStart: "Till start",
    paidBy: "Betald av",
    namePlaceholder: "Ditt namn",
    join: "Gå med",
    joining: "Går med…",
    joinFailed: "Det gick inte att gå med. Kontrollera anslutningen och försök igen.",
    scanToJoin: "Skanna för att gå med",
    share: "Dela länk",
    copied: "Kopierad!",
    copyLink: "Kopiera länk",
    close: "Stäng",
    inviteText: (place: string, date: string) =>
      `Gå med och dela notan${place ? ` från ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Kvitto",
    receiptLoading: "Hämtar kvittot…",
    saveQr: "Spara QR-koden",
    imDone: "Jag är klar",
    doneOn: "✓ Klar",
    youCollect: "Du samlar in",
    yourShareNote: "Din egen del – du swishar inte dig själv.",
    remainingToCollect: "Kvar att få in",
    paidProgress: (paid: number, total: number) => `${paid} av ${total} har betalat`,
    allCollected: "Allt inbetalt ✓",
    ownShare: "Din egen del",
    dontPaySelf: "du betalar inte dig själv",
    itemsTitle: "Vad åt du?",
    claimHint: "Tryck på det du åt. Delade rätter är redan fördelade för bordet.",
    sharedSection: "Delas av alla",
    markedShared: (desc: string) =>
      `🤝 ”${desc || "Raden"}” delas nu av alla — flyttad till listan längst ner.`,
    nLeft: (n: number) => `${n} kvar`,
    cartEmpty: "Inget taget än",
    sharedBy: (n: number) => `delas av ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK/pers`,
    peopleTitle: "Vilka är med",
    unclaimed: (n: number) => `${n} rätt${n === 1 ? "" : "er"} ofördelade`,
    allClaimed: "Allt är fördelat",
    claimedTitle: (n: number) => `✓ ${n} klara`,
    you: "du",
    tip: "Dricks",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har inte petat i något än.",
    paid: "Betald",
    markPaid: "Markera betald",
    alreadyPaid: "Redan betald",
    cartPickedItems: (n: number) => `${n} ${n === 1 ? "vald rätt" : "valda rätter"}`,
    cartSharedItems: (n: number) => `${n} ${n === 1 ? "delad rätt" : "delade rätter"}`,
    cartSharedShort: (n: number) => `${n} ${n === 1 ? "delad" : "delade"}`,
    payWithSwish: "Betala med",
    waitingForGuests: "Väntar på gäster…",
    nobodyOwes: "Allt klart ✓",
    newReceipt: "Nytt kvitto",
    history: "Historik",
    editItems: "Redigera rätter",
    editRow: "Redigera rätt",
    doneEditing: "Klar",
    addRow: "Lägg till rätt",
    descPh: "Beskrivning",
    pricePh: "0,00",
    removeRow: "Ta bort rätt",
    removedItem: (desc: string) => `Tog bort ${desc}`,
    undo: "Ångra",
    save: "Spara",
    cancel: "Avbryt",
    coverFor: "Betalar även för",
    donate: "Bjud Kvitt på en kaffe",
    swipeRemove: "ta bort",
    swipeEdit: "ändra",
  },
  en: {
    loading: "Loading the room…",
    notFound: "No room found for that code.",
    unavailable: "Live rooms need the deployed version.",
    toStart: "To start",
    paidBy: "Paid by",
    namePlaceholder: "Your name",
    join: "Join",
    joining: "Joining…",
    joinFailed: "Couldn't join. Check your connection and try again.",
    scanToJoin: "Scan to join",
    share: "Share link",
    copied: "Copied!",
    copyLink: "Copy link",
    close: "Close",
    inviteText: (place: string, date: string) =>
      `Join and split the bill${place ? ` from ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Receipt",
    receiptLoading: "Fetching the receipt…",
    saveQr: "Save the QR code",
    imDone: "I'm done",
    doneOn: "✓ Done",
    youCollect: "You collect",
    yourShareNote: "Your own share — you don't Swish yourself.",
    remainingToCollect: "Remaining to collect",
    paidProgress: (paid: number, total: number) => `${paid} of ${total} paid`,
    allCollected: "All collected ✓",
    ownShare: "Your own share",
    dontPaySelf: "you don't pay yourself",
    itemsTitle: "What did you have?",
    claimHint: "Tap what you had. Shared dishes are already split for the table.",
    sharedSection: "Shared by everyone",
    markedShared: (desc: string) =>
      `🤝 “${desc || "Item"}” is now shared by everyone — moved to the bottom.`,
    nLeft: (n: number) => `${n} left`,
    cartEmpty: "Nothing claimed yet",
    sharedBy: (n: number) => `shared by ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK each`,
    peopleTitle: "Who's in",
    unclaimed: (n: number) => `${n} item${n === 1 ? "" : "s"} unassigned`,
    allClaimed: "Everything's assigned",
    claimedTitle: (n: number) => `✓ ${n} claimed`,
    you: "you",
    tip: "Tip",
    none: "None",
    yourTotal: "Your share",
    nothingYet: "You haven't tapped anything yet.",
    paid: "Paid",
    markPaid: "Mark paid",
    alreadyPaid: "Already paid",
    cartPickedItems: (n: number) => `${n} picked item${n === 1 ? "" : "s"}`,
    cartSharedItems: (n: number) => `${n} shared item${n === 1 ? "" : "s"}`,
    cartSharedShort: (n: number) => `${n} shared`,
    payWithSwish: "Pay with",
    waitingForGuests: "Waiting for guests…",
    nobodyOwes: "All clear ✓",
    newReceipt: "New receipt",
    history: "History",
    editItems: "Fix items",
    editRow: "Edit item",
    doneEditing: "Done",
    addRow: "Add item",
    descPh: "Description",
    pricePh: "0.00",
    removeRow: "Remove item",
    removedItem: (desc: string) => `Removed ${desc}`,
    undo: "Undo",
    save: "Save",
    cancel: "Cancel",
    coverFor: "Also paying for",
    donate: "Buy Kvitt a coffee",
    swipeRemove: "remove",
    swipeEdit: "edit",
  },
  de: {
    loading: "Raum wird geladen…",
    notFound: "Kein Raum mit diesem Code gefunden.",
    unavailable: "Live-Räume benötigen die bereitgestellte Version.",
    toStart: "Zum Start",
    paidBy: "Bezahlt von",
    namePlaceholder: "Dein Name",
    join: "Beitreten",
    joining: "Trete bei…",
    joinFailed: "Beitritt fehlgeschlagen. Prüfe deine Verbindung und versuch's nochmal.",
    scanToJoin: "Scannen zum Beitreten",
    share: "Link teilen",
    copied: "Kopiert!",
    copyLink: "Link kopieren",
    close: "Schließen",
    inviteText: (place: string, date: string) =>
      `Mitmachen und Rechnung teilen${place ? ` aus ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Beleg",
    receiptLoading: "Beleg wird geladen…",
    saveQr: "QR-Code speichern",
    imDone: "Ich bin fertig",
    doneOn: "✓ Fertig",
    youCollect: "Du sammelst ein",
    yourShareNote: "Dein eigener Anteil – du zahlst nicht an dich selbst.",
    remainingToCollect: "Noch einzusammeln",
    paidProgress: (paid: number, total: number) => `${paid} von ${total} bezahlt`,
    allCollected: "Alles eingegangen ✓",
    ownShare: "Dein eigener Anteil",
    dontPaySelf: "du zahlst nicht an dich selbst",
    itemsTitle: "Was hattest du?",
    claimHint: "Tippe an, was du hattest. Geteilte Gerichte sind bereits für den Tisch aufgeteilt.",
    sharedSection: "Von allen geteilt",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Artikel"}" wird jetzt von allen geteilt – nach unten verschoben.`,
    nLeft: (n: number) => `${n} übrig`,
    cartEmpty: "Noch nichts ausgewählt",
    sharedBy: (n: number) => `geteilt von ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK pro Person`,
    peopleTitle: "Wer ist dabei",
    unclaimed: (n: number) => `${n} ${n === 1 ? "Artikel" : "Artikel"} nicht zugewiesen`,
    allClaimed: "Alles zugewiesen",
    claimedTitle: (n: number) => `✓ ${n} ausgewählt`,
    you: "du",
    tip: "Trinkgeld",
    none: "Keins",
    yourTotal: "Dein Anteil",
    nothingYet: "Du hast noch nichts ausgewählt.",
    paid: "Bezahlt",
    markPaid: "Als bezahlt markieren",
    alreadyPaid: "Bereits bezahlt",
    cartPickedItems: (n: number) => `${n} ${n === 1 ? "ausgewählter Artikel" : "ausgewählte Artikel"}`,
    cartSharedItems: (n: number) => `${n} ${n === 1 ? "geteilter Artikel" : "geteilte Artikel"}`,
    cartSharedShort: (n: number) => `${n} geteilt`,
    payWithSwish: "Bezahlen mit",
    waitingForGuests: "Warte auf Gäste…",
    nobodyOwes: "Alles erledigt ✓",
    newReceipt: "Neuer Beleg",
    history: "Verlauf",
    editItems: "Artikel bearbeiten",
    editRow: "Artikel bearbeiten",
    doneEditing: "Fertig",
    addRow: "Artikel hinzufügen",
    descPh: "Beschreibung",
    pricePh: "0,00",
    removeRow: "Artikel entfernen",
    removedItem: (desc: string) => `${desc} entfernt`,
    undo: "Rückgängig",
    save: "Speichern",
    cancel: "Abbrechen",
    coverFor: "Zahlt auch für",
    donate: "Kvitt einen Kaffee spendieren",
    swipeRemove: "löschen",
    swipeEdit: "ändern",
  },
  fr: {
    loading: "Chargement de la salle…",
    notFound: "Aucune salle trouvée pour ce code.",
    unavailable: "Les salles en direct nécessitent la version déployée.",
    toStart: "Pour commencer",
    paidBy: "Payé par",
    namePlaceholder: "Ton prénom",
    join: "Rejoindre",
    joining: "Connexion…",
    joinFailed: "Impossible de rejoindre. Vérifie ta connexion et réessaie.",
    scanToJoin: "Scanner pour rejoindre",
    share: "Partager le lien",
    copied: "Copié !",
    copyLink: "Copier le lien",
    close: "Fermer",
    inviteText: (place: string, date: string) =>
      `Rejoins et partage l'addition${place ? ` de ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Reçu",
    receiptLoading: "Chargement du reçu…",
    saveQr: "Enregistrer le QR code",
    imDone: "J'ai terminé",
    doneOn: "✓ Terminé",
    youCollect: "Tu collectes",
    yourShareNote: "Ta propre part — tu ne te paies pas toi-même.",
    remainingToCollect: "Reste à collecter",
    paidProgress: (paid: number, total: number) => `${paid} sur ${total} payé`,
    allCollected: "Tout collecté ✓",
    ownShare: "Ta propre part",
    dontPaySelf: "tu ne te paies pas toi-même",
    itemsTitle: "Qu'est-ce que tu as pris ?",
    claimHint: "Appuie sur ce que tu as pris. Les plats partagés sont déjà divisés pour la table.",
    sharedSection: "Partagé par tous",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Article"}" est maintenant partagé par tous — déplacé en bas.`,
    nLeft: (n: number) => `${n} restant${n === 1 ? "" : "s"}`,
    cartEmpty: "Rien de sélectionné",
    sharedBy: (n: number) => `partagé par ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK chacun`,
    peopleTitle: "Qui est là",
    unclaimed: (n: number) => `${n} article${n === 1 ? "" : "s"} non attribué${n === 1 ? "" : "s"}`,
    allClaimed: "Tout est attribué",
    claimedTitle: (n: number) => `✓ ${n} sélectionné${n === 1 ? "" : "s"}`,
    you: "toi",
    tip: "Pourboire",
    none: "Aucun",
    yourTotal: "Ta part",
    nothingYet: "Tu n'as encore rien sélectionné.",
    paid: "Payé",
    markPaid: "Marquer comme payé",
    alreadyPaid: "Déjà payé",
    cartPickedItems: (n: number) => `${n} article${n === 1 ? "" : "s"} sélectionné${n === 1 ? "" : "s"}`,
    cartSharedItems: (n: number) => `${n} article${n === 1 ? "" : "s"} partagé${n === 1 ? "" : "s"}`,
    cartSharedShort: (n: number) => `${n} partagé${n === 1 ? "" : "s"}`,
    payWithSwish: "Payer avec",
    waitingForGuests: "En attente des invités…",
    nobodyOwes: "Tout est réglé ✓",
    newReceipt: "Nouveau reçu",
    history: "Historique",
    editItems: "Modifier les articles",
    editRow: "Modifier l'article",
    doneEditing: "Terminé",
    addRow: "Ajouter un article",
    descPh: "Description",
    pricePh: "0,00",
    removeRow: "Supprimer l'article",
    removedItem: (desc: string) => `${desc} supprimé`,
    undo: "Annuler",
    save: "Enregistrer",
    cancel: "Annuler",
    coverFor: "Paie aussi pour",
    donate: "Offrir un café à Kvitt",
    swipeRemove: "supprimer",
    swipeEdit: "modifier",
  },
  es: {
    loading: "Cargando la sala…",
    notFound: "No se encontró ninguna sala con ese código.",
    unavailable: "Las salas en vivo necesitan la versión desplegada.",
    toStart: "Para empezar",
    paidBy: "Pagado por",
    namePlaceholder: "Tu nombre",
    join: "Unirse",
    joining: "Uniéndose…",
    joinFailed: "No se pudo unir. Comprueba tu conexión e inténtalo de nuevo.",
    scanToJoin: "Escanear para unirse",
    share: "Compartir enlace",
    copied: "¡Copiado!",
    copyLink: "Copiar enlace",
    close: "Cerrar",
    inviteText: (place: string, date: string) =>
      `Únete y divide la cuenta${place ? ` de ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Recibo",
    receiptLoading: "Cargando el recibo…",
    saveQr: "Guardar el código QR",
    imDone: "He terminado",
    doneOn: "✓ Listo",
    youCollect: "Tú cobras",
    yourShareNote: "Tu propia parte — no te pagas a ti mismo.",
    remainingToCollect: "Pendiente por cobrar",
    paidProgress: (paid: number, total: number) => `${paid} de ${total} pagado`,
    allCollected: "Todo cobrado ✓",
    ownShare: "Tu propia parte",
    dontPaySelf: "no te pagas a ti mismo",
    itemsTitle: "¿Qué pediste?",
    claimHint: "Toca lo que pediste. Los platos compartidos ya están divididos para la mesa.",
    sharedSection: "Compartido por todos",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Artículo"}" ahora es compartido por todos — movido abajo.`,
    nLeft: (n: number) => `${n} restante${n === 1 ? "" : "s"}`,
    cartEmpty: "Nada seleccionado aún",
    sharedBy: (n: number) => `compartido por ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK cada uno`,
    peopleTitle: "Quién está",
    unclaimed: (n: number) => `${n} artículo${n === 1 ? "" : "s"} sin asignar`,
    allClaimed: "Todo asignado",
    claimedTitle: (n: number) => `✓ ${n} seleccionado${n === 1 ? "" : "s"}`,
    you: "tú",
    tip: "Propina",
    none: "Ninguna",
    yourTotal: "Tu parte",
    nothingYet: "Aún no has seleccionado nada.",
    paid: "Pagado",
    markPaid: "Marcar como pagado",
    alreadyPaid: "Ya pagado",
    cartPickedItems: (n: number) => `${n} artículo${n === 1 ? "" : "s"} seleccionado${n === 1 ? "" : "s"}`,
    cartSharedItems: (n: number) => `${n} artículo${n === 1 ? "" : "s"} compartido${n === 1 ? "" : "s"}`,
    cartSharedShort: (n: number) => `${n} compartido${n === 1 ? "" : "s"}`,
    payWithSwish: "Pagar con",
    waitingForGuests: "Esperando a los invitados…",
    nobodyOwes: "Todo en orden ✓",
    newReceipt: "Nuevo recibo",
    history: "Historial",
    editItems: "Editar artículos",
    editRow: "Editar artículo",
    doneEditing: "Listo",
    addRow: "Añadir artículo",
    descPh: "Descripción",
    pricePh: "0,00",
    removeRow: "Eliminar artículo",
    removedItem: (desc: string) => `${desc} eliminado`,
    undo: "Deshacer",
    save: "Guardar",
    cancel: "Cancelar",
    coverFor: "También paga por",
    donate: "Invitar a Kvitt a un café",
    swipeRemove: "borrar",
    swipeEdit: "editar",
  },
  it: {
    loading: "Caricamento della stanza…",
    notFound: "Nessuna stanza trovata con quel codice.",
    unavailable: "Le stanze live richiedono la versione distribuita.",
    toStart: "Per iniziare",
    paidBy: "Pagato da",
    namePlaceholder: "Il tuo nome",
    join: "Unisciti",
    joining: "Partecipando…",
    joinFailed: "Impossibile unirsi. Controlla la connessione e riprova.",
    scanToJoin: "Scansiona per partecipare",
    share: "Condividi link",
    copied: "Copiato!",
    copyLink: "Copia link",
    close: "Chiudi",
    inviteText: (place: string, date: string) =>
      `Unisciti e dividi il conto${place ? ` di ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Scontrino",
    receiptLoading: "Caricamento dello scontrino…",
    saveQr: "Salva il codice QR",
    imDone: "Ho finito",
    doneOn: "✓ Fatto",
    youCollect: "Incassi tu",
    yourShareNote: "La tua parte — non paghi te stesso.",
    remainingToCollect: "Ancora da incassare",
    paidProgress: (paid: number, total: number) => `${paid} di ${total} pagato`,
    allCollected: "Tutto incassato ✓",
    ownShare: "La tua parte",
    dontPaySelf: "non paghi te stesso",
    itemsTitle: "Cosa hai ordinato?",
    claimHint: "Tocca quello che hai ordinato. I piatti condivisi sono già divisi per il tavolo.",
    sharedSection: "Condiviso da tutti",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Articolo"}" è ora condiviso da tutti — spostato in fondo.`,
    nLeft: (n: number) => `${n} rimanente${n === 1 ? "" : "i"}`,
    cartEmpty: "Niente ancora selezionato",
    sharedBy: (n: number) => `condiviso da ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK ciascuno`,
    peopleTitle: "Chi c'è",
    unclaimed: (n: number) => `${n} articolo${n === 1 ? "" : "i"} non assegnato${n === 1 ? "" : "i"}`,
    allClaimed: "Tutto assegnato",
    claimedTitle: (n: number) => `✓ ${n} selezionato${n === 1 ? "" : "i"}`,
    you: "tu",
    tip: "Mancia",
    none: "Nessuna",
    yourTotal: "La tua parte",
    nothingYet: "Non hai ancora selezionato nulla.",
    paid: "Pagato",
    markPaid: "Segna come pagato",
    alreadyPaid: "Già pagato",
    cartPickedItems: (n: number) => `${n} articolo${n === 1 ? "" : "i"} selezionato${n === 1 ? "" : "i"}`,
    cartSharedItems: (n: number) => `${n} articolo${n === 1 ? "" : "i"} condiviso${n === 1 ? "" : "i"}`,
    cartSharedShort: (n: number) => `${n} condiviso${n === 1 ? "" : "i"}`,
    payWithSwish: "Paga con",
    waitingForGuests: "In attesa degli ospiti…",
    nobodyOwes: "Tutto a posto ✓",
    newReceipt: "Nuovo scontrino",
    history: "Cronologia",
    editItems: "Modifica articoli",
    editRow: "Modifica articolo",
    doneEditing: "Fatto",
    addRow: "Aggiungi articolo",
    descPh: "Descrizione",
    pricePh: "0,00",
    removeRow: "Rimuovi articolo",
    removedItem: (desc: string) => `${desc} rimosso`,
    undo: "Annulla",
    save: "Salva",
    cancel: "Annulla",
    coverFor: "Paga anche per",
    donate: "Offri un caffè a Kvitt",
    swipeRemove: "rimuovi",
    swipeEdit: "modifica",
  },
  nl: {
    loading: "Kamer laden…",
    notFound: "Geen kamer gevonden voor die code.",
    unavailable: "Live-kamers hebben de uitgerold versie nodig.",
    toStart: "Naar start",
    paidBy: "Betaald door",
    namePlaceholder: "Jouw naam",
    join: "Meedoen",
    joining: "Deelnemen…",
    joinFailed: "Deelnemen mislukt. Controleer je verbinding en probeer opnieuw.",
    scanToJoin: "Scannen om mee te doen",
    share: "Link delen",
    copied: "Gekopieerd!",
    copyLink: "Link kopiëren",
    close: "Sluiten",
    inviteText: (place: string, date: string) =>
      `Doe mee en deel de rekening${place ? ` van ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Bon",
    receiptLoading: "Bon ophalen…",
    saveQr: "QR-code opslaan",
    imDone: "Ik ben klaar",
    doneOn: "✓ Klaar",
    youCollect: "Jij int",
    yourShareNote: "Je eigen deel — je betaalt niet aan jezelf.",
    remainingToCollect: "Nog te innen",
    paidProgress: (paid: number, total: number) => `${paid} van ${total} betaald`,
    allCollected: "Alles geïnd ✓",
    ownShare: "Je eigen deel",
    dontPaySelf: "je betaalt niet aan jezelf",
    itemsTitle: "Wat had je?",
    claimHint: "Tik aan wat je had. Gedeelde gerechten zijn al verdeeld voor de tafel.",
    sharedSection: "Gedeeld door iedereen",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Artikel"}" wordt nu door iedereen gedeeld — naar beneden verplaatst.`,
    nLeft: (n: number) => `${n} over`,
    cartEmpty: "Nog niets geselecteerd",
    sharedBy: (n: number) => `gedeeld door ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK per persoon`,
    peopleTitle: "Wie zijn er",
    unclaimed: (n: number) => `${n} artikel${n === 1 ? "" : "en"} niet toegewezen`,
    allClaimed: "Alles toegewezen",
    claimedTitle: (n: number) => `✓ ${n} geselecteerd`,
    you: "jij",
    tip: "Fooi",
    none: "Geen",
    yourTotal: "Jouw deel",
    nothingYet: "Je hebt nog niets geselecteerd.",
    paid: "Betaald",
    markPaid: "Markeer als betaald",
    alreadyPaid: "Al betaald",
    cartPickedItems: (n: number) => `${n} geselecteerd artikel${n === 1 ? "" : "en"}`,
    cartSharedItems: (n: number) => `${n} gedeeld artikel${n === 1 ? "" : "en"}`,
    cartSharedShort: (n: number) => `${n} gedeeld`,
    payWithSwish: "Betalen met",
    waitingForGuests: "Wachten op gasten…",
    nobodyOwes: "Alles in orde ✓",
    newReceipt: "Nieuwe bon",
    history: "Geschiedenis",
    editItems: "Artikelen bewerken",
    editRow: "Artikel bewerken",
    doneEditing: "Klaar",
    addRow: "Artikel toevoegen",
    descPh: "Omschrijving",
    pricePh: "0,00",
    removeRow: "Artikel verwijderen",
    removedItem: (desc: string) => `${desc} verwijderd`,
    undo: "Ongedaan maken",
    save: "Opslaan",
    cancel: "Annuleren",
    coverFor: "Betaalt ook voor",
    donate: "Trakteer Kvitt op een koffie",
    swipeRemove: "verwijder",
    swipeEdit: "bewerk",
  },
  da: {
    loading: "Indlæser rummet…",
    notFound: "Intet rum fundet for den kode.",
    unavailable: "Live-rum kræver den installerede version.",
    toStart: "Til start",
    paidBy: "Betalt af",
    namePlaceholder: "Dit navn",
    join: "Deltag",
    joining: "Tilmelder…",
    joinFailed: "Kunne ikke deltage. Tjek din forbindelse og prøv igen.",
    scanToJoin: "Scan for at deltage",
    share: "Del link",
    copied: "Kopieret!",
    copyLink: "Kopiér link",
    close: "Luk",
    inviteText: (place: string, date: string) =>
      `Deltag og del regningen${place ? ` fra ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Kvittering",
    receiptLoading: "Henter kvitteringen…",
    saveQr: "Gem QR-koden",
    imDone: "Jeg er færdig",
    doneOn: "✓ Færdig",
    youCollect: "Du opkræver",
    yourShareNote: "Din egen del — du betaler ikke dig selv.",
    remainingToCollect: "Tilbage at opkræve",
    paidProgress: (paid: number, total: number) => `${paid} af ${total} betalt`,
    allCollected: "Alt opkrævet ✓",
    ownShare: "Din egen del",
    dontPaySelf: "du betaler ikke dig selv",
    itemsTitle: "Hvad havde du?",
    claimHint: "Tryk på det, du havde. Delte retter er allerede fordelt til bordet.",
    sharedSection: "Delt af alle",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Vare"}" deles nu af alle — flyttet til bunden.`,
    nLeft: (n: number) => `${n} tilbage`,
    cartEmpty: "Intet valgt endnu",
    sharedBy: (n: number) => `delt af ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK hver`,
    peopleTitle: "Hvem er med",
    unclaimed: (n: number) => `${n} vare${n === 1 ? "" : "r"} ikke tildelt`,
    allClaimed: "Alt er tildelt",
    claimedTitle: (n: number) => `✓ ${n} valgt`,
    you: "dig",
    tip: "Drikkepenge",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har ikke valgt noget endnu.",
    paid: "Betalt",
    markPaid: "Markér som betalt",
    alreadyPaid: "Allerede betalt",
    cartPickedItems: (n: number) => `${n} valgt vare${n === 1 ? "" : "r"}`,
    cartSharedItems: (n: number) => `${n} delt vare${n === 1 ? "" : "r"}`,
    cartSharedShort: (n: number) => `${n} delt`,
    payWithSwish: "Betal med",
    waitingForGuests: "Venter på gæster…",
    nobodyOwes: "Alt klaret ✓",
    newReceipt: "Ny kvittering",
    history: "Historik",
    editItems: "Rediger varer",
    editRow: "Rediger vare",
    doneEditing: "Færdig",
    addRow: "Tilføj vare",
    descPh: "Beskrivelse",
    pricePh: "0,00",
    removeRow: "Fjern vare",
    removedItem: (desc: string) => `${desc} fjernet`,
    undo: "Fortryd",
    save: "Gem",
    cancel: "Annuller",
    coverFor: "Betaler også for",
    donate: "Køb Kvitt en kaffe",
    swipeRemove: "slet",
    swipeEdit: "rediger",
  },
  no: {
    loading: "Laster rommet…",
    notFound: "Ingen rom funnet for den koden.",
    unavailable: "Live-rom trenger den deployede versjonen.",
    toStart: "Til start",
    paidBy: "Betalt av",
    namePlaceholder: "Ditt navn",
    join: "Bli med",
    joining: "Blir med…",
    joinFailed: "Kunne ikke bli med. Sjekk tilkoblingen og prøv igjen.",
    scanToJoin: "Skann for å bli med",
    share: "Del lenke",
    copied: "Kopiert!",
    copyLink: "Kopier lenke",
    close: "Lukk",
    inviteText: (place: string, date: string) =>
      `Bli med og del regningen${place ? ` fra ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Kvittering",
    receiptLoading: "Henter kvitteringen…",
    saveQr: "Lagre QR-koden",
    imDone: "Jeg er ferdig",
    doneOn: "✓ Ferdig",
    youCollect: "Du samler inn",
    yourShareNote: "Din egen del — du betaler ikke deg selv.",
    remainingToCollect: "Gjenstår å samle inn",
    paidProgress: (paid: number, total: number) => `${paid} av ${total} betalt`,
    allCollected: "Alt innsamlet ✓",
    ownShare: "Din egen del",
    dontPaySelf: "du betaler ikke deg selv",
    itemsTitle: "Hva hadde du?",
    claimHint: "Trykk på det du hadde. Delte retter er allerede fordelt til bordet.",
    sharedSection: "Delt av alle",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Vare"}" deles nå av alle — flyttet til bunnen.`,
    nLeft: (n: number) => `${n} igjen`,
    cartEmpty: "Ingenting valgt ennå",
    sharedBy: (n: number) => `delt av ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK hver`,
    peopleTitle: "Hvem er med",
    unclaimed: (n: number) => `${n} vare${n === 1 ? "" : "r"} ikke tildelt`,
    allClaimed: "Alt er tildelt",
    claimedTitle: (n: number) => `✓ ${n} valgt`,
    you: "deg",
    tip: "Tips",
    none: "Ingen",
    yourTotal: "Din del",
    nothingYet: "Du har ikke valgt noe ennå.",
    paid: "Betalt",
    markPaid: "Merk som betalt",
    alreadyPaid: "Allerede betalt",
    cartPickedItems: (n: number) => `${n} valgt vare${n === 1 ? "" : "r"}`,
    cartSharedItems: (n: number) => `${n} delt vare${n === 1 ? "" : "r"}`,
    cartSharedShort: (n: number) => `${n} delt`,
    payWithSwish: "Betal med",
    waitingForGuests: "Venter på gjester…",
    nobodyOwes: "Alt i orden ✓",
    newReceipt: "Ny kvittering",
    history: "Historikk",
    editItems: "Rediger varer",
    editRow: "Rediger vare",
    doneEditing: "Ferdig",
    addRow: "Legg til vare",
    descPh: "Beskrivelse",
    pricePh: "0,00",
    removeRow: "Fjern vare",
    removedItem: (desc: string) => `${desc} fjernet`,
    undo: "Angre",
    save: "Lagre",
    cancel: "Avbryt",
    coverFor: "Betaler også for",
    donate: "Kjøp Kvitt en kaffe",
    swipeRemove: "fjern",
    swipeEdit: "endre",
  },
  fi: {
    loading: "Ladataan huonetta…",
    notFound: "Huonetta ei löydy sillä koodilla.",
    unavailable: "Live-huoneet tarvitsevat käyttöönotetun version.",
    toStart: "Aloitukseen",
    paidBy: "Maksaja",
    namePlaceholder: "Nimesi",
    join: "Liity",
    joining: "Liitytään…",
    joinFailed: "Liittyminen epäonnistui. Tarkista yhteys ja yritä uudelleen.",
    scanToJoin: "Skannaa liittyäksesi",
    share: "Jaa linkki",
    copied: "Kopioitu!",
    copyLink: "Kopioi linkki",
    close: "Sulje",
    inviteText: (place: string, date: string) =>
      `Liity ja jaa lasku${place ? ` paikasta ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Kuitti",
    receiptLoading: "Haetaan kuittia…",
    saveQr: "Tallenna QR-koodi",
    imDone: "Olen valmis",
    doneOn: "✓ Valmis",
    youCollect: "Sinä keräät",
    yourShareNote: "Oma osasi — et maksa itsellesi.",
    remainingToCollect: "Vielä kerättävänä",
    paidProgress: (paid: number, total: number) => `${paid}/${total} maksanut`,
    allCollected: "Kaikki kerätty ✓",
    ownShare: "Oma osasi",
    dontPaySelf: "et maksa itsellesi",
    itemsTitle: "Mitä sinulla oli?",
    claimHint: "Napauta mitä sinulla oli. Yhteiset annokset on jo jaettu pöydälle.",
    sharedSection: "Kaikkien jakama",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Tuote"}" on nyt kaikkien jakama — siirretty alhaalle.`,
    nLeft: (n: number) => `${n} jäljellä`,
    cartEmpty: "Ei vielä valittua",
    sharedBy: (n: number) => `${n} jakaa`,
    eachShort: (amt: string) => `≈ ${amt} SEK/hlö`,
    peopleTitle: "Ketkä ovat mukana",
    unclaimed: (n: number) => `${n} tuote${n === 1 ? "" : "tta"} ei jaettu`,
    allClaimed: "Kaikki jaettu",
    claimedTitle: (n: number) => `✓ ${n} valittu`,
    you: "sinä",
    tip: "Tippi",
    none: "Ei mitään",
    yourTotal: "Sinun osasi",
    nothingYet: "Et ole vielä valinnut mitään.",
    paid: "Maksettu",
    markPaid: "Merkitse maksetuksi",
    alreadyPaid: "Jo maksettu",
    cartPickedItems: (n: number) => `${n} valittu tuote${n === 1 ? "" : "tta"}`,
    cartSharedItems: (n: number) => `${n} yhteinen tuote${n === 1 ? "" : "tta"}`,
    cartSharedShort: (n: number) => `${n} yhteinen`,
    payWithSwish: "Maksa",
    waitingForGuests: "Odotetaan vieraita…",
    nobodyOwes: "Kaikki selvää ✓",
    newReceipt: "Uusi kuitti",
    history: "Historia",
    editItems: "Muokkaa tuotteita",
    editRow: "Muokkaa tuotetta",
    doneEditing: "Valmis",
    addRow: "Lisää tuote",
    descPh: "Kuvaus",
    pricePh: "0,00",
    removeRow: "Poista tuote",
    removedItem: (desc: string) => `${desc} poistettu`,
    undo: "Kumoa",
    save: "Tallenna",
    cancel: "Peruuta",
    coverFor: "Maksaa myös puolesta",
    donate: "Osta Kvitille kahvi",
    swipeRemove: "poista",
    swipeEdit: "muokkaa",
  },
  pl: {
    loading: "Ładowanie pokoju…",
    notFound: "Nie znaleziono pokoju dla tego kodu.",
    unavailable: "Pokoje na żywo wymagają wdrożonej wersji.",
    toStart: "Do startu",
    paidBy: "Zapłacone przez",
    namePlaceholder: "Twoje imię",
    join: "Dołącz",
    joining: "Dołączanie…",
    joinFailed: "Nie udało się dołączyć. Sprawdź połączenie i spróbuj ponownie.",
    scanToJoin: "Zeskanuj, aby dołączyć",
    share: "Udostępnij link",
    copied: "Skopiowano!",
    copyLink: "Kopiuj link",
    close: "Zamknij",
    inviteText: (place: string, date: string) =>
      `Dołącz i podziel rachunek${place ? ` z ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Paragon",
    receiptLoading: "Pobieranie paragonu…",
    saveQr: "Zapisz kod QR",
    imDone: "Gotowe",
    doneOn: "✓ Gotowe",
    youCollect: "Ty zbierasz",
    yourShareNote: "Twoja własna część — nie płacisz sobie.",
    remainingToCollect: "Pozostało do zebrania",
    paidProgress: (paid: number, total: number) => `${paid} z ${total} zapłacono`,
    allCollected: "Wszystko zebrane ✓",
    ownShare: "Twoja własna część",
    dontPaySelf: "nie płacisz sobie",
    itemsTitle: "Co zamawiałeś?",
    claimHint: "Dotknij co zamawiałeś. Wspólne dania są już podzielone dla stołu.",
    sharedSection: "Wspólne dla wszystkich",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Pozycja"}" jest teraz wspólna dla wszystkich — przeniesiono na dół.`,
    nLeft: (n: number) => `${n} pozostało`,
    cartEmpty: "Nic jeszcze nie wybrano",
    sharedBy: (n: number) => `wspólne dla ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK każdy`,
    peopleTitle: "Kto jest",
    unclaimed: (n: number) => `${n} pozycja${n === 1 ? " nieprzypisana" : " nieprzypisane"}`,
    allClaimed: "Wszystko przypisane",
    claimedTitle: (n: number) => `✓ ${n} wybrane`,
    you: "ty",
    tip: "Napiwek",
    none: "Brak",
    yourTotal: "Twoja część",
    nothingYet: "Nie wybrałeś jeszcze niczego.",
    paid: "Zapłacono",
    markPaid: "Oznacz jako zapłacone",
    alreadyPaid: "Już zapłacone",
    cartPickedItems: (n: number) => `${n} wybrana pozycja${n === 1 ? "" : " wybrane pozycje"}`,
    cartSharedItems: (n: number) => `${n} wspólna pozycja${n === 1 ? "" : " wspólne pozycje"}`,
    cartSharedShort: (n: number) => `${n} wspólne`,
    payWithSwish: "Zapłać przez",
    waitingForGuests: "Oczekiwanie na gości…",
    nobodyOwes: "Wszystko jasne ✓",
    newReceipt: "Nowy paragon",
    history: "Historia",
    editItems: "Edytuj pozycje",
    editRow: "Edytuj pozycję",
    doneEditing: "Gotowe",
    addRow: "Dodaj pozycję",
    descPh: "Opis",
    pricePh: "0,00",
    removeRow: "Usuń pozycję",
    removedItem: (desc: string) => `${desc} usunięto`,
    undo: "Cofnij",
    save: "Zapisz",
    cancel: "Anuluj",
    coverFor: "Płaci również za",
    donate: "Postaw Kvitt kawę",
    swipeRemove: "usuń",
    swipeEdit: "edytuj",
  },
  pt: {
    loading: "A carregar a sala…",
    notFound: "Nenhuma sala encontrada para esse código.",
    unavailable: "As salas ao vivo precisam da versão implementada.",
    toStart: "Para começar",
    paidBy: "Pago por",
    namePlaceholder: "O teu nome",
    join: "Entrar",
    joining: "A entrar…",
    joinFailed: "Não foi possível entrar. Verifica a ligação e tenta novamente.",
    scanToJoin: "Digitalizar para entrar",
    share: "Partilhar link",
    copied: "Copiado!",
    copyLink: "Copiar link",
    close: "Fechar",
    inviteText: (place: string, date: string) =>
      `Entra e divide a conta${place ? ` de ${place}` : ""}${date ? ` · ${date}` : ""}`,
    showReceipt: "Recibo",
    receiptLoading: "A carregar o recibo…",
    saveQr: "Guardar o código QR",
    imDone: "Terminei",
    doneOn: "✓ Feito",
    youCollect: "Tu cobras",
    yourShareNote: "A tua própria parte — não pagas a ti mesmo.",
    remainingToCollect: "Ainda por cobrar",
    paidProgress: (paid: number, total: number) => `${paid} de ${total} pago`,
    allCollected: "Tudo cobrado ✓",
    ownShare: "A tua própria parte",
    dontPaySelf: "não pagas a ti mesmo",
    itemsTitle: "O que pediste?",
    claimHint: "Toca no que pediste. Os pratos partilhados já estão divididos para a mesa.",
    sharedSection: "Partilhado por todos",
    markedShared: (desc: string) =>
      `🤝 "${desc || "Item"}" é agora partilhado por todos — movido para baixo.`,
    nLeft: (n: number) => `${n} restante${n === 1 ? "" : "s"}`,
    cartEmpty: "Nada selecionado ainda",
    sharedBy: (n: number) => `partilhado por ${n}`,
    eachShort: (amt: string) => `≈ ${amt} SEK cada`,
    peopleTitle: "Quem está",
    unclaimed: (n: number) => `${n} item${n === 1 ? "" : "s"} não atribuído${n === 1 ? "" : "s"}`,
    allClaimed: "Tudo atribuído",
    claimedTitle: (n: number) => `✓ ${n} selecionado${n === 1 ? "" : "s"}`,
    you: "tu",
    tip: "Gorjeta",
    none: "Nenhuma",
    yourTotal: "A tua parte",
    nothingYet: "Ainda não selecionaste nada.",
    paid: "Pago",
    markPaid: "Marcar como pago",
    alreadyPaid: "Já pago",
    cartPickedItems: (n: number) => `${n} item${n === 1 ? "" : "s"} selecionado${n === 1 ? "" : "s"}`,
    cartSharedItems: (n: number) => `${n} item${n === 1 ? "" : "s"} partilhado${n === 1 ? "" : "s"}`,
    cartSharedShort: (n: number) => `${n} partilhado${n === 1 ? "" : "s"}`,
    payWithSwish: "Pagar com",
    waitingForGuests: "À espera dos convidados…",
    nobodyOwes: "Tudo em ordem ✓",
    newReceipt: "Novo recibo",
    history: "Histórico",
    editItems: "Editar itens",
    editRow: "Editar item",
    doneEditing: "Feito",
    addRow: "Adicionar item",
    descPh: "Descrição",
    pricePh: "0,00",
    removeRow: "Remover item",
    removedItem: (desc: string) => `${desc} removido`,
    undo: "Desfazer",
    save: "Guardar",
    cancel: "Cancelar",
    coverFor: "Paga também por",
    donate: "Pagar um café ao Kvitt",
    swipeRemove: "remover",
    swipeEdit: "editar",
  },
};

// Widen the room-page's local R map so any supported Lang code resolves
// to its own translation.
const Rx: Record<Lang, typeof R.sv> = {
  sv: R.sv, en: R.en, de: R.de, fr: R.fr, es: R.es, it: R.it,
  nl: R.nl, da: R.da, no: R.no, fi: R.fi, pl: R.pl, pt: R.pt,
};

const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function RoomPage() {
  const params = useParams<{ id: string | string[] }>();
  const searchParams = useSearchParams();
  const code = String(Array.isArray(params.id) ? params.id[0] : params.id ?? "").toUpperCase();
  const storageKey = `swisher-room:${code}`;
  const bootstrapKey = `kvitt-room-bootstrap:${code}`;

  const [lang, setLang] = useState<Lang>("sv");
  // Initial state can come from sessionStorage when the host just
  // created the room — createRoom stashes the freshly-init'd room
  // there so we don't need to GET the same data back from the DO
  // before showing the page. The skeleton then only ever shows for
  // direct-nav / shared-link arrivals.
  const [state, setState] = useState<RoomState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(bootstrapKey);
      if (!raw) return null;
      sessionStorage.removeItem(bootstrapKey);
      return JSON.parse(raw) as RoomState;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "unavailable">(
    () => (state ? "ok" : "loading"),
  );
  // True once a successful room load has ever happened (including bootstrap).
  // Prevents a transient 404 during the DO-init window from wiping valid state.
  const everLoadedRef = useRef(state != null);
  // Set when the room page replays a pending create-room POST and it
  // comes back non-2xx — surfaces as a top banner with a retry
  // button. Cleared when retry succeeds.
  const [createError, setCreateError] = useState<string | null>(null);
  // Counter that increments each time the user taps "Retry" after a
  // create-room failure, so the replay effect can re-fire the POST.
  const [createRetryCount, setCreateRetryCount] = useState(0);
  // Guards the create-room replay from firing twice if React strict-
  // mode mounts the effect twice in dev; cleared on retry.
  const createInFlightRef = useRef(false);
  // Seed from localStorage synchronously so a host / returning guest is
  // known on the very first render and never flashes the join dialog.
  const [personId, setPersonId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  // Mount/visibility split so the join dialog can fade its backdrop +
  // card out (rather than vanishing) once the guest joins. `mounted`
  // keeps it in the DOM through the exit; `shown` drives the opacity.
  const [joinMounted, setJoinMounted] = useState(false);
  const [joinShown, setJoinShown] = useState(false);
  // True only during the exit (guest just joined): sends the scattered
  // emojis flying off-screen while the card + backdrop fade.
  const [joinFlyOut, setJoinFlyOut] = useState(false);
  // Mirror of the dialog's render condition, updated in render so the
  // room-enter ref callback (fires during commit) can read it.
  const joinActiveRef = useRef(false);
  const joinNameRef = useRef<HTMLInputElement>(null);
  // Inline error under the name field when a join attempt fails —
  // without this a failed POST just stopped the spinner silently.
  const [joinError, setJoinError] = useState(false);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Host's name / Swish number / group-size are always-visible input
  // fields in the top section now. Drafts mirror the server state but
  // we only push them downstream when the corresponding input isn't
  // focused, so a guest-side state push doesn't yank a char out from
  // under the host mid-typing.
  const [payeeNameDraft, setPayeeNameDraft] = useState("");
  const [payeeNumberDraft, setPayeeNumberDraft] = useState("");
  const payeeNameInputRef = useRef<HTMLInputElement>(null);
  const payeeNumberInputRef = useRef<HTMLInputElement>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptImages, setReceiptImages] = useState<string[] | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Set the moment the guest taps the Swish pay link (which
  // navigates them to the Swish app). After this the primary
  // button splits into a "Pay again" half and an explicit
  // "I'm done" half — committing the row as paid stays an
  // intentional second tap rather than a side-effect of opening
  // the deep link.
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [nameToast, setNameToast] = useState<string | null>(null);
  const [coveringPersonId, setCoveringPersonId] = useState<string | null>(null);
  const [expandedDiners, setExpandedDiners] = useState<Set<string>>(new Set());
  const nameToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // Buffered edits while the pencil-driven editor is open. Save flushes the
  // draft to the server in one editItem call; Cancel just discards.
  type EditDraft = {
    description: string;
    priceInput: string;
    shared: boolean;
    shareCount: number | undefined;
  };
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  // Mirror the items-page price-draft pattern: while a host is typing
  // in the edit form's price field we buffer their keystrokes here so
  // a partial / decimal input isn't immediately re-formatted by the
  // share ↔ total conversion. Committed back to editDraft on blur.
  const [editPriceDraft, setEditPriceDraft] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [donateHref, setDonateHref] = useState("https://ko-fi.com/kvitt");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  // Snapshot of a removed item, shown as a transient undo toast above
  // the sticky footer. Multiple removals stack — each snapshot gets
  // its own toast with its own undo + auto-dismiss timer, so quickly
  // removing several rows doesn't overwrite the previous toast.
  // Claims aren't restored — the addItem action only round-trips
  // description/price/shared/shareCount/category/emoji.
  type RemovedSnapshot = {
    /** Unique id for this removal event, used as the React key and
     *  to address the toast for dismiss / undo without colliding
     *  on duplicate descriptions. */
    id: string;
    description: string;
    priceOre: number;
    shared: boolean;
    shareCount?: number;
    category?: string;
    emoji?: string;
    /** Position in state.items at the time of removal, so undo can restore
     *  the row in its original slot rather than appending it to the end. */
    index: number;
  };
  const [pendingUndos, setPendingUndos] = useState<RemovedSnapshot[]>([]);
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const timers = undoTimers.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  // Sync the payee name / number drafts FROM the server state, but
  // only when the input isn't focused — otherwise a live update from
  // another client (or the guest list mutating, which triggers a
  // state refresh) would clobber whatever the host is typing.
  useEffect(() => {
    if (!state) return;
    if (payeeNameInputRef.current !== document.activeElement) {
      setPayeeNameDraft(state.payeeName ?? "");
    }
    if (payeeNumberInputRef.current !== document.activeElement) {
      setPayeeNumberDraft(state.payeeNumber ?? "");
    }
  }, [state?.payeeName, state?.payeeNumber]);

  // Positive toast surfaced when an edit flips an item from
  // not-fully-shared → fully-shared. Auto-dismisses after ~4 s so it
  // doesn't linger over the bottom action row.
  const [markedSharedToast, setMarkedSharedToast] = useState<{ description: string } | null>(null);
  const markedSharedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Promote-to-shared animation. Two pieces of state cooperate:
  //   • promoteRequestRef caches the source rect captured BEFORE the
  //     edit is applied (so the edit form is still on screen).
  //   • flyingItem is the live ghost data once we've resolved the
  //     target rect from sharedHeaderRef on the next layout pass.
  // The shared-section header gets a ref so we can grab its bounding
  // rect for the target, even when the section is collapsed (the
  // header still exists; only the drawer is height 0).
  const sharedHeaderRef = useRef<HTMLButtonElement>(null);
  type FlyRect = { x: number; y: number; w: number; h: number };
  type PromoteRequest = {
    description: string;
    emoji?: string;
    category?: string;
    source: FlyRect;
  };
  const promoteRequestRef = useRef<PromoteRequest | null>(null);
  const [flyingItem, setFlyingItem] = useState<{
    description: string;
    emoji?: string;
    category?: string;
    source: FlyRect;
    target: { x: number; y: number };
  } | null>(null);
  const flyingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!markedSharedToast) return;
    if (markedSharedTimer.current) clearTimeout(markedSharedTimer.current);
    markedSharedTimer.current = setTimeout(() => setMarkedSharedToast(null), 4200);
    return () => { if (markedSharedTimer.current) clearTimeout(markedSharedTimer.current); };
  }, [markedSharedToast]);

  // Long-press → inline edit for description or price. The pencil button is
  // still there for "full" edits (shared, split count, delete); this is the
  // shortcut for the most common fixes (the OCR's typo, the wrong digit).
  type ExpandedItemState = {
    item: RoomState["items"][number];
    sourceRect: { top: number; left: number; width: number; height: number; bottom: number };
  };
  const [expandedItem, setExpandedItem] = useState<ExpandedItemState | null>(null);
  const lpSourceElement = useRef<HTMLElement | null>(null);
  const peekItemIdRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  const lpStart = useRef({ x: 0, y: 0 });
  const lpPointerId = useRef(-1);

  // FLIP layout animation: when a row is removed and its neighbours shift up
  // (or down — if undo restores an item), animate the movement instead of
  // snapping. Two things conspire on iOS Safari that the v1.x code got wrong:
  //
  // 1. getBoundingClientRect().top is VIEWPORT-relative, so when the address
  //    bar collapses on scroll-stop the viewport gets taller and every row's
  //    top shifts. Add window.scrollY to anchor the stored positions to the
  //    document instead — invariant under viewport resize.
  // 2. The effect must only re-measure when the items SET actually changes.
  //    With no deps it ran on every DO live-state push (state objects are
  //    fresh JSON each round-trip), and combined with #1 produced a ~10 px
  //    translateY animation on every render after a scroll. Gate on a
  //    signature of item ids in order so unrelated state updates skip it.
  const rowPositionsRef = useRef<Map<string, number>>(new Map());
  // Signature ("description|priceOre") of an item that was just undone
  // via the undo-toast — the FLIP effect below swipes that item in
  // from the right on its next appearance so the motion mirrors the
  // left-swipe that deleted it.
  const pendingRestoreRef = useRef<string | null>(null);
  // Include shared / shareCount in the signature so the FLIP effect
  // also re-measures when an item flips into / out of the "shared by
  // everyone" section — the row's id is unchanged but its DOM slot
  // moves, and we want the move animated.
  const itemIdsSig = useMemo(
    () =>
      state?.items
        .map((i) => `${i.id}:${i.shared ? 1 : 0}:${i.shareCount ?? 0}`)
        .join("|") ?? "",
    [state?.items],
  );
  useLayoutEffect(() => {
    if (!state) return;
    const scrollY = window.scrollY;
    const next = new Map<string, number>();
    for (const item of state.items) {
      const el = document.querySelector(`[data-item-id="${item.id}"]`);
      if (el instanceof HTMLElement) next.set(item.id, el.getBoundingClientRect().top + scrollY);
    }
    for (const [id, newTop] of next) {
      const oldTop = rowPositionsRef.current.get(id);
      if (oldTop == null) {
        // First appearance for this row. If it matches the
        // pendingRestoreRef signature (an item the host just
        // un-deleted via the undo toast), swipe it in from the
        // right — the mirror of the left-swipe that removed it.
        // Plain newcomers (e.g., addItem from the + form or
        // another user in the room) still just appear in place.
        const sig = pendingRestoreRef.current;
        if (sig) {
          const it = state.items.find((x) => x.id === id);
          if (it && `${it.description}|${it.priceOre}` === sig) {
            pendingRestoreRef.current = null;
            const el = document.querySelector(`[data-item-id="${id}"]`);
            if (el instanceof HTMLElement && typeof el.animate === "function") {
              // Swipe-out went OFF-SCREEN LEFT (translateX(-120%)),
              // so the reverse motion comes back IN from the left.
              el.animate(
                [
                  { transform: "translateX(-120%)", opacity: 0 },
                  { transform: "translateX(0)", opacity: 1 },
                ],
                { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)" },
              );
            }
          }
        }
        continue;
      }
      const dy = oldTop - newTop;
      if (Math.abs(dy) < 1) continue; // didn't move
      const el = document.querySelector(`[data-item-id="${id}"]`);
      if (!(el instanceof HTMLElement)) continue;
      // Skip rows that are mid-swipe (transform is being driven by the
      // pointer handlers) so we don't clobber their slide-out.
      if (el.style.transform && el.style.transform.includes("translateX")) continue;
      // WAAPI instead of CSS transition. The DO polling triggers
      // setState every 2.5 s, so this effect re-fires on each poll;
      // if a previous CSS transition was still mid-flight, the
      // transition:none / reflow / transition:resume dance would jerk
      // the row into a partial frame and then re-animate from there —
      // the jitter the host saw when deleting. WAAPI cancels the
      // in-flight animation cleanly and the next animation starts
      // from the current visual position.
      for (const a of el.getAnimations()) {
        if (a.id === "kvitt-flip") a.cancel();
      }
      const anim = el.animate(
        [
          { transform: `translateY(${dy}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "none" },
      );
      anim.id = "kvitt-flip";
    }
    rowPositionsRef.current = next;
    // Deps only include the items signature + editing / adding flags.
    // `state` itself is NOT a dep on purpose: server polling brings
    // back a fresh state object every 2.5 s with the exact same
    // items, and including it here re-fired the FLIP on each poll —
    // when a delete had just kicked off its animation, the second
    // fire mid-animation produced visible jitter on the rows below.
    // itemIdsSig already changes whenever ids / shared / shareCount
    // shift, and editingItemId / addingItem cover the edit-form
    // height swap.
  }, [itemIdsSig, editingItemId, addingItem]);

  // After the items state lands with a freshly promoted row, look up
  // the shared section header's position and seed flyingItem with both
  // source + target rects. Runs on every items change but only does
  // anything when promoteRequestRef has been staged by saveEdit.
  useLayoutEffect(() => {
    const req = promoteRequestRef.current;
    if (!req) return;
    const targetEl = sharedHeaderRef.current;
    if (!targetEl) return;
    const t = targetEl.getBoundingClientRect();
    promoteRequestRef.current = null;
    setFlyingItem({
      description: req.description,
      emoji: req.emoji,
      category: req.category,
      source: req.source,
      target: { x: t.left + t.width / 2, y: t.top + t.height / 2 },
    });
  }, [itemIdsSig]);

  // Play the fly-to-shared animation imperatively via WAAPI. Drawn out
  // in three beats so the host can actually follow what's happening:
  //   1) lift  (0 → 18 %)  the row hops up a few px + scales up
  //             slightly, like it's being picked off the table
  //   2) float (18 → 45 %) it just hovers there for a beat
  //   3) glide (45 → 100 %) it travels to the shared section header
  //                          while shrinking + fading into the slot
  // Total ~1.25 s. Per-keyframe easings so each phase has its own
  // curve (pop-in for the lift, near-linear for the float, ease-in
  // for the glide so it accelerates into its landing).
  useLayoutEffect(() => {
    if (!flyingItem || !flyingRef.current || typeof flyingRef.current.animate !== "function") return;
    const dx = flyingItem.target.x - (flyingItem.source.x + flyingItem.source.w / 2);
    const dy = flyingItem.target.y - (flyingItem.source.y + flyingItem.source.h / 2);
    const anim = flyingRef.current.animate(
      [
        { transform: "translate(0px, 0px) scale(1)", opacity: 1, offset: 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        { transform: "translate(0px, -14px) scale(1.04)", opacity: 1, offset: 0.18, easing: "linear" },
        { transform: "translate(0px, -14px) scale(1.04)", opacity: 1, offset: 0.45, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(0.72)`, opacity: 1, offset: 0.80 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0, offset: 1 },
      ],
      { duration: 1250, fill: "forwards" },
    );
    const clear = () => setFlyingItem(null);
    anim.onfinish = clear;
    return () => { anim.cancel(); };
  }, [flyingItem]);

  // Swipe-left-to-remove on claim rows. Pure DOM transforms during the drag
  // (no React re-renders for smoothness); React only re-renders on commit
  // when removeItemRow runs and the row's actual data is gone.
  //
  // These handlers are intentionally NOT wrapped in useCallback. They close
  // over `state` (read inside removeItemRow) and `setState` from the latest
  // render; an empty-deps useCallback would freeze them on render 1 when
  // state was still null, so the commit timeout would call a stale
  // removeItemRow that bailed out before snapshotting anything for the
  // undo toast. Re-creating per render is cheap (the row re-renders anyway).
  const swipeRef = useRef<{
    el: HTMLDivElement;
    startX: number;
    startY: number;
    armed: boolean;
    itemId: string;
  } | null>(null);
  const onSwipeStart = (e: React.PointerEvent<HTMLDivElement>, itemId: string) => {
    swipeRef.current = {
      el: e.currentTarget,
      startX: e.clientX,
      startY: e.clientY,
      armed: false,
      itemId,
    };
  };
  const onSwipeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.armed) {
      // Need a clear horizontal intent before we hijack the gesture: at
      // least 6 px of total movement AND dx larger than dy by a healthy
      // margin so vertical jitter on a scroll attempt doesn't accidentally
      // arm a swipe.
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) {
        // Vertical-dominant → it's a scroll. Abandon.
        swipeRef.current = null;
        return;
      }
      s.armed = true;
      try { s.el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      // Cancel any concurrent long-press detection while swiping.
      if (lpTimer.current) {
        clearTimeout(lpTimer.current);
        lpTimer.current = null;
      }
    }
    // Both directions are real actions now (left = remove, right =
    // edit), so the transform tracks 1:1 without rubber-banding.
    s.el.style.transform = `translateX(${dx}px)`;
    s.el.style.transition = "";
    // Light up only the reveal layer the user is actively pulling
    // toward — the opposite side stays at opacity 0, so a spring-
    // back bounce never paints the wrong-direction colour.
    showRevealForDirection(s.el, dx);
  };
  const onSwipeEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = swipeRef.current;
    if (!s || !s.armed) {
      swipeRef.current = null;
      return;
    }
    const dx = e.clientX - s.startX;
    const threshold = 110;
    const el = s.el;
    const itemId = s.itemId;
    if (dx < -threshold) {
      // Left commit: slide the row off-screen, fade, then drop it.
      el.style.transition = "transform 200ms ease-out, opacity 200ms ease-out";
      el.style.transform = "translateX(-120%)";
      el.style.opacity = "0";
      window.setTimeout(() => removeItemRow(itemId), 180);
    } else if (dx > threshold) {
      // Right commit: spring back and open the edit form for this row.
      el.style.transition = "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.transform = "translateX(0)";
      const it = state?.items.find((i) => i.id === itemId);
      if (it) openEdit(it);
    } else {
      // Spring back to neutral.
      el.style.transition = "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.transform = "translateX(0)";
    }
    // Drop the reveal layers the moment the gesture is over — the
    // row's spring-back animation runs against bare background,
    // not against a lingering pink/red plate.
    hideReveals(el);
    swipeRef.current = null;
  };
  const onSwipeCancel = () => {
    const s = swipeRef.current;
    if (s?.armed) {
      s.el.style.transition = "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      s.el.style.transform = "translateX(0)";
      hideReveals(s.el);
    }
    swipeRef.current = null;
  };
  // Helpers for the swipe-reveal opacity dance — pulled out so the
  // pointer move / up / cancel branches stay readable.
  const showRevealForDirection = (rowEl: HTMLElement, dx: number) => {
    const wrapper = rowEl.parentElement;
    if (!wrapper) return;
    const edit = wrapper.querySelector<HTMLElement>("[data-reveal=\"edit\"]");
    const del = wrapper.querySelector<HTMLElement>("[data-reveal=\"delete\"]");
    if (edit) edit.style.opacity = dx > 0 ? "1" : "0";
    if (del) del.style.opacity = dx < 0 ? "1" : "0";
  };
  const hideReveals = (rowEl: HTMLElement) => {
    const wrapper = rowEl.parentElement;
    if (!wrapper) return;
    const edit = wrapper.querySelector<HTMLElement>("[data-reveal=\"edit\"]");
    const del = wrapper.querySelector<HTMLElement>("[data-reveal=\"delete\"]");
    if (edit) edit.style.opacity = "0";
    if (del) del.style.opacity = "0";
  };
  const cancelLongPress = useCallback(() => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  }, []);
  const startLongPress = useCallback((onFire: () => void) => (e: React.PointerEvent) => {
    lpFired.current = false;
    lpStart.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      lpTimer.current = null;
      onFire();
      // Subtle haptic so the user knows the edit was armed.
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    }, 450);
  }, [cancelLongPress]);
  const moveLongPress = useCallback((e: React.PointerEvent) => {
    if (!lpTimer.current) return;
    const dx = e.clientX - lpStart.current.x;
    const dy = e.clientY - lpStart.current.y;
    if (dx * dx + dy * dy > 64) cancelLongPress();
  }, [cancelLongPress]);
  const swallowLongPressClick = useCallback((e: React.MouseEvent) => {
    if (lpFired.current) {
      e.preventDefault();
      e.stopPropagation();
      lpFired.current = false;
    }
  }, []);
  useEffect(() => () => cancelLongPress(), [cancelLongPress]);
  const showNameToast = useCallback((desc: string) => {
    setNameToast(desc);
    if (nameToastTimer.current) clearTimeout(nameToastTimer.current);
    nameToastTimer.current = setTimeout(() => setNameToast(null), 2500);
  }, []);
  // Keep stateRef current so showPeek's move handler can read fresh state
  // without a stale closure.
  stateRef.current = state;
  const showPeek = useCallback((it: RoomState["items"][number], sourceEl: HTMLElement) => {
    const r = sourceEl.getBoundingClientRect();
    peekItemIdRef.current = it.id;
    setExpandedItem({ item: it, sourceRect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom } });
    // Capture the pointer so the browser can't reclaim it for scrolling and fire
    // pointercancel (which would dismiss the peek immediately on finger move).
    const pid = lpPointerId.current;
    try { if (pid >= 0) sourceEl.setPointerCapture(pid); } catch {}
    const moveHandler = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const rowEl = el?.closest<HTMLElement>("[data-item-id]");
      if (!rowEl) return;
      const itemId = rowEl.dataset.itemId;
      if (!itemId || itemId === peekItemIdRef.current) return;
      const found = stateRef.current?.items.find((i) => i.id === itemId);
      if (!found) return;
      peekItemIdRef.current = itemId;
      const rect = rowEl.getBoundingClientRect();
      setExpandedItem({ item: found, sourceRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height, bottom: rect.bottom } });
    };
    const endHandler = () => {
      document.removeEventListener("pointermove", moveHandler);
      document.removeEventListener("pointerup", endHandler);
      document.removeEventListener("pointercancel", endHandler);
      peekItemIdRef.current = null;
      setExpandedItem(null);
    };
    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", endHandler);
    document.addEventListener("pointercancel", endHandler);
  }, []); // refs + stable setters only

  const t = Rx[lang];
  const tx = translations[lang];

  // When the host lands here from createRoom (?invite=1), pop the
  // QR/share dialog AFTER the room-enter slide finishes so the
  // dialog grows out of an already-settled QR target instead of one
  // that's still translating in from the right. 320 ms = the
  // playRoomEnter duration (280) + a small visual buffer. We also
  // strip the query upfront so a refresh doesn't reopen it.
  // When the host lands here from createRoom (?invite=1), pop the
  // share dialog AFTER the page is actually rendered so openShare()
  // can capture the QR-button rect for the grow/shrink animation.
  // Two effects:
  //   1. On mount: read invite + prewarmed from the URL and strip
  //      them. We stash wantsInvite in a ref because window.history.
  //      replaceState can make useSearchParams re-emit, which would
  //      otherwise lose the flag on the second run.
  //   2. When status flips to "ok": the real <main> with shareOriginRef
  //      attached is now in the DOM, so we can schedule openShare()
  //      and have it capture the origin rect — which is what feeds
  //      the dialog's growing-from / shrinking-back-into animation.
  const inviteOnMountRef = useRef(false);
  const prewarmedOnMountRef = useRef(false);
  // Replay any pending create-room POST the items page stashed before
  // navigating optimistically. The optimistic bootstrap state is
  // already on screen — this effect makes the room real on the
  // server in the background and either swaps in the confirmed
  // state on success, or surfaces an error banner with a retry
  // button on failure. Re-runs whenever createRetryCount ticks
  // (the retry button bumps it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(pendingCreateKey(code));
    if (!raw) return;
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    let cancelled = false;
    let payload: PendingCreatePayload;
    try {
      payload = JSON.parse(raw) as PendingCreatePayload;
    } catch {
      sessionStorage.removeItem(pendingCreateKey(code));
      createInFlightRef.current = false;
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setCreateError(
            (data && typeof data.error === "string" && data.error) || "Could not create the room.",
          );
          createInFlightRef.current = false;
          return;
        }
        // Server confirmed; clear the pending payload so a refresh
        // doesn't replay it, and replace the optimistic state with
        // the canonical one the DO returned. The next poll would
        // pick this up anyway, but doing it here removes any
        // window where someone could see stale optimism.
        sessionStorage.removeItem(pendingCreateKey(code));
        if (data && data.state) setState(data.state as RoomState);
        setCreateError(null);
        createInFlightRef.current = false;
      } catch {
        if (cancelled) return;
        setCreateError("Could not create the room.");
        createInFlightRef.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, createRetryCount]);
  useEffect(() => {
    const wantsInvite = searchParams.get("invite") === "1";
    const wasPrewarmed = searchParams.get("prewarmed") === "1";
    if (!wantsInvite && !wasPrewarmed) return;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      url.searchParams.delete("prewarmed");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    if (wantsInvite) inviteOnMountRef.current = true;
    if (wasPrewarmed) prewarmedOnMountRef.current = true;
  }, [searchParams]);
  useEffect(() => {
    if (status !== "ok" || !inviteOnMountRef.current) return;
    inviteOnMountRef.current = false;
    // Open the share dialog the moment the page is renderable. With
    // the createRoom bootstrap state in place, status flips to "ok"
    // on the first render itself, which means this effect fires in
    // the same commit — the share button ref is already attached,
    // the dialog can grow straight out of its origin, and the host
    // sees the QR ~0 ms after landing on the room instead of after
    // a held-back timeout. Non-prewarmed direct-nav arrivals (rare
    // edge case — invite=1 normally never survives a refresh) get
    // a single rAF of breathing room so the entry slide doesn't
    // collide with the dialog growing in on top of it.
    if (prewarmedOnMountRef.current) {
      openShare();
      return;
    }
    const id = window.requestAnimationFrame(() => openShare());
    return () => window.cancelAnimationFrame(id);
  }, [status]);

  // Trap iOS' edge-swipe-back (and the system back button) so a live room
  // can't be accidentally navigated away from — leaving via the Kvitt UI
  // ("Nytt kvitto" / "Historik") still works because those are <a> links
  // that fully navigate, which unmounts this page and detaches the listener.
  //
  // The previous version pushed one sentinel entry and re-pushed on every
  // popstate. That worked for the first swipe-back but failed on the second:
  // Next.js's own popstate handler treated the pop as a route change, our
  // component unmounted before we could refill, and the next swipe popped
  // the trap-less history.
  //
  // Fix: push MANY sentinel entries, all explicitly pointing at the room's
  // own URL. Popping any of them is a no-op for Next.js (URL didn't change
  // → no route change → no unmount), so the trap stays installed and the
  // user can swipe-back as many times as they like without escaping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const here = window.location.pathname + window.location.search;
    // 30 is plenty: Safari historically caps history at ~50 entries and
    // we want to leave room for the rest of the app's session.
    for (let i = 0; i < 30; i++) {
      window.history.pushState({ kvittTrap: true }, "", here);
    }
    const onPopState = () => {
      // Top up so the buffer can't drain even if the user fling-swipes.
      window.history.pushState({ kvittTrap: true }, "", here);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setLang(detectDefaultLang());
    if (detectCountry() === "SE") {
      // Swish payment link — amount left editable, message pre-filled.
      const payload = JSON.stringify({
        version: 1,
        payee: { value: "0738164635", editable: false },
        amount: { value: 20, editable: true },
        message: { value: "Kvitt", editable: false },
      });
      setDonateHref(`swish://payment?data=${encodeURIComponent(payload)}`);
    }
    // (personId is seeded synchronously from localStorage in its useState
    // initializer — no async read needed here anymore.)
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/room/${code}`, { cache: "no-store" });
      if (res.status === 404) {
        // Only surface "not found" if we've never had a valid state.
        // During the brief window after optimistic navigation the DO
        // may not have persisted yet — the pending-create effect handles that.
        if (!everLoadedRef.current) setStatus("notfound");
        return;
      }
      if (res.status === 503) return setStatus("unavailable");
      if (!res.ok) return;
      setState((await res.json()) as RoomState);
      everLoadedRef.current = true;
      setStatus("ok");
    } catch {
      /* transient network error — keep last state */
    }
  }, [code]);

  // Live updates over a WebSocket to the room's Durable Object. The DO
  // broadcasts full state on every mutation, so claims pop on everyone's
  // phone instantly instead of waiting out the poll interval. Polling
  // below stays as the fallback (and slows way down while the socket is
  // healthy). `next dev` has no DO — the socket just fails and polling
  // carries the room like before.
  const [wsConnected, setWsConnected] = useState(false);
  // Actual-offline detection. The socket layer self-heals (reconnect + the
  // polling fallback), so a flaky-but-connected phone still reconciles
  // silently — we only surface a banner when the device is truly offline,
  // where claims genuinely can't sync until it's back.
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  // Socket messages must not clobber the edit form mid-typing; mirror the
  // edit state into a ref so the handler sees it without resubscribing.
  const editingRef = useRef(false);
  editingRef.current = !!(editingItemId || addingItem);
  const hasRoom = !!state;
  useEffect(() => {
    if (!hasRoom || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let everConnected = false;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const teardownSocket = () => {
      setWsConnected(false);
      if (pingTimer !== undefined) {
        clearInterval(pingTimer);
        pingTimer = undefined;
      }
    };
    const scheduleRetry = () => {
      if (closed) return;
      attempt += 1;
      // Never-connected (e.g. next dev, old deploy): give up after a few
      // tries and let polling own the room. A socket that HAS worked
      // keeps retrying forever — flaky restaurant wifi comes and goes.
      if (!everConnected && attempt > 5) return;
      const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
      retryTimer = window.setTimeout(connect, delay);
    };
    const connect = () => {
      if (closed) return;
      // A previous socket may still be lingering (notably CLOSING when the
      // visibility handler fired). Detach its handlers and tear it down first
      // so its late onclose can't fire scheduleRetry — which would leave two
      // live sockets and two ping intervals racing until one self-heals.
      if (ws) {
        ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }
      teardownSocket();
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      try {
        ws = new WebSocket(`${proto}://${window.location.host}/api/room/${code}/ws`);
      } catch {
        scheduleRetry();
        return;
      }
      ws.onopen = () => {
        attempt = 0;
        everConnected = true;
        setWsConnected(true);
        // Catch anything that happened while we weren't connected.
        refresh();
        pingTimer = window.setInterval(() => {
          try {
            ws?.send("ping");
          } catch {
            /* closing */
          }
        }, 25000);
      };
      ws.onmessage = (e) => {
        if (typeof e.data !== "string" || e.data === "pong") return;
        // Skip while editing — the poll effect refreshes on edit-end.
        if (editingRef.current) return;
        try {
          const msg = JSON.parse(e.data) as { type?: string; state?: RoomState };
          if (msg.type === "state" && msg.state) {
            setState(msg.state);
            everLoadedRef.current = true;
            setStatus("ok");
          }
        } catch {
          /* malformed frame — polling still reconciles */
        }
      };
      ws.onclose = () => {
        teardownSocket();
        scheduleRetry();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          /* already closed */
        }
      };
    };
    // Mobile browsers kill sockets when the tab is backgrounded (e.g. the
    // guest hops to the Swish app to pay). Reconnect the moment they're back.
    const onVisible = () => {
      if (document.visibilityState !== "visible" || closed) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      attempt = 0;
      connect();
    };
    document.addEventListener("visibilitychange", onVisible);
    connect();
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer !== undefined) clearTimeout(retryTimer);
      if (pingTimer !== undefined) clearInterval(pingTimer);
      try {
        ws?.close();
      } catch {
        /* already closed */
      }
      setWsConnected(false);
    };
  }, [hasRoom, code, refresh]);

  useEffect(() => {
    refresh();
    // Pause live polling while editing/adding an item, so it can't clobber inputs.
    if (editingItemId || addingItem) return;
    // With a live socket the poll is just a safety net; without one it's
    // the transport.
    const timer = setInterval(refresh, wsConnected ? 15000 : 2500);
    return () => clearInterval(timer);
  }, [refresh, editingItemId, addingItem, wsConnected]);

  // Remember this room locally so it shows up in history.
  useEffect(() => {
    if (state && personId) {
      addHistory({
        id: code,
        place: state.place,
        date: state.date,
        role: personId === state.payeePersonId ? "host" : "guest",
      });
    }
  }, [state, personId, code]);

  // Drop a stale id if the room no longer knows this person.
  useEffect(() => {
    if (state && personId && !state.people.some((p) => p.id === personId)) {
      setPersonId(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [state, personId, storageKey]);

  // Pre-fetch receipt images as soon as we know there are some, so the
  // peek card can show a cropped strip without waiting for the user to
  // open the receipt viewer. The endpoint is cache-busted by the DO key.
  useEffect(() => {
    if (!state?.imageCount || receiptImages !== null) return;
    // The host lands here on optimistic state (imageCount already set)
    // BEFORE the create-POST has persisted the photos, so the first fetch
    // often comes back empty. Keep retrying until the images show up rather
    // than latching onto that empty result — and use no-store so a cached
    // empty response can't stick. Only commit to [] once we've given the
    // server ample time (a room with imageCount > 0 really does have them).
    let cancelled = false;
    let attempt = 0;
    const load = () => {
      fetch(`/api/room/${code}/images`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { images: [] }))
        .then((d: { images: string[] }) => {
          if (cancelled) return;
          const imgs = d.images ?? [];
          if (imgs.length > 0) {
            setReceiptImages(imgs);
          } else if (attempt < 10) {
            attempt += 1;
            setTimeout(load, 1200 * attempt);
          } else {
            setReceiptImages([]);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 10) {
            attempt += 1;
            setTimeout(load, 1200 * attempt);
          } else {
            setReceiptImages([]);
          }
        });
    };
    load();
    return () => { cancelled = true; };
  }, [state?.imageCount, code, receiptImages]);

  // Drive the join dialog's enter/exit. We only mount it once room state
  // is fully loaded AND the visitor hasn't joined — so a guest sees a
  // plain gray page during the fetch, then the complete dialog fades in
  // (no skeleton, no half-populated state). Joining flips it to fly-out.
  useEffect(() => {
    if (state && !personId) {
      setJoinMounted(true);
      setJoinFlyOut(false);
      const r = requestAnimationFrame(() => setJoinShown(true));
      return () => cancelAnimationFrame(r);
    }
    if (personId) {
      setJoinShown(false);
      setJoinFlyOut(true);
      // Hold the mount long enough for the slowed exit to finish — the
      // 850ms emoji fly is the longest of the exit animations.
      const timer = setTimeout(() => {
        setJoinMounted(false);
        setJoining(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [state, personId]);

  // Focus the name field as soon as the dialog is shown. More reliable
  // than the `autoFocus` attr for an element that mounts asynchronously
  // inside a fading container — and on Android this also pops the
  // keyboard. (iOS won't summon the keyboard without a user gesture; no
  // programmatic workaround exists there.)
  useEffect(() => {
    if (!joinShown) return;
    const r = requestAnimationFrame(() => joinNameRef.current?.focus());
    return () => cancelAnimationFrame(r);
  }, [joinShown]);

  // Lock body scroll while the join dialog is up so the room behind it
  // stays put and non-interactive until the guest has joined. Mirrors the
  // dialog's render condition so it engages in the same frame.
  useEffect(() => {
    if (!(joinMounted || (!!state && !personId))) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [joinMounted, state, personId]);

  async function join() {
    if (!name.trim() || joining) return;
    setJoining(true);
    setJoinError(false);
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", name }),
      });
      if (res.ok) {
        const data = (await res.json()) as { personId: string; state: RoomState };
        setPersonId(data.personId);
        setState(data.state);
        try {
          localStorage.setItem(storageKey, data.personId);
        } catch {
          /* ignore */
        }
        // Leave `joining` on: the dialog now fades out and its exit
        // effect clears the flag once unmounted, so the button keeps its
        // spinner through the transition instead of flashing back to Join.
        return;
      }
      setJoinError(true);
      setJoining(false);
    } catch {
      setJoinError(true);
      setJoining(false);
    }
  }

  async function toggleClaim(itemId: string) {
    if (!personId) return;
    setBusyItem(itemId);
    // Optimistic: flip the claim locally so the tap feels instant. On error we
    // refresh from the server, which restores the truth.
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const i = it.claimedBy.indexOf(personId);
          const claimedBy = i >= 0 ? it.claimedBy.filter((id) => id !== personId) : [...it.claimedBy, personId];
          return { ...it, claimedBy };
        }),
      };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", personId, itemId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    } finally {
      setBusyItem(null);
    }
  }

  async function toggleDone() {
    if (!personId) return;
    setState((prev) => {
      if (!prev) return prev;
      const doneBy = prev.doneBy ?? [];
      const i = doneBy.indexOf(personId);
      const next = i >= 0 ? doneBy.filter((id) => id !== personId) : [...doneBy, personId];
      return { ...prev, doneBy: next };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done", personId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    }
  }

  async function togglePaid(targetId: string) {
    if (!personId) return;
    setState((prev) => {
      if (!prev) return prev;
      const paidBy = prev.paidBy ?? [];
      const i = paidBy.indexOf(targetId);
      const next = i >= 0 ? paidBy.filter((id) => id !== targetId) : [...paidBy, targetId];
      return { ...prev, paidBy: next };
    });
    try {
      const res = await fetch(`/api/room/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "paid", personId, targetId }),
      });
      if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
      else refresh();
    } catch {
      refresh();
    }
  }

  async function postAction(payload: Record<string, unknown>) {
    if (!personId) return;
    const res = await fetch(`/api/room/${code}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, ...payload }),
    });
    if (res.ok) setState(((await res.json()) as { state: RoomState }).state);
  }

  function editItem(itemId: string, patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number }) {
    return postAction({ action: "edit", itemId, ...patch });
  }
  /** Push the current name + number drafts to the server. Called on
   *  blur of either input so the host doesn't need an explicit save
   *  step. */
  async function savePayeeDrafts() {
    if (!state) return;
    const name = payeeNameDraft.trim();
    const number = payeeNumberDraft.trim();
    if (name === state.payeeName && number === state.payeeNumber) return;
    await postAction({ action: "editPayee", name, number });
  }
  /** Bump / drop group size by 1. We post a separate editPayee patch
   *  rather than batching with the name/number so the server's
   *  re-share sweep (which has its own side effects) runs cleanly. */
  async function updateGroupSize(next: number) {
    if (!state) return;
    const clamped = Math.max(2, Math.min(50, Math.round(next)));
    if (clamped === (state.groupSize ?? 0)) return;
    await postAction({ action: "editPayee", groupSize: clamped });
  }

  /** Page-enter pan: when the room page mounts the whole main slides
   *  in from the right + fades up. Matches the items-step entrance in
   *  app/page.tsx so scan → verify → room reads as one flow rather
   *  than a hard cut. Imperative via WAAPI on a stable ref so it
   *  fires exactly once per mount.
   *
   *  Skipped when ?prewarmed=1 — the host is arriving from the items
   *  page's createRoom skeleton, which already slid into place; a
   *  second slide on top would feel like a glitch.
   *
   *  Captured once via useRef so the URL-strip useEffect below
   *  (which removes prewarmed from the address bar) doesn't flip the
   *  flag from true → false before the real <main> mounts. Without
   *  the ref, the post-strip searchParams re-emit would rebuild
   *  playRoomEnter without the prewarmed guard, and the slide would
   *  fire when state finally arrives — producing the double-slide
   *  the host saw. */
  const prewarmedRef = useRef(searchParams.get("prewarmed") === "1");
  const playRoomEnter = useCallback((el: HTMLElement | null) => {
    if (prewarmedRef.current || !el || typeof el.animate !== "function") return;
    // A guest arriving to the join dialog: keep the room perfectly static.
    // Animating it (transform/opacity) promotes it to its own compositor
    // layer, which the dialog's backdrop-filter can't blur until the
    // animation ends — so the guest would briefly read the sharp page.
    if (joinActiveRef.current) return;
    // Otherwise (returning guest / direct nav) a plain fade — no sideways
    // slide, which only made sense for the host's items→room wizard step.
    el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 300, easing: "ease-out", fill: "backwards" },
    );
  }, []);

  /** Edit form mount: the row morphs into the edit form when the host
   *  taps the pencil. Gentle scale + fade on the wrapper so the form
   *  reads as "this row is expanding" rather than just swapping in. */
  const playEditOpen = useCallback((el: HTMLElement | null) => {
    if (!el || typeof el.animate !== "function") return;
    // Set opacity synchronously so there's no flash before the animation.
    // Using fill:"backwards" can leave the element invisible if the
    // animation is paused or cancelled, so we manage it manually instead.
    el.style.opacity = "0";
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.style.opacity = "";
      el.animate(
        [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "scale(1)" }],
        { duration: 160, easing: "ease-out" },
      );
    });
  }, []);

  /** Origin rect captured the moment the host taps any of the share /
   *  QR / copy controls — passed to QrDialog so the dialog grows out
   *  of that spot instead of just popping into the centre. */
  const shareOriginRef = useRef<HTMLDivElement>(null);
  const [shareOrigin, setShareOrigin] = useState<DOMRect | null>(null);
  function openShare() {
    setShareOrigin(shareOriginRef.current?.getBoundingClientRect() ?? null);
    setShareOpen(true);
  }
  function openEdit(it: { id: string; description: string; priceOre: number; shared?: boolean; shareCount?: number }) {
    setEditingItemId(it.id);
    setEditDraft({
      description: it.description,
      priceInput: formatOre(it.priceOre),
      shared: !!it.shared,
      shareCount: it.shareCount,
    });
    setEditPriceDraft(null);
  }
  function cancelEdit() {
    setEditingItemId(null);
    setEditDraft(null);
    setEditPriceDraft(null);
  }
  // Convert a share-price draft back into a total when the host
  // blurs the price field while DELAT is on. Mirrors the items-page
  // commitPriceDraft helper.
  function commitEditPriceDraft() {
    if (editPriceDraft == null || !editDraft) return;
    const parsed = parseAmountToOre(editPriceDraft);
    if (parsed != null) {
      const divisor = editDraft.shareCount && editDraft.shareCount > 0 ? editDraft.shareCount : groupSize;
      const newTotal = editDraft.shared ? parsed * Math.max(1, divisor) : parsed;
      setEditDraft({ ...editDraft, priceInput: formatOre(newTotal) });
    }
    setEditPriceDraft(null);
  }
  async function saveEdit(itemId: string) {
    if (!editDraft) return cancelEdit();
    const before = state?.items.find((i) => i.id === itemId);
    const desc = editDraft.description.trim();
    const priceOre = parseAmountToOre(editDraft.priceInput);
    const patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number } = {};
    if (desc) patch.description = desc;
    if (priceOre != null) patch.priceOre = priceOre;
    patch.shared = editDraft.shared;
    if (editDraft.shared) patch.shareCount = editDraft.shareCount;
    // Did this edit promote the row into the "shared by everyone"
    // section? Then surface the positive toast — the FLIP layout
    // animation will carry the row down to the bottom on its own.
    const wasFully = before ? isFullyShared(before, groupSize) : false;
    const isFully = isFullyShared(
      { shared: !!patch.shared, shareCount: patch.shareCount },
      groupSize,
    );
    await editItem(itemId, patch);
    if (!wasFully && isFully) {
      // Stage a fly-from-source animation. We capture the source rect
      // (the edit form's bounding box) NOW, before the patch is
      // applied; the target rect (the shared section header) only
      // resolves on the next render, so a useLayoutEffect picks it up
      // and seeds the flyingItem state from there.
      const sourceEl = document.querySelector(`[data-item-id="${itemId}"]`);
      if (sourceEl instanceof HTMLElement) {
        const r = sourceEl.getBoundingClientRect();
        promoteRequestRef.current = {
          description: desc || before?.description || "",
          emoji: before?.emoji,
          category: before?.category,
          source: { x: r.left, y: r.top, w: r.width, h: r.height },
        };
      }
      setMarkedSharedToast({ description: desc || before?.description || "" });
    }
    cancelEdit();
  }
  async function removeItemRow(itemId: string) {
    const idx = state?.items.findIndex((i) => i.id === itemId) ?? -1;
    const item = idx >= 0 ? state?.items[idx] : undefined;
    if (item) {
      const snapId = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const snap: RemovedSnapshot = {
        id: snapId,
        description: item.description,
        priceOre: item.priceOre,
        shared: !!item.shared,
        shareCount: item.shareCount,
        category: item.category,
        emoji: item.emoji,
        index: idx,
      };
      setPendingUndos((prev) => [...prev, snap]);
      const timer = setTimeout(() => {
        setPendingUndos((prev) => prev.filter((s) => s.id !== snapId));
        undoTimers.current.delete(snapId);
      }, 6000);
      undoTimers.current.set(snapId, timer);
    }
    // Optimistic: drop the row from local state immediately so the FLIP
    // layout effect can animate the neighbours into the gap right away
    // instead of waiting for the server round-trip. postAction will
    // overwrite with the server's truth when it returns.
    setState((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev));
    await postAction({ action: "removeItem", itemId });
  }
  async function undoRemoval(snapId: string) {
    const snap = pendingUndos.find((s) => s.id === snapId);
    if (!snap) return;
    setPendingUndos((prev) => prev.filter((s) => s.id !== snapId));
    const timer = undoTimers.current.get(snapId);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(snapId);
    // Mark the next-appearing item that matches (description, priceOre)
    // so the FLIP effect can swipe it in from the right — visually the
    // reverse of the left-swipe that removed it. addItem hands us a
    // brand-new id on the server side so we can't address the row
    // ahead of time; matching on the descriptor pair is good enough
    // in practice.
    pendingRestoreRef.current = `${snap.description}|${snap.priceOre}`;
    await postAction({
      action: "addItem",
      description: snap.description,
      priceOre: snap.priceOre,
      shared: snap.shared,
      shareCount: snap.shareCount,
      category: snap.category,
      emoji: snap.emoji,
      // Re-insert at the original position rather than appending.
      index: snap.index,
    });
  }
  async function addItemRow() {
    const priceOre = parseAmountToOre(newPrice) ?? 0;
    if (!newDesc.trim() || priceOre <= 0) return;
    await postAction({ action: "addItem", description: newDesc.trim(), priceOre, shared: false });
    setNewDesc("");
    setNewPrice("");
    setAddingItem(false);
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/${code}` : "";
  const shareText = t.inviteText(state?.place ?? "", state?.date ?? "");

  async function openReceipt() {
    setReceiptOpen(true);
    if (receiptImages !== null) return;
    try {
      const res = await fetch(`/api/room/${code}/images`, { cache: "force-cache" });
      if (res.ok) {
        const data = (await res.json()) as { images: string[] };
        setReceiptImages(data.images ?? []);
      } else {
        setReceiptImages([]);
      }
    } catch {
      setReceiptImages([]);
    }
  }

  const { shares, unassignedOre } = useMemo(() => {
    if (!state) return { shares: [] as Share[], unassignedOre: 0 };
    const diners: Diner[] = state.people.map((p) => ({ id: p.id, name: p.name }));
    return computeRoomShares(state.items, diners, state.tipOre, state.groupSize ?? 0);
  }, [state]);

  const myShare = shares.find((s) => s.dinerId === personId);
  const isPayee = !!state && personId === state.payeePersonId;
  const nameById = useMemo(() => new Map((state?.people ?? []).map((p) => [p.id, p.name])), [state]);

  // Join dialog — extracted so it can render over the loading skeleton
  // too: a guest opening a link lands straight on the (blurred) dialog
  // instead of flashing the bare items skeleton first. The meal/host
  // context and emojis fill in once state arrives; the name field is
  // there from the first frame.
  // Render the moment state is ready & the visitor hasn't joined (so the
  // blurred backdrop is up in the same frame the room appears — no sharp
  // items flash), and keep it mounted through the fly-out via joinMounted.
  const joinActive = joinMounted || (!!state && !personId);
  joinActiveRef.current = joinActive;
  const joinDialog = joinActive ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-dialog-title"
      className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-24"
    >
      {/* Backdrop: blur is on from the first frame so the room behind is
          never shown sharp (no items flash); it only fades out on join.
          The card + emojis fade in over it. Separate from the card so the
          flying emojis stay crisp. */}
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity ease-out ${
          joinFlyOut ? "duration-700 opacity-0" : "duration-300 opacity-100"
        }`}
      />
      <div className="relative w-full max-w-md">
        <div
          className={`relative rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-black/10 transition-opacity ease-out ${
            joinFlyOut ? "duration-700" : "duration-300"
          } ${joinShown ? "opacity-100" : "opacity-0"}`}
        >
          {/* Compact context: meal name, then the date and who paid. */}
          {state && (
            <div className="mb-4">
              <h2 id="join-dialog-title" className="truncate text-lg font-bold text-ink">{state.place || "Kvitt"}</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {formatReceiptDate(state.date, lang)} · {t.paidBy} {state.payeeName || tx.genericHostName}
              </p>
            </div>
          )}
          <input
            ref={joinNameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            onKeyDown={(e) => e.key === "Enter" && join()}
            autoFocus
            autoCapitalize="sentences"
            className="w-full rounded-xl bg-gray-50 px-4 py-3 outline-none"
          />
          {joinError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {t.joinFailed}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              // Super-clear press: a quick squash then an overshoot pop so
              // the tap registers unmistakably before the dialog leaves.
              if (typeof e.currentTarget.animate === "function") {
                e.currentTarget.animate(
                  [
                    { transform: "scale(1)" },
                    { transform: "scale(0.9)", offset: 0.3 },
                    { transform: "scale(1.06)", offset: 0.65 },
                    { transform: "scale(1)" },
                  ],
                  { duration: 360, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
                );
              }
              join();
            }}
            disabled={!name.trim() || joining}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-swish px-4 py-3.5 font-semibold text-white active:bg-swish-dark disabled:opacity-50"
          >
            {joining && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
            )}
            {joining ? t.joining : t.join}
          </button>
        </div>
        {/* Distinct item emojis from the receipt, spilling around the card
            edges and gently bobbing. Sits OUTSIDE the fading card so on
            join it can fly off-screen while the card + backdrop fade.
            Favours standard emojis over our custom icons; deduped by
            resolved icon; positions fixed per slot (not random). */}
        {(() => {
          const seen = new Set<string>();
          const standard: RoomState["items"] = [];
          const custom: RoomState["items"] = [];
          for (const it of state?.items ?? []) {
            const key = emojiFor(it.description, it.category, it.emoji);
            if (seen.has(key)) continue;
            seen.add(key);
            (key.startsWith("ci:") ? custom : standard).push(it);
          }
          // Real emojis first; only fall back to custom icons to fill out.
          const picks = [...standard, ...custom].slice(0, 6);
          // Resting position anchored to the card edge; fx/fy/spin is the
          // outward launch it takes when flying off on join.
          const SCATTER: Array<Record<string, string | number>> = [
            { top: "-22px", left: "5%", rot: -18, cls: "text-5xl", dur: 3.4, fx: -170, fy: -280, spin: -60 },
            { top: "-14px", right: "10%", rot: 14, cls: "text-4xl", dur: 2.9, fx: 180, fy: -280, spin: 60 },
            { top: "32%", left: "-20px", rot: -12, cls: "text-4xl", dur: 3.8, fx: -340, fy: -40, spin: -90 },
            { top: "44%", right: "-18px", rot: 16, cls: "text-5xl", dur: 3.1, fx: 340, fy: 50, spin: 90 },
            { bottom: "-20px", left: "14%", rot: 10, cls: "text-4xl", dur: 3.6, fx: -190, fy: 340, spin: -70 },
            { bottom: "-12px", right: "20%", rot: -15, cls: "text-4xl", dur: 2.7, fx: 210, fy: 360, spin: 80 },
          ];
          return picks.length > 0 ? (
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${
                joinShown || joinFlyOut ? "opacity-100" : "opacity-0"
              }`}
            >
              {picks.map((it, i) => {
                const s = SCATTER[i % SCATTER.length];
                const rest = `translate(0px, 0px) rotate(${s.rot}deg) scale(1)`;
                const flown = `translate(${s.fx}px, ${s.fy}px) rotate(${Number(s.rot) + Number(s.spin)}deg) scale(0.6)`;
                return (
                  <span
                    key={it.id}
                    className={`absolute leading-none ${s.cls}`}
                    style={{
                      top: s.top,
                      bottom: s.bottom,
                      left: s.left,
                      right: s.right,
                      transform: joinFlyOut ? flown : rest,
                      transition: "transform 850ms cubic-bezier(0.4, 0, 0.7, 0.2)",
                    }}
                  >
                    <span
                      className="emoji-float block"
                      style={{ animationDuration: `${s.dur}s`, animationDelay: `${i * 0.3}s` }}
                    >
                      <ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} />
                    </span>
                  </span>
                );
              })}
            </div>
          ) : null;
        })()}
      </div>
    </div>
  ) : null;

  // Re-attempt the room load from the notfound/unavailable dead-ends — a
  // mistyped code stays wrong, but a just-created room that hadn't persisted
  // yet, or a transient 503, recovers without a full reload.
  const retryLoad = () => {
    everLoadedRef.current = false;
    setStatus("loading");
    void refresh();
  };
  // Plain gray page until room state is ready — then the fully-populated
  // join dialog (or the room itself) fades in. No skeleton flash.
  if (status === "loading") return <div className="min-h-dvh" style={{ background: "var(--color-page)" }} />;
  if (status === "notfound") return <Centered><p>{t.notFound}</p><RetryButton onClick={retryLoad} label={TRY_AGAIN[lang] ?? TRY_AGAIN.en} /><HomeLink label={t.toStart} /></Centered>;
  if (status === "unavailable") return <Centered><p>{t.unavailable}</p><RetryButton onClick={retryLoad} label={TRY_AGAIN[lang] ?? TRY_AGAIN.en} /><HomeLink label={t.toStart} /></Centered>;
  if (!state) return <div className="min-h-dvh" style={{ background: "var(--color-page)" }} />;

  const roomFx: Fx =
    state.currency && state.currency !== "SEK" && state.rate > 0
      ? { currency: state.currency, rate: state.rate }
      : null;

  // What the host still needs to collect: everyone else's shares (minus those
  // already paid), PLUS items that are still unassigned. The host paid the
  // full bill, so anything they haven't claimed for themselves is still owed
  // by someone — whether they've claimed yet or not.
  const paidSet = new Set(state.paidBy ?? []);
  const otherShares = shares.filter((s) => s.dinerId !== state.payeePersonId && s.totalOre > 0);
  const paidCount = otherShares.filter((s) => paidSet.has(s.dinerId)).length;
  const unpaidOthersOre = otherShares.filter((s) => !paidSet.has(s.dinerId)).reduce((a, s) => a + s.totalOre, 0);
  const toCollectOre = unpaidOthersOre + unassignedOre;
  const claimedNamesFor = (dinerId: string) =>
    state.items.filter((i) => i.claimedBy.includes(dinerId)).map((i) => i.description);

  const peopleCount = Math.max(1, state.people.length);
  // Group size used for share-count defaults and the +/− cap. Prefer the host's
  // intended head count; otherwise grow with the actual people in the room.
  const groupSize = Math.max(2, peopleCount, state.groupSize ?? 0);
  const isMine = (it: RoomState["items"][number]) => !!personId && it.claimedBy.includes(personId);

  // One row in the claim list: an inline editor when it's being edited, else a
  // tappable claim row with a pencil to edit. Reused for the shared group and
  // each category section.
  function claimItemRow(it: RoomState["items"][number]) {
    if (editingItemId === it.id && editDraft) {
      // Card chrome + inner layout matches the validation step row
      // 1-for-1 (single column, icon · description · price column
      // with stepper, DELAT toggle inline below). The differences
      // from validation are scoped to the buffered draft state
      // (editDraft / editPriceDraft) and the Save / Cancel / Delete
      // row below the card, which the live items-page row doesn't
      // need because it writes through every keystroke.
      const dv = editDraft.shareCount && editDraft.shareCount > 0 ? editDraft.shareCount : groupSize;
      const draftTotalOre = parseAmountToOre(editDraft.priceInput) ?? 0;
      const priceDisplay =
        editPriceDraft != null
          ? editPriceDraft
          : editDraft.shared
          ? formatOre(Math.floor(draftTotalOre / Math.max(1, dv)))
          : editDraft.priceInput;
      return (
        <div ref={playEditOpen} key={it.id} data-item-id={it.id} className="origin-top space-y-2">
          <div
            className="min-w-0 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5"
          >
            {/* Top row: items-start so the description never
                drifts to the middle of the card as the row's
                height grows under it. Matches the validation
                step row. */}
            <div className="flex items-start gap-2">
              <span aria-hidden className="pl-1 pt-1.5 text-3xl leading-none">
                <ItemEmoji description={editDraft.description} hint={it.category} modelEmoji={it.emoji} />
              </span>
              <input
                value={editDraft.description}
                onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                placeholder={t.descPh}
                className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
              />
              <div className="flex w-20 shrink-0 flex-col items-stretch gap-1">
                <input
                  value={priceDisplay}
                  onChange={(e) => setEditPriceDraft(e.target.value)}
                  onBlur={commitEditPriceDraft}
                  inputMode="decimal"
                  placeholder={t.pricePh}
                  className="w-full rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                />
              </div>
              <span
                aria-hidden={!editDraft.shared}
                className={`shrink-0 self-start overflow-hidden whitespace-nowrap pt-2 text-base text-gray-400 transition-[max-width,opacity,padding] duration-220 ease-out ${
                  editDraft.shared ? "max-w-[80px] pl-1 opacity-100" : "max-w-0 pl-0 opacity-0"
                }`}
              >
                {tx.perShareUnit}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              {/* DELAT toggle on the left, share stepper on the
                  right of the same row. Stepper slides in from
                  the right when DELAT flips on. Mirror of the
                  validation step layout. */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  role="switch"
                  onClick={() =>
                    setEditDraft({
                      ...editDraft,
                      shared: !editDraft.shared,
                      shareCount: editDraft.shared ? undefined : editDraft.shareCount,
                    })
                  }
                  aria-checked={editDraft.shared}
                  aria-label={tx.sharedToggle}
                  className="-m-2 inline-flex items-center gap-2.5 p-2"
                >
                  <span
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      editDraft.shared ? "bg-swish" : "bg-gray-300"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        editDraft.shared ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </span>
                  <span className={`text-sm font-semibold uppercase tracking-wide ${editDraft.shared ? "text-swish-dark" : "text-gray-500"}`}>
                    {tx.sharedLabel}
                  </span>
                </button>
                <div
                  aria-hidden={!editDraft.shared}
                  className={`overflow-hidden transition-all duration-220 ease-out ${
                    editDraft.shared ? "max-w-[180px] opacity-100" : "pointer-events-none max-w-0 opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-1.5 pl-1">
                    <button
                      type="button"
                      aria-label="−"
                      tabIndex={editDraft.shared ? 0 : -1}
                      onClick={() => setEditDraft({ ...editDraft, shareCount: Math.max(2, dv - 1) })}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-base font-bold leading-none text-gray-600 active:bg-gray-200"
                    >
                      −
                    </button>
                    <span className="w-12 text-center text-lg font-normal tabular-nums text-ink">{dv}/{groupSize}</span>
                    <button
                      type="button"
                      aria-label="+"
                      tabIndex={editDraft.shared ? 0 : -1}
                      disabled={dv >= groupSize}
                      onClick={() => setEditDraft({ ...editDraft, shareCount: dv + 1 >= groupSize ? undefined : dv + 1 })}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-base font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 active:bg-gray-100"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => saveEdit(it.id)}
                className="rounded-xl bg-swish px-4 py-2 text-sm font-semibold text-white active:bg-swish-dark"
              >
                {t.save}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { removeItemRow(it.id); cancelEdit(); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200 active:bg-red-100"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 6h18" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              {t.removeRow}
            </button>
          </div>
        </div>
      );
    }
    const mine = isMine(it);
    // For shared items, show "X/Y" — X people have taken a share, Y total
    // shares — so the table can see the group size at a glance. Partial
    // shares (Y < groupSize) still dim and disable the row once every share
    // is taken by someone other than the viewer.
    const partialShare = it.shared && !isFullyShared(it, groupSize);
    const shareCap = it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize;
    const sharesTaken = it.claimedBy.length;
    const sharesFull = partialShare && !mine && sharesTaken >= shareCap;
    return (
      <div key={it.id} className="relative">
        {/* Reveal layers behind the row, hidden until the user is
            actively swiping. opacity-0 keeps them out of sight at rest;
            swipe handlers flip opacity imperatively during the gesture. */}
        <div className="pointer-events-none absolute inset-0 flex overflow-hidden rounded-2xl">
          <div data-reveal="edit" className="flex flex-1 items-center bg-gray-600 pl-5 text-white opacity-0">
            <PencilIcon size={22} />
          </div>
          <div data-reveal="delete" className="flex flex-1 items-center justify-end bg-red-600 pr-5 text-white opacity-0">
            <TrashIcon size={22} />
          </div>
        </div>
        <div
          data-item-id={it.id}
          role="button"
          tabIndex={sharesFull ? -1 : 0}
          aria-pressed={mine}
          aria-disabled={sharesFull}
          onPointerDown={(e) => {
            if (e.target instanceof Element && e.target.closest("button,input")) return;
            lpSourceElement.current = e.currentTarget as HTMLElement;
            lpPointerId.current = e.pointerId;
            onSwipeStart(e, it.id);
            startLongPress(() => {
              const el = lpSourceElement.current;
              if (el) showPeek(it, el);
            })(e);
          }}
          onPointerMove={(e) => { onSwipeMove(e); moveLongPress(e); }}
          onPointerUp={(e) => { onSwipeEnd(e); cancelLongPress(); }}
          onPointerCancel={() => { onSwipeCancel(); cancelLongPress(); }}
          onClick={(e) => {
            if (lpFired.current) { lpFired.current = false; return; }
            if (sharesFull || busyItem === it.id) return;
            if (e.target instanceof Element && e.target.closest("button")) return;
            toggleClaim(it.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleClaim(it.id);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative flex min-w-0 cursor-pointer touch-pan-y select-none items-center gap-2.5 rounded-2xl p-3 text-left shadow-sm ring-1 transition-colors will-change-transform [-webkit-touch-callout:none] ${
            mine
              ? "bg-[#f4e6ee] ring-swish"
              : sharesFull
              ? "bg-gray-100 text-gray-400 ring-black/5"
              : "bg-white ring-black/5"
          }`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
              mine ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none">
                <ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} />
              </span>
              <span className="min-w-0 flex-1 truncate">{it.description}</span>
              {it.shared && (
                <span className="shrink-0 text-xs font-normal tabular-nums text-gray-400">
                  {sharesTaken}/{shareCap}
                </span>
              )}
            </span>
            {it.shared && (
              <span className="text-[11px] text-swish-dark">
                {partialShare ? `${tx.splitWays} ${shareCap}` : tx.sharedToggle} · <Money ore={it.priceOre} nativeClassName="hidden" />
              </span>
            )}
          </span>
          <span className="flex shrink-0 flex-col items-end leading-tight">
            {it.shared && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t.yourTotal}</span>
            )}
            <Money
              ore={it.shared ? Math.round(it.priceOre / shareCap) : it.priceOre}
              className="text-right text-base font-semibold"
              nativeClassName="hidden"
            />
          </span>
        </div>
      </div>
    );
  }

  type ItemRow = RoomState["items"][number];
  type ItemGroup = { copies: ItemRow[]; mine: ItemRow[]; available: ItemRow[]; others: ItemRow[] };

  /** Build a (description+price+shareCount) key so identical copies
   *  group together — but bail out on shared rows so they render
   *  individually via claimItemRow. The multi-copy renderer doesn't
   *  carry the "Dela på N · price" partial-share indicator + per-row
   *  share count, so grouping a partial-share would hide who's in
   *  on it; per-row keeps that surfaced. */
  function groupKey(it: ItemRow): string {
    if (it.shared) return it.id;
    return `${it.description}|${it.priceOre}|${it.shareCount ?? ""}`;
  }

  /** Render one group of identical (non-shared) copies as a single claim row.
   *  Single-copy groups fall through to the existing claimItemRow so nothing
   *  changes for them; multi-copy groups show a counter when the user has any. */
  function renderClaimGroup(g: ItemGroup) {
    const rep = g.copies[0];
    const editingCopy = g.copies.find((c) => c.id === editingItemId);
    if (editingCopy) return claimItemRow(editingCopy);
    if (g.copies.length === 1) return claimItemRow(rep);

    const mineCount = g.mine.length;
    const availableCount = g.available.length;
    const taken = mineCount > 0;
    const myTotalOre = mineCount * rep.priceOre;

    const claimOne = () => g.available.length > 0 && toggleClaim(g.available[0].id);
    const releaseOne = () => g.mine.length > 0 && toggleClaim(g.mine[g.mine.length - 1].id);
    const tapRow = () => {
      if (availableCount > 0) claimOne();
      else if (mineCount > 0) releaseOne();
    };

    return (
      <div key={rep.id} className="flex flex-col gap-1">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 flex overflow-hidden rounded-2xl">
            <div data-reveal="edit" className="flex flex-1 items-center bg-gray-600 pl-5 text-white opacity-0">
              <PencilIcon size={22} />
            </div>
            <div data-reveal="delete" className="flex flex-1 items-center justify-end bg-red-600 pr-5 text-white opacity-0">
              <TrashIcon size={22} />
            </div>
          </div>
          <div
            data-item-id={rep.id}
            role="button"
            tabIndex={availableCount === 0 && mineCount === 0 ? -1 : 0}
            aria-pressed={taken}
            onPointerDown={(e) => {
              if (e.target instanceof Element && e.target.closest("button,input")) return;
              lpSourceElement.current = e.currentTarget as HTMLElement;
              lpPointerId.current = e.pointerId;
              onSwipeStart(e, rep.id);
              startLongPress(() => {
                const el = lpSourceElement.current;
                if (el) showPeek(rep, el);
              })(e);
            }}
            onPointerMove={(e) => { onSwipeMove(e); moveLongPress(e); }}
            onPointerUp={(e) => { onSwipeEnd(e); cancelLongPress(); }}
            onPointerCancel={() => { onSwipeCancel(); cancelLongPress(); }}
            onClick={(e) => {
              if (lpFired.current) { lpFired.current = false; return; }
              if (e.target instanceof Element && e.target.closest("button")) return;
              tapRow();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative flex min-w-0 w-full cursor-pointer touch-pan-y select-none items-center gap-2.5 rounded-2xl p-3 text-left shadow-sm ring-1 transition will-change-transform [-webkit-touch-callout:none] ${
              taken ? "bg-[#f4e6ee] ring-swish" : availableCount === 0 && mineCount === 0 ? "bg-gray-100 text-gray-400 ring-black/5" : "bg-white ring-black/5"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                taken ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
              <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none"><ItemEmoji description={rep.description} hint={rep.category} modelEmoji={rep.emoji} /></span>
              <span className="min-w-0 flex-1 truncate">{rep.description}</span>
              {availableCount > 0 && (
                <span className="shrink-0 text-xs font-normal text-gray-400">×{availableCount}</span>
              )}
            </span>
            <Money
              ore={taken ? myTotalOre : rep.priceOre}
              className="shrink-0 text-right text-base font-semibold"
              nativeClassName="hidden"
            />
          </div>
        </div>
        {taken && (
          <div className="flex items-center justify-center gap-3 py-1">
            <button
              type="button"
              disabled={mineCount === 0}
              onClick={releaseOne}
              aria-label="−"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-3xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-semibold tabular-nums text-gray-700">{mineCount}</span>
            <button
              type="button"
              disabled={availableCount === 0}
              onClick={claimOne}
              aria-label="+"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-3xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>
    );
  }

  // Nudge an unpaid guest: share their name + amount + the room link via the
  // native share sheet (SMS/WhatsApp/etc.), falling back to an SMS deep link.
  const remindGuest = (dinerId: string, ore: number) => {
    const name = nameById.get(dinerId) ?? "";
    const amount = roomFx ? (formatNative(ore, roomFx) || `${formatOre(ore)} kr`) : `${formatOre(ore)} kr`;
    const text = `${(REMIND_MSG[lang] ?? REMIND_MSG.en)(name, amount)} ${shareUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ text, url: shareUrl }).catch(() => {});
    } else if (typeof window !== "undefined") {
      window.open(`sms:?&body=${encodeURIComponent(text)}`, "_blank");
    }
  };
  // Offline banner copy. Kept as a local map rather than threaded through the
  // big per-locale `R` dict — a single auxiliary string not worth 12 edits.
  const offlineMsg: Record<Lang, string> = {
    sv: "Offline – ändringar synkas när du är uppkopplad igen",
    en: "You're offline — changes sync when you reconnect",
    de: "Offline – Änderungen werden synchronisiert, sobald du wieder online bist",
    fr: "Hors ligne — les modifications se synchroniseront à la reconnexion",
    es: "Sin conexión — los cambios se sincronizarán al reconectar",
    it: "Offline — le modifiche si sincronizzeranno alla riconnessione",
    nl: "Offline — wijzigingen synchroniseren zodra je weer verbonden bent",
    da: "Offline – ændringer synkroniseres, når du er online igen",
    no: "Frakoblet – endringer synkroniseres når du er tilkoblet igjen",
    fi: "Offline — muutokset synkronoidaan, kun yhteys palaa",
    pl: "Offline — zmiany zsynchronizują się po ponownym połączeniu",
    pt: "Offline — as alterações sincronizam ao reconectar",
  };
  return (
    <FxProvider value={roomFx}>
    {!online && (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-white shadow-md"
      >
        {offlineMsg[lang] ?? offlineMsg.en}
      </div>
    )}
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 pb-56">
      {/* Sticky nav. Three-column grid (matches the home page) keeps
          the wordmark dead-centre. Left column carries the room
          actions (new receipt + history) so they sit together; the
          right column is just the lang toggle. */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex items-center gap-2 justify-self-start">
            <a
              href="/"
              aria-label={t.newReceipt}
              title={t.newReceipt}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-swish text-2xl font-semibold leading-none text-white shadow-sm active:bg-swish-dark"
            >
              +
            </a>
            <a
              href="/history"
              aria-label={t.history}
              title={t.history}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl text-swish-dark active:bg-gray-200"
            >
              🕘
            </a>
          </div>
          <KvittLogo className="justify-self-center" />
          <div className="justify-self-end">
            <LangToggle lang={lang} onChange={(l) => { setLang(l); saveLang(l); }} />
          </div>
        </div>
      </header>

      {/* Wizard progress strip — the room is the "Share" step, the
          last pill in the Scan → Verify → Share flow. Only the host
          walked that flow, so guests (who arrived via a link) don't see
          it — the steps are meaningless to them. */}
      {isPayee && <StepHeader step="share" t={tx} />}

      {/* Wizard slide-in target. Only the body content slides in from
          the right; the sticky nav and step strip above stay anchored
          so the wizard chrome feels continuous between steps. */}
      <div ref={playRoomEnter} className="flex flex-col gap-4">

      {createError && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5" />
              <path d="M12 16h.01" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 leading-snug">{createError}</span>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              createInFlightRef.current = false;
              setCreateRetryCount((n) => n + 1);
            }}
            className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm active:bg-red-700"
          >
            {lang === "sv" ? "Försök igen" : "Retry"}
          </button>
        </div>
      )}

      {/* Share / invite card — place name, live QR + share CTA, and the
          host name / Swish number / group size (editable for the host,
          read-only for guests). order-last drops it to the BOTTOM of the
          page: claiming what you had is the priority, and the QR / host
          details are reference material you reach for afterwards. */}
      <section className="order-last rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start gap-3">
          {/* Title block. min-w-0 + truncate so a long restaurant name
              can shrink instead of pushing the QR off the card. */}
          <div className="min-w-0 flex-1 pt-0.5">
            <h1 className="truncate text-xl font-bold text-ink">{state.place || "Kvitt"}</h1>
            <p className="mt-0.5 text-sm text-gray-500">{formatReceiptDate(state.date, lang)}</p>
            {state.imageCount > 0 && (
              <button
                type="button"
                onClick={openReceipt}
                aria-label={t.showReceipt}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl bg-gray-100 px-3 text-sm font-medium text-ink shadow-sm active:bg-gray-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 2v20l2-1.5L10 22l2-1.5L14 22l2-1.5L18 22V2" />
                  <line x1="9" y1="7" x2="15" y2="7" />
                  <line x1="9" y1="11" x2="15" y2="11" />
                  <line x1="9" y1="15" x2="13" y2="15" />
                </svg>
                {t.showReceipt}
              </button>
            )}
          </div>
          {/* QR opens the share dialog on tap. The ref on the column
              wrapper feeds QrDialog so the dialog grows out of this
              corner of the screen rather than just popping into the
              centre. */}
          <div ref={shareOriginRef} className="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              onClick={openShare}
              aria-label={t.share}
              className="overflow-hidden rounded-lg bg-white p-1 shadow-sm ring-1 ring-black/10 active:bg-gray-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/room/${code}/qr`} alt="" className="block h-[88px] w-[88px]" />
            </button>
          </div>
        </div>
        {isPayee ? (
          <div className="mt-5 grid grid-cols-[1fr_auto] items-start gap-4 border-t border-gray-100 pt-3">
            {/* Column 1: host name + Swish number stacked, both
                full-width inside their column. Header above. */}
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{tx.payerTitle}</p>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
                  </svg>
                </span>
                <input
                  ref={payeeNameInputRef}
                  value={payeeNameDraft}
                  onChange={(e) => setPayeeNameDraft(e.target.value)}
                  onBlur={savePayeeDrafts}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  placeholder={tx.genericHostName}
                  autoComplete="name"
                  className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-base shadow-sm ring-1 ring-black/5 outline-none"
                />
              </div>
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="2" width="12" height="20" rx="2.5" />
                    <path d="M12 18h.01" />
                  </svg>
                </span>
                <input
                  ref={payeeNumberInputRef}
                  value={payeeNumberDraft}
                  onChange={(e) => setPayeeNumberDraft(e.target.value)}
                  onBlur={savePayeeDrafts}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={tx.swishNumber}
                  className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-base shadow-sm ring-1 ring-black/5 outline-none"
                />
              </div>
            </div>
            {/* Column 2: group-size stepper. Header above, then the
                +/− card itself. shrink-0 so it doesn't squeeze the
                inputs column on narrow viewports. */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{tx.groupSizeLabel}</p>
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-black/5">
                <button
                  type="button"
                  aria-label="−"
                  onClick={() => updateGroupSize(groupSize - 1)}
                  disabled={groupSize <= 2 || groupSize <= state.people.length}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-6 text-center text-lg font-bold tabular-nums text-ink">{groupSize}</span>
                <button
                  type="button"
                  aria-label="+"
                  onClick={() => updateGroupSize(groupSize + 1)}
                  disabled={groupSize >= 50}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-gray-100 pt-3 text-sm text-gray-500">
            <span aria-hidden className="text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
              </svg>
            </span>
            <span className="min-w-0 truncate">
              {state.payeeName}
              {state.payeeNumber && <span className="text-gray-400"> · {state.payeeNumber}</span>}
            </span>
          </p>
        )}
        {roomFx && (
          <p className="mt-3 text-center text-xs text-gray-400">
            {state.country ? `${flagEmoji(state.country)} ${regionName(state.country, lang)} · ` : ""}
            {`1 ${roomFx.currency} ≈ ${formatOre(Math.round(roomFx.rate * 100))} SEK`}
          </p>
        )}
      </section>

      {/* Host's primary view: a focused collection summary + diner list at
          the top of the page so the host lands on "what's still owed and
          who hasn't paid" rather than the items grid. Replaces the old
          sticky bottom footer. */}
      {personId && isPayee && (() => {
        const empty = otherShares.length === 0;
        const allPaid = !empty && unpaidOthersOre === 0 && unassignedOre === 0;
        const subtitle = empty
          ? t.waitingForGuests
          : allPaid
          ? t.nobodyOwes
          : t.paidProgress(paidCount, otherShares.length);
        return (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t.remainingToCollect}</span>
            <div className="mt-1">
              <Money ore={toCollectOre} className="block text-4xl font-bold text-swish-dark" />
            </div>
            <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
            {!empty && (
              <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                {otherShares.map((s) => {
                  const isPaid = paidSet.has(s.dinerId);
                  const isDone = (state.doneBy ?? []).includes(s.dinerId);
                  return (
                    <li key={s.dinerId} className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-swish/15 text-xs font-bold text-swish-dark">
                        {initials(nameById.get(s.dinerId) ?? "?")}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {nameById.get(s.dinerId)}
                          {isDone && <span className="ml-1.5 text-[10px] text-emerald-600">{t.doneOn}</span>}
                        </span>
                        <Money
                          ore={s.totalOre}
                          className={`text-[11px] tabular-nums ${isPaid ? "text-gray-400 line-through" : "text-gray-500"}`}
                        />
                      </span>
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => remindGuest(s.dinerId, s.totalOre)}
                          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold text-swish-dark ring-1 ring-swish/30 active:bg-swish/10"
                        >
                          {REMIND_LABEL[lang] ?? REMIND_LABEL.en}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => togglePaid(s.dinerId)}
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-white text-gray-600 ring-gray-300 active:bg-gray-100"
                        }`}
                      >
                        {isPaid ? `✓ ${t.paid}` : t.markPaid}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })()}

      {/* Claiming UI — always rendered. Until a guest has joined, the
          join dialog (joinOverlay, below) floats on top of the blurred
          page so they see the room they're about to join. */}
      {(
        <>
          <section>
            <h2 className="text-xl font-bold">{t.itemsTitle}</h2>
            <p className="text-sm text-gray-600">{t.claimHint}</p>
            <div className="mt-3 space-y-3">
              {CATEGORY_ORDER.map((cat) => {
                // Anything that isn't "shared by everyone" lives in the
                // category sections — including partial shares, which the
                // diner can claim a share of like a multi-copy item.
                const all = state.items.filter(
                  (it) => !isFullyShared(it, groupSize) && categoryFor(it.description, it.category) === cat,
                );
                if (all.length === 0) return null;
                // Group identical copies (same description, price and share count)
                // so "3 × Bryggkaffe" reads as one row with a counter.
                const groupMap = new Map<string, ItemRow[]>();
                for (const it of all) {
                  const k = groupKey(it);
                  const arr = groupMap.get(k) ?? [];
                  arr.push(it);
                  groupMap.set(k, arr);
                }
                const mainGroups: ItemGroup[] = [];
                const othersGroups: ItemGroup[] = [];
                for (const copies of groupMap.values()) {
                  const mine = copies.filter((c) => personId !== null && c.claimedBy.includes(personId));
                  const available = copies.filter((c) => c.claimedBy.length === 0);
                  const others = copies.filter((c) => c.claimedBy.length > 0 && !(personId !== null && c.claimedBy.includes(personId)));
                  // Split mixed groups: the main claim row only counts
                  // mine + available copies (so its ×N badge tracks
                  // claimables), and any copies already taken by other
                  // diners surface as their own strike-through entry in
                  // the "klara" footer below — same treatment a fully
                  // claimed-by-others item gets. Otherwise the row reads
                  // ×1 with no hint that a second copy is gone.
                  if (mine.length > 0 || available.length > 0) {
                    const mainCopies = [...mine, ...available];
                    mainGroups.push({ copies: mainCopies, mine, available, others: [] });
                  }
                  if (others.length > 0) {
                    othersGroups.push({ copies: others, mine: [], available: [], others });
                  }
                }
                const othersClaimerNames = (g: ItemGroup) =>
                  Array.from(new Set(g.copies.flatMap((c) => c.claimedBy)))
                    .map((id) => (id === personId ? t.you : nameById.get(id) ?? "?"))
                    .join(", ");
                const othersTotal = othersGroups.reduce((acc, g) => acc + g.copies.length, 0);
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-base font-bold text-gray-700">
                      <span aria-hidden className="text-2xl leading-none">{CATEGORY_EMOJI[cat]}</span>
                      <span>{CATEGORY_LABEL[lang][cat]}</span>
                    </div>
                    {mainGroups.map(renderClaimGroup)}
                    {othersGroups.length > 0 && (
                      <details className="group rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                        <summary className="flex cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                            <ChevronRightIcon className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-90" />
                          </span>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="inline-flex w-8 shrink-0 items-center justify-center text-xs text-gray-400">✓</span>
                            <span className="min-w-0 flex-1 text-xs font-medium text-gray-500">{t.claimedTitle(othersTotal)}</span>
                          </span>
                        </summary>
                        <div className="mt-2 space-y-1">
                          {othersGroups.map((g) => {
                            const rep = g.copies[0];
                            const totalCount = g.copies.length;
                            return (
                              <div
                                key={rep.id}
                                className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-sm"
                                onPointerDown={startLongPress(() => showNameToast(rep.description))}
                                onPointerMove={moveLongPress}
                                onPointerUp={cancelLongPress}
                                onPointerCancel={cancelLongPress}
                                onClick={swallowLongPressClick}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                <span aria-hidden className="inline-flex w-5 shrink-0 items-center justify-center text-base leading-none">
                                  <ItemEmoji description={rep.description} hint={rep.category} modelEmoji={rep.emoji} />
                                </span>
                                <span className="min-w-0 flex-1 truncate text-gray-400">
                                  {rep.description}
                                </span>
                                {totalCount > 1 && (
                                  <span className="shrink-0 text-gray-400">×{totalCount}</span>
                                )}
                                <span className="shrink-0 text-xs text-gray-400">{othersClaimerNames(g)}</span>
                                <span className="shrink-0 text-gray-400">{formatOre(rep.priceOre)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
              {/* "Shared by everyone" lives at the BOTTOM of the items
                  list. Categories carry the diner's eye first because
                  each diner usually has at least one row of their own
                  there; the shared pile is a summary the whole table
                  participates in equally, so it earns its place under
                  the per-category sections. */}
              {state.items.some((it) => isFullyShared(it, groupSize)) && (() => {
                const sharedItems = state.items.filter((it) => isFullyShared(it, groupSize));
                const mySharedOre = sharedItems.reduce((acc, it) => {
                  if (!personId || !it.claimedBy.includes(personId)) return acc;
                  const divisor = it.shareCount && it.shareCount > 0 ? it.shareCount : groupSize;
                  return acc + Math.floor(it.priceOre / divisor);
                }, 0);
                return (
                  <div className="space-y-2">
                    <button
                      ref={sharedHeaderRef}
                      type="button"
                      onClick={() => setSharedOpen((v) => !v)}
                      aria-expanded={sharedOpen}
                      className="flex w-full items-center justify-between gap-2 rounded-xl py-1 text-left text-base font-bold text-gray-700"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <ChevronRightIcon
                          className={`shrink-0 text-gray-400 transition-transform duration-200 ease-out ${sharedOpen ? "rotate-90" : ""}`}
                        />
                        <span aria-hidden className="text-2xl leading-none">🤝</span>
                        <span className="truncate">
                          {t.sharedSection} <span className="font-medium text-gray-400">({sharedItems.length})</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end leading-tight">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                          {t.yourTotal}
                        </span>
                        <Money ore={mySharedOre} className="font-bold text-swish-dark" nativeClassName="ml-1 text-xs font-normal text-gray-400" />
                      </span>
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        sharedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="-mx-2 min-h-0 overflow-hidden px-2">
                        <div className="space-y-2 pt-1">{sharedItems.map(claimItemRow)}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            {addingItem ? (
              <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-swish/40">
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder={t.descPh}
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                />
                <input
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder={t.pricePh}
                  className="w-20 rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                />
                <button
                  type="button"
                  onClick={addItemRow}
                  disabled={!newDesc.trim() || (parseAmountToOre(newPrice) ?? 0) <= 0}
                  className="rounded-lg bg-swish px-3 py-2 text-sm font-semibold text-white active:bg-swish-dark disabled:opacity-40"
                >
                  {t.addRow}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingItem(false); setNewDesc(""); setNewPrice(""); }}
                  aria-label="✕"
                  className="px-1 text-gray-400 active:text-red-500"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingItem(true)} className="mt-2 text-sm font-medium text-swish-dark active:opacity-70">
                + {t.addRow}
              </button>
            )}
          </section>

          {state.tipOre > 0 && (
            <div className="rounded-2xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              {tx.tipSplitNote(formatOre(state.tipOre))}
            </div>
          )}


          {/* Everyone — guest view only. Hosts have a dedicated diner list
              at the top of the page. */}
          {!isPayee && (
          <section>
            <h2 className="mb-2 text-base font-bold text-gray-700">{t.peopleTitle}</h2>
            <div className="space-y-2">
              {shares.map((s) => {
                const isHostRow = s.dinerId === state.payeePersonId;
                const isPaid = (state.paidBy ?? []).includes(s.dinerId);
                // The host (collector) or the person themselves can settle a share.
                const canToggle = !isHostRow && s.totalOre > 0 && (isPayee || s.dinerId === personId);
                const claimedItems = state.items.filter((i) => i.claimedBy.includes(s.dinerId));
                const isDone = !isHostRow && (state.doneBy ?? []).includes(s.dinerId);
                const isExpanded = expandedDiners.has(s.dinerId);
                const toggleExpanded = () => {
                  if (claimedItems.length === 0) return;
                  setExpandedDiners((prev) => {
                    const next = new Set(prev);
                    if (next.has(s.dinerId)) next.delete(s.dinerId); else next.add(s.dinerId);
                    return next;
                  });
                };
                return (
                  <div key={s.dinerId} className="rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-swish/15 text-xs font-bold text-swish-dark">
                        {initials(nameById.get(s.dinerId) ?? "?")}
                      </span>
                      <button
                        type="button"
                        onClick={toggleExpanded}
                        disabled={claimedItems.length === 0}
                        className="flex min-w-0 flex-1 flex-col text-left disabled:pointer-events-none"
                      >
                        <span className="truncate text-sm font-medium">
                          {nameById.get(s.dinerId)}
                          {isHostRow && <span className="ml-1 text-xs text-gray-400">★</span>}
                          {s.dinerId === personId && <span className="ml-1 text-xs text-gray-400">({lang === "sv" ? "du" : "you"})</span>}
                          {isDone && <span className="ml-1.5 text-xs text-emerald-600">{t.doneOn}</span>}
                        </span>
                        {claimedItems.length > 0 && (
                          <span className="mt-0.5 flex items-center gap-0.5">
                            <ChevronRightIcon className={`mr-0.5 shrink-0 text-gray-300 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                            {claimedItems.slice(0, 6).map((item) => (
                              <span key={item.id} aria-hidden className="text-sm leading-none">
                                <ItemEmoji description={item.description} hint={item.category} modelEmoji={item.emoji} />
                              </span>
                            ))}
                            {claimedItems.length > 6 && (
                              <span className="ml-0.5 text-[10px] text-gray-400">+{claimedItems.length - 6}</span>
                            )}
                          </span>
                        )}
                      </button>
                      {!isHostRow && s.totalOre > 0 ? (
                        <button
                          type="button"
                          onClick={() => canToggle && togglePaid(s.dinerId)}
                          disabled={!canToggle}
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 disabled:opacity-100 ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-white text-gray-500 ring-gray-200"
                          }`}
                        >
                          {isPaid ? `✓ ${t.paid}` : t.markPaid}
                        </button>
                      ) : null}
                      <Money ore={s.totalOre} className={`text-sm font-semibold ${isPaid ? "text-gray-400 line-through" : ""}`} nativeClassName="hidden" />
                    </div>
                    {claimedItems.length > 0 && (
                      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                        <div className="min-h-0 overflow-hidden">
                          <div className="border-t border-gray-50 px-3 pb-3 pt-2">
                            {(() => {
                              // Group by category, aggregate identical copies
                              type DinerLine = { item: typeof claimedItems[0]; count: number; oreEach: number };
                              const catMap = new Map<Category, DinerLine[]>();
                              for (const item of claimedItems) {
                                const cat = categoryFor(item.description, item.category);
                                const denom = item.shared
                                  ? (item.shareCount && item.shareCount > 0 ? item.shareCount : groupSize)
                                  : Math.max(1, item.claimedBy.length);
                                const oreEach = Math.floor(item.priceOre / denom);
                                const lines = catMap.get(cat) ?? [];
                                const existing = lines.find(
                                  (l) => l.item.description === item.description && l.oreEach === oreEach,
                                );
                                if (existing) existing.count++;
                                else lines.push({ item, count: 1, oreEach });
                                catMap.set(cat, lines);
                              }
                              return CATEGORY_ORDER.filter((cat) => catMap.has(cat)).map((cat) => (
                                <div key={cat} className="mt-2 space-y-1 first:mt-0">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    {CATEGORY_LABEL[lang][cat]}
                                  </div>
                                  {catMap.get(cat)!.map((line, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                      <span aria-hidden className="inline-flex w-6 shrink-0 items-center justify-center text-base leading-none">
                                        <ItemEmoji description={line.item.description} hint={line.item.category} modelEmoji={line.item.emoji} />
                                      </span>
                                      <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                                        {line.count > 1 && <span className="text-gray-400 tabular-nums">{line.count}× </span>}
                                        {line.item.description}
                                      </span>
                                      <Money ore={line.count * line.oreEach} className="shrink-0 text-xs tabular-nums text-gray-500" nativeClassName="hidden" />
                                    </div>
                                  ))}
                                </div>
                              ));
                            })()}
                            {roomFx && (
                              <Money
                                ore={s.totalOre}
                                className="mt-2 block text-right text-xs font-semibold text-gray-500"
                                nativeClassName="ml-1 text-xs font-normal text-gray-400"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {unassignedOre > 0 && (
              <p className="mt-2 text-xs text-amber-600"><Money ore={unassignedOre} /> {lang === "sv" ? "ofördelat" : "unassigned"}</p>
            )}
          </section>
          )}
        </>
      )}
      {/* Joined guest who hasn't claimed anything yet (incl. someone who
          opened the link after the bill settled): the pay footer below is
          gated on a non-zero share, so without this they'd see a blank
          action area. Nudge them to tap their items. */}
      {personId && !isPayee && (!myShare || myShare.totalOre === 0) && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-black/5 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center backdrop-blur">
          <p className="text-sm font-medium text-gray-600">👆 {CLAIM_HINT[lang] ?? CLAIM_HINT.en}</p>
        </div>
      )}
      {!isPayee && myShare && myShare.totalOre > 0 && (() => {
        const iAmDone = !!personId && (state.doneBy ?? []).includes(personId);
        const iAmPaid = !!personId && (state.paidBy ?? []).includes(personId);
        // Cart contents — what I'm on the hook for. Lines are
        // bucketed by category (starter / mains / drinks / dessert /
        // other) and rendered as a condensed mirror of the main
        // receipt; shared items sit alongside the guest's own picks
        // under their natural category with a small 🤝 marker, so
        // the cart reads as one coherent list grouped by course
        // rather than splitting "mine" and "shared" into separate
        // piles. Identical copies still aggregate so "3 × Bryggkaffe"
        // is one line with a counter.
        type CartLine = {
          description: string;
          count: number;
          oreEach: number;
          emoji?: string;
          rawCategory?: string;
          category: Category;
          isShared: boolean;
          /** Number of ways a shared item is split — used to render the
           *  "/N" secondary-font marker next to the line. */
          shareCount?: number;
        };
        const lineMap = new Map<string, CartLine>();
        for (const it of state.items) {
          if (!personId || !it.claimedBy.includes(personId)) continue;
          const denom = it.shared
            ? (it.shareCount && it.shareCount > 0 ? Math.min(it.shareCount, groupSize) : groupSize)
            : Math.max(1, it.claimedBy.length);
          const oreEach = Math.floor(it.priceOre / denom);
          const isShared = isFullyShared(it, groupSize);
          const k = `${it.description}|${oreEach}|${isShared ? 1 : 0}|${isShared ? denom : 0}`;
          const ex = lineMap.get(k);
          if (ex) ex.count++;
          else
            lineMap.set(k, {
              description: it.description,
              count: 1,
              oreEach,
              emoji: it.emoji,
              rawCategory: it.category,
              category: categoryFor(it.description, it.category),
              isShared,
              shareCount: isShared ? denom : undefined,
            });
        }
        const linesByCategory: Partial<Record<Category, CartLine[]>> = {};
        for (const line of lineMap.values()) {
          (linesByCategory[line.category] ??= []).push(line);
        }
        // Within each category section, list the guest's own picks
        // first and the shared rows after — gives the column a clear
        // top-to-bottom "yours then shared" rhythm even without an
        // explicit section divider.
        for (const cat of CATEGORY_ORDER) {
          linesByCategory[cat]?.sort((a, b) => {
            if (a.isShared !== b.isShared) return a.isShared ? 1 : -1;
            return b.oreEach * b.count - a.oreEach * a.count;
          });
        }
        // Split the cart count into "items I picked for myself" vs
        // "items the table is sharing that I'm in on". The tip
        // travels separately as state.tipOre — it never appears in
        // state.items here — so a guest who hasn't tapped anything
        // sees "Inget taget än" rather than a count that includes
        // the implicit tip line.
        const mineCount = state.items.filter(
          (it) => !it.shared && personId !== null && it.claimedBy.includes(personId),
        ).length;
        const sharedCount = state.items.filter(
          (it) => it.shared && personId !== null && it.claimedBy.includes(personId),
        ).length;
        const canSwish = !!state.payeeNumber;
        const coverShare = coveringPersonId ? shares.find((s) => s.dinerId === coveringPersonId) : null;
        const coverOre = coverShare?.totalOre ?? 0;
        const swishUri = canSwish
          ? buildSwishUri({
              payee: state.payeeNumber!,
              amountOre: myShare.totalOre + coverOre,
              message: `${myShare.name}${coverShare ? ` + ${coverShare.name}` : ""} - ${state.message ?? ""}`.slice(0, 50),
            })
          : null;
        const coverableShares = shares.filter(
          (s) => s.dinerId !== personId && s.dinerId !== state.payeePersonId && s.totalOre > 0,
        );
        // Explicit "mark me done" — fires when the guest taps the
        // I'm-done half of the split button (no longer wired to
        // the Swish deep-link tap, so opening Swish doesn't silently
        // commit the row as paid). Optimistic local flip + keepalive
        // POST so the action sticks even if the browser hands off
        // to the Swish app right after.
        const markDone = () => {
          if (iAmDone || !personId) return;
          const newDoneBy = [...(state.doneBy ?? []), personId];
          if (coveringPersonId && !newDoneBy.includes(coveringPersonId)) newDoneBy.push(coveringPersonId);
          setState((prev) =>
            prev ? { ...prev, doneBy: newDoneBy } : prev,
          );
          try {
            fetch(`/api/room/${code}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "done", personId }),
              keepalive: true,
            });
            if (coveringPersonId) {
              fetch(`/api/room/${code}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "done", personId: coveringPersonId }),
                keepalive: true,
              });
            }
          } catch {
            /* navigation continues; next refresh reconciles */
          }
        };
        return (
          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-white/10 bg-[#1b1b1f]/95 pb-[env(safe-area-inset-bottom)] text-white shadow-lg backdrop-blur">
            {/* Cart expansion uses a grid-template-rows trick to
                animate height from 0 to auto. The outer grid switches
                grid-rows-[0fr] ↔ grid-rows-[1fr]; the inner scroll
                container provides max-height + overflow so the list
                still scrolls when there are more items than fit. */}
            <div
              aria-hidden={!cartOpen}
              className={`grid overflow-hidden border-white/10 transition-[grid-template-rows,opacity] duration-300 ease-out ${
                cartOpen ? "grid-rows-[1fr] border-b opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="min-h-0">
                <div className="max-h-[42vh] space-y-3 overflow-y-auto px-4 py-3 text-sm">
                  {Object.keys(linesByCategory).length === 0 && (
                    <p className="py-2 text-center text-white/60">{t.cartEmpty}</p>
                  )}
                  {/* One section per category that has anything in it.
                      Shared rows live INSIDE the category, sorted after
                      the guest's own picks and marked with a small 🤝. */}
                  {CATEGORY_ORDER.map((cat) => {
                    const items = linesByCategory[cat];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
                          {CATEGORY_LABEL[lang][cat]}
                        </div>
                        <ul className="space-y-1">
                          {items.map((line, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span aria-hidden className="inline-flex w-7 shrink-0 items-center justify-center text-lg leading-none">
                                <ItemEmoji description={line.description} hint={line.rawCategory} modelEmoji={line.emoji} />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-white/90">
                                {line.count > 1 && <span className="text-white/55 tabular-nums">{line.count}× </span>}
                                {line.description}
                                {line.isShared && line.shareCount && (
                                  <span className="ml-1 text-xs tabular-nums text-white/45" aria-label={tx.sharedToggle}>/{line.shareCount}</span>
                                )}
                              </span>
                              <Money ore={line.count * line.oreEach} className="shrink-0 tabular-nums text-white/85" nativeClassName="hidden" />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Cart toggle bar — shows the share total + a quick
                count of what's in the cart, tapping anywhere
                expands / collapses the breakdown above. Right side
                stacks "DIN ANDEL" caption above the amount + cart
                chevron; left side carries the "n valda · m delade"
                subline. */}
            <button
              type="button"
              onClick={() => setCartOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-5 pt-3 pb-2 text-left active:bg-white/5"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-white/80">
                {mineCount === 0 && sharedCount === 0
                  ? t.cartEmpty
                  : mineCount === 0
                  ? t.cartSharedItems(sharedCount)
                  : sharedCount === 0
                  ? t.cartPickedItems(mineCount)
                  : `${t.cartPickedItems(mineCount)} · ${t.cartSharedShort(sharedCount)}`}
              </span>
              <span className="flex shrink-0 flex-col items-end leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">{t.yourTotal}</span>
                <span className="flex items-center gap-1">
                  <Money ore={myShare.totalOre} className="text-lg font-bold" nativeClassName="hidden" />
                  <span className={`text-xl leading-none text-white/50 transition-transform ${cartOpen ? "rotate-180" : ""}`}>▾</span>
                </span>
                {roomFx && (
                  <span className="text-xs font-normal text-white/55">{formatNative(myShare.totalOre, roomFx)}</span>
                )}
              </span>
            </button>
            {coverableShares.length > 0 && (
              <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2">
                <span className="shrink-0 text-[11px] text-white/55">{t.coverFor}:</span>
                <div className="flex flex-wrap gap-1.5">
                  {coverableShares.map((cs) => (
                    <button
                      key={cs.dinerId}
                      type="button"
                      onClick={() => setCoveringPersonId((prev) => prev === cs.dinerId ? null : cs.dinerId)}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition ${
                        coveringPersonId === cs.dinerId
                          ? "bg-swish text-white ring-swish-dark"
                          : "bg-white/10 text-white/70 ring-white/20 active:bg-white/20"
                      }`}
                    >
                      {cs.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Primary action. The first tap of "Betala" only OPENS
                the Swish deep link and sets paymentInitiated, which
                splits the button into a Pay (re-tap to retry) +
                "I'm done" pair so committing the row as paid stays
                an intentional second tap. iAmDone keeps the split
                layout — the Swish half remains tappable in case the
                guest needs to pay again, only the right half flips
                to the green "✓ Klar" state. */}
            <div className="px-4 pb-4 pt-1">
            {canSwish && swishUri ? (
              paymentInitiated || iAmDone ? (
                /* After tapping Swish: [Pay again] [I'm done / ✓ Klar] */
                <div className="flex gap-2">
                  <a
                    href={swishUri}
                    onClick={() => setPaymentInitiated(true)}
                    className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-swish px-5 py-4 text-base font-semibold text-white active:bg-swish-dark"
                  >
                    <span>{t.payWithSwish}</span>
                    <SwishLogo height={22} className="shrink-0" />
                  </a>
                  <button
                    type="button"
                    onClick={markDone}
                    disabled={iAmDone}
                    className={`shrink-0 rounded-2xl px-5 py-4 text-base font-semibold ${
                      iAmDone
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-white/10 text-white/90 active:bg-white/15"
                    }`}
                  >
                    {iAmDone ? t.doneOn : t.imDone}
                  </button>
                </div>
              ) : (
                /* Before initiating: [Already paid] [Pay with Swish] */
                <div className="flex gap-2">
                  {personId && (
                    <button
                      type="button"
                      onClick={() => togglePaid(personId)}
                      className={`shrink-0 rounded-2xl px-4 py-4 text-sm font-semibold ${
                        iAmPaid
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-white/10 text-white/80 active:bg-white/15"
                      }`}
                    >
                      {iAmPaid ? `✓ ${t.paid}` : t.alreadyPaid}
                    </button>
                  )}
                  <a
                    href={swishUri}
                    onClick={() => setPaymentInitiated(true)}
                    className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-swish px-5 py-4 text-base font-semibold text-white active:bg-swish-dark"
                  >
                    <span>{t.payWithSwish}</span>
                    <SwishLogo height={22} className="shrink-0" />
                  </a>
                </div>
              )
            ) : (
              /* No Swish: [Already paid] [I'm done / ✓ Klar] */
              <div className="flex gap-2">
                {personId && (
                  <button
                    type="button"
                    onClick={() => togglePaid(personId)}
                    className={`shrink-0 rounded-2xl px-4 py-4 text-sm font-semibold ${
                      iAmPaid
                        ? "bg-emerald-500/20 text-emerald-200"
                        : "bg-white/10 text-white/80 active:bg-white/15"
                    }`}
                  >
                    {iAmPaid ? `✓ ${t.paid}` : t.alreadyPaid}
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleDone}
                  className={`flex-1 rounded-2xl px-5 py-4 text-base font-semibold ${
                    iAmDone ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/90 active:bg-white/15"
                  }`}
                >
                  {iAmDone ? t.doneOn : t.imDone}
                </button>
              </div>
            )}
            </div>
          </div>
        );
      })()}
      {pendingUndos.length > 0 && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto flex max-w-md flex-col gap-2 px-4">
          {/* One toast per removal so quickly deleting several rows
              shows a stack instead of overwriting the previous toast.
              Each toast carries its own snap.id so the 6-second
              countdown is per-item. */}
          {pendingUndos.map((snap) => (
            <div key={snap.id} className="relative overflow-hidden rounded-xl bg-red-600 px-3 py-2.5 text-sm text-white shadow-lg ring-1 ring-red-700/40">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">🗑 {t.removedItem(snap.description || t.editRow)}</span>
                <button
                  type="button"
                  onClick={() => undoRemoval(snap.id)}
                  className="shrink-0 rounded-lg bg-white px-3 py-1 font-semibold text-red-700 active:bg-red-50"
                >
                  {t.undo}
                </button>
              </div>
              <span aria-hidden className="undo-countdown absolute inset-x-0 bottom-0 h-0.5 bg-white/80" />
            </div>
          ))}
        </div>
      )}
      {/* Ghost: a card-shaped chip pinned to the source row's bounding
          rect that animates over to the shared-section header via the
          fly-to-shared useLayoutEffect. Lives in a fixed layer so it
          can travel across the page (and off-screen if the shared
          section isn't currently in view). */}
      {flyingItem && (
        <div
          ref={flyingRef}
          aria-hidden
          className="pointer-events-none fixed z-[60] flex items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl ring-2 ring-swish/70"
          style={{
            left: flyingItem.source.x,
            top: flyingItem.source.y,
            width: flyingItem.source.w,
            transformOrigin: "center",
          }}
        >
          <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none">
            <ItemEmoji description={flyingItem.description} hint={flyingItem.category} modelEmoji={flyingItem.emoji} />
          </span>
          <span className="min-w-0 truncate text-base font-medium text-ink">{flyingItem.description}</span>
          <span aria-hidden className="ml-auto shrink-0 text-xl leading-none">🤝</span>
        </div>
      )}
      {/* Positive sister to the undo toast: surfaces when an edit
          promotes a row into the "shared by everyone" pile, so the
          host knows where the item just went. The FLIP animation runs
          the row down to the bottom on its own. */}
      {markedSharedToast && (
        <div className="fixed inset-x-0 bottom-28 z-50 mx-auto max-w-md px-4">
          <div
            key={markedSharedToast.description}
            className="relative overflow-hidden rounded-xl bg-swish px-3 py-2.5 text-sm text-white shadow-lg ring-1 ring-swish-dark/40"
          >
            <p className="pr-1 leading-snug">{t.markedShared(markedSharedToast.description)}</p>
            <span
              aria-hidden
              className="undo-countdown absolute inset-x-0 bottom-0 h-0.5 bg-white/80"
              style={{ animationDuration: "4.2s" }}
            />
          </div>
        </div>
      )}
      {nameToast && (
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-16 z-[70] mx-auto max-w-sm px-6"
        >
          <div className="rounded-2xl bg-gray-900/90 px-4 py-3 text-center text-sm font-medium text-white shadow-xl backdrop-blur">
            {nameToast}
          </div>
        </div>
      )}
      {expandedItem && (() => {
        const { item: ei, sourceRect: sr } = expandedItem;
        const vh = typeof window !== "undefined" ? window.innerHeight : 800;
        const shareCap = ei.shareCount && ei.shareCount > 0 ? ei.shareCount : groupSize;
        const isClaimed = !!personId && ei.claimedBy.includes(personId);
        const claimers = ei.claimedBy.map((id) =>
          id === personId ? (lang === "sv" ? "du" : "you") : (nameById.get(id) ?? "?")
        );
        return (
          <div
            className="item-card-expand pointer-events-none fixed z-[71] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
            style={{
              left: sr.left,
              width: sr.width,
              bottom: vh - sr.top + 8,
              transformOrigin: "bottom center",
            }}
          >
            {/* Row mirrors the claim row layout exactly */}
            <div className="flex items-center gap-2.5 p-3">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs ${isClaimed ? "border-swish bg-swish text-white" : "border-gray-300 text-transparent"}`}>
                ✓
              </span>
              <span aria-hidden className="inline-flex w-8 shrink-0 items-center justify-center text-2xl leading-none">
                <ItemEmoji description={ei.description} hint={ei.category} modelEmoji={ei.emoji} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-snug">{ei.description}</span>
                {ei.translation && (
                  <span className="block text-[11px] text-gray-400 leading-snug mt-0.5">{ei.translation}</span>
                )}
              </span>
              <Money
                ore={ei.shared ? Math.round(ei.priceOre / shareCap) : ei.priceOre}
                className="shrink-0 text-base font-semibold"
                nativeClassName="text-gray-400"
                stack
              />
            </div>
            {(ei.shared || claimers.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-50 px-3 pb-2.5 pt-1.5">
                {ei.shared && (
                  <span className="text-[11px] text-swish-dark">
                    🤝 {ei.claimedBy.length}/{shareCap}
                  </span>
                )}
                {claimers.map((name, i) => (
                  <span key={i} className="rounded-full bg-swish/10 px-2 py-0.5 text-[11px] font-semibold text-swish-dark">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-between border-t border-gray-50 px-3 pb-2 pt-1.5 text-[10px] font-medium text-gray-300">
              <span>← {t.swipeRemove}</span>
              <span>{t.swipeEdit} →</span>
            </div>
          </div>
        );
      })()}
      {joinDialog}
      {receiptOpen && (
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
          <div className="flex-1 overflow-y-auto px-3 pb-6" onClick={(e) => e.stopPropagation()}>
            {receiptImages === null ? (
              <p className="pt-10 text-center text-sm text-white/60">{t.receiptLoading}</p>
            ) : receiptImages.length === 0 ? (
              <p className="pt-10 text-center text-sm text-white/60">—</p>
            ) : (
              <div className="space-y-3">
                {receiptImages.map((src, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={i} src={src} alt={`${t.showReceipt} ${i + 1}`} className="w-full rounded-lg" />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Subtle "buy me a coffee" link at the bottom of the room
          content. Sits inside the playRoomEnter wrapper so it slides
          in with the rest of the body; pb-32 on the main keeps it
          clear of the guest's fixed pay footer. Update the href in
          one place when the donation handle changes. */}
      <a
        href={donateHref}
        target="_blank"
        rel="noopener noreferrer"
        className="order-last mx-auto mt-6 inline-flex items-center gap-1.5 self-center rounded-full bg-white px-3.5 py-1.5 text-xs text-gray-500 ring-1 ring-gray-200 active:bg-gray-50"
      >
        <span aria-hidden>☕</span>
        <span>{t.donate}</span>
      </a>
      </div>
      <QrDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        origin={shareOrigin}
        qrSrc={`/api/room/${code}/qr`}
        title={state.place || "Kvitt"}
        date={state.date ? formatReceiptDate(state.date, lang) : undefined}
        subtitle={`${t.scanToJoin} · ${code}`}
        shareUrl={shareUrl}
        shareTitle={state.place || "Kvitt"}
        shareText={shareText}
        download={`kvitt-${code}.png`}
        labels={{ share: t.share, copied: t.copied, copyLink: t.copyLink, close: t.close, save: t.saveQr }}
      />
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

// Secondary "try again" action for the notfound/unavailable dead-ends.
function RetryButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-5 py-2.5 text-sm font-semibold text-swish-dark underline underline-offset-2 active:text-swish"
    >
      {label}
    </button>
  );
}

// "Try again" label for the room error states. Kept as a local map rather than
// threaded through the big per-locale R dict — one auxiliary string.
const TRY_AGAIN: Record<Lang, string> = {
  sv: "Försök igen", en: "Try again", de: "Erneut versuchen", fr: "Réessayer",
  es: "Intentar de nuevo", it: "Riprova", nl: "Opnieuw proberen", da: "Prøv igen",
  no: "Prøv igjen", fi: "Yritä uudelleen", pl: "Spróbuj ponownie", pt: "Tentar novamente",
};

// "Remind" button + the message the host shares with an unpaid guest. Local
// maps for the same reason — auxiliary strings not worth 12 R-dict edits.
const REMIND_LABEL: Record<Lang, string> = {
  sv: "Påminn", en: "Remind", de: "Erinnern", fr: "Rappeler", es: "Recordar", it: "Ricorda",
  nl: "Herinneren", da: "Påmind", no: "Påminn", fi: "Muistuta", pl: "Przypomnij", pt: "Lembrar",
};
// Prompt for a joined guest who hasn't claimed anything yet (incl. late joiners
// of an already-settled bill) — otherwise they see a blank action area.
const CLAIM_HINT: Record<Lang, string> = {
  sv: "Tryck på det du åt", en: "Tap the items you had", de: "Tippe auf das, was du hattest",
  fr: "Touche ce que tu as pris", es: "Toca lo que tomaste", it: "Tocca ciò che hai preso",
  nl: "Tik aan wat jij had", da: "Tryk på det, du fik", no: "Trykk på det du tok",
  fi: "Napauta ottamiasi", pl: "Dotknij tego, co jadłeś", pt: "Toca no que tiveste",
};
const REMIND_MSG: Record<Lang, (name: string, amount: string) => string> = {
  sv: (n, a) => `Hej ${n}! Din del av notan är ${a}. Betala här:`,
  en: (n, a) => `Hi ${n}! Your share of the bill is ${a}. Pay here:`,
  de: (n, a) => `Hallo ${n}! Dein Anteil an der Rechnung ist ${a}. Hier bezahlen:`,
  fr: (n, a) => `Salut ${n} ! Ta part de l'addition est ${a}. Paie ici :`,
  es: (n, a) => `¡Hola ${n}! Tu parte de la cuenta es ${a}. Paga aquí:`,
  it: (n, a) => `Ciao ${n}! La tua parte del conto è ${a}. Paga qui:`,
  nl: (n, a) => `Hoi ${n}! Jouw deel van de rekening is ${a}. Betaal hier:`,
  da: (n, a) => `Hej ${n}! Din del af regningen er ${a}. Betal her:`,
  no: (n, a) => `Hei ${n}! Din del av regningen er ${a}. Betal her:`,
  fi: (n, a) => `Hei ${n}! Osuutesi laskusta on ${a}. Maksa tästä:`,
  pl: (n, a) => `Cześć ${n}! Twoja część rachunku to ${a}. Zapłać tutaj:`,
  pt: (n, a) => `Olá ${n}! A tua parte da conta é ${a}. Paga aqui:`,
};

// Lucide "pencil" — flat stroked icon. Used for the per-item edit buttons.
function PencilIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

// Lucide "trash-2" — used as the reveal-layer hint behind a row that's
// being swiped left.
function TrashIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// Lucide "chevron-right" — used for the collapsible shared section header.
function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
