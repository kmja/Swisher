export type Lang = "sv" | "en";

export interface Strings {
  /** Label shown on the language toggle for the *other* language. */
  steps: { capture: string; items: string; assign: string; pay: string };

  // capture
  title: string;
  intro: string;
  tapToPhoto: string;
  reading: string;
  readReceipt: string;
  chooseOther: string;
  photoOrChoose: string;
  skipManual: string;

  // items
  itemsTitle: string;
  itemsHint: string;
  descPlaceholder: string;
  pricePlaceholder: string;
  removeRow: string;
  addRow: string;
  rowsSum: string;
  totalMismatch: (total: string) => string;
  payerTitle: string;
  payerHint: string;
  yourName: string;
  swishNumber: string;
  invalidPhone: string;
  whoElse: string;
  namePlaceholder: string;
  removePerson: string;
  addPerson: string;

  // assign
  assignTitle: string;
  splitAll: string;
  assignHint: string;
  rowFallback: string;
  clear: string;
  all: string;
  perPerson: (amt: string) => string;
  notAssignedYet: string;
  unassignedNote: (amt: string) => string;

  // pay
  payTitle: string;
  tip: string;
  none: string;
  customPercent: string;
  toDistribute: string;
  unassignedWarn: (amt: string) => string;
  payerCard: (name: string) => string;
  payerCardHint: string;

  // footer
  back: string;
  forward: string;
  createQr: string;
  messagePlaceholder: string;
  messageAria: string;

  // live room
  liveRoomTitle: string;
  liveRoomHint: string;
  createRoom: string;
  creatingRoom: string;

  // formatting + message template
  currency: string;
  mealDefault: string;
  shareSuffix: string;

  // QrCard
  shareTitle: (name: string) => string;
  shareText: (name: string, amt: string) => string;
  qrError: string;
  qrAlt: (name: string) => string;
  qrLockedTo: (payee: string) => string;
  openSwish: string;
  copied: string;
  shareLink: string;
}

const sv: Strings = {
  steps: { capture: "Foto", items: "Rader", assign: "Fördela", pay: "Betala" },

  title: "Dela kvittot",
  intro: "Fota kvittot, peta i vem som åt vad, och få en låst Swish-QR per person.",
  tapToPhoto: "Tryck för att fota kvittot",
  reading: "Läser av…",
  readReceipt: "Läs av kvittot",
  chooseOther: "Välj annan bild",
  photoOrChoose: "Fota eller välj bild",
  skipManual: "Hoppa över – skriv in själv",

  itemsTitle: "Rader",
  itemsHint: "Kontrollera och rätta avläsningen. Priser inkl. moms.",
  descPlaceholder: "Beskrivning",
  pricePlaceholder: "0,00",
  removeRow: "Ta bort rad",
  addRow: "+ Lägg till rad",
  rowsSum: "Summa rader",
  totalMismatch: (t) => `Kvittots total (${t} kr) skiljer sig från summan av raderna.`,
  payerTitle: "Vem la ut för notan?",
  payerHint: "Den första personen får pengarna via Swish.",
  yourName: "Ditt namn",
  swishNumber: "Swish-nummer (07XXXXXXXX)",
  invalidPhone: "Ange ett giltigt svenskt mobilnummer.",
  whoElse: "Vilka fler var med?",
  namePlaceholder: "Namn",
  removePerson: "Ta bort person",
  addPerson: "+ Lägg till person",

  assignTitle: "Fördela rader",
  splitAll: "Dela allt lika",
  assignHint: "Tryck på namnen som var med på varje rad.",
  rowFallback: "Rad",
  clear: "Rensa",
  all: "Alla",
  perPerson: (amt) => `≈ ${amt} kr per person`,
  notAssignedYet: "Inte fördelad än",
  unassignedNote: (amt) => `${amt} kr är inte fördelat och räknas inte med.`,

  payTitle: "Betala",
  tip: "Dricks",
  none: "Ingen",
  customPercent: "Eget värde (%)",
  toDistribute: "Att fördela",
  unassignedWarn: (amt) => `Obs: ${amt} kr är inte fördelat.`,
  payerCard: (name) => `${name} (du – får pengarna)`,
  payerCardHint: "Din egen del. Du swishar inte dig själv.",

  back: "Tillbaka",
  forward: "Vidare",
  createQr: "Skapa QR-koder",
  messagePlaceholder: "Meddelande",
  messageAria: "Meddelande-etikett",

  liveRoomTitle: "Live-rum",
  liveRoomHint: "Skapa ett rum – så petar var och en in sina egna rätter på sin egen telefon.",
  createRoom: "Skapa live-rum",
  creatingRoom: "Skapar…",

  currency: "kr",
  mealDefault: "Middag",
  shareSuffix: " – din del",

  shareTitle: (name) => `Swish – ${name}`,
  shareText: (name, amt) => `${name}: ${amt} kr`,
  qrError: "Kunde inte skapa QR-kod. Använd länken nedan.",
  qrAlt: (name) => `Swish QR-kod för ${name}`,
  qrLockedTo: (payee) => `Skanna med valfri telefon · betalningen är låst till ${payee}`,
  openSwish: "Öppna Swish",
  copied: "Kopierad!",
  shareLink: "Dela länk",
};

const en: Strings = {
  steps: { capture: "Photo", items: "Items", assign: "Assign", pay: "Pay" },

  title: "Split the receipt",
  intro: "Photograph the receipt, tap who ate what, and get a locked Swish QR per person.",
  tapToPhoto: "Tap to photograph the receipt",
  reading: "Reading…",
  readReceipt: "Scan receipt",
  chooseOther: "Choose another image",
  photoOrChoose: "Take or choose a photo",
  skipManual: "Skip – enter manually",

  itemsTitle: "Items",
  itemsHint: "Check and fix the scan. Prices include VAT.",
  descPlaceholder: "Description",
  pricePlaceholder: "0.00",
  removeRow: "Remove row",
  addRow: "+ Add row",
  rowsSum: "Items total",
  totalMismatch: (t) => `Receipt total (${t} kr) differs from the sum of the items.`,
  payerTitle: "Who paid the bill?",
  payerHint: "This person receives the money via Swish.",
  yourName: "Your name",
  swishNumber: "Swish number (07XXXXXXXX)",
  invalidPhone: "Enter a valid Swedish mobile number.",
  whoElse: "Who else was there?",
  namePlaceholder: "Name",
  removePerson: "Remove person",
  addPerson: "+ Add person",

  assignTitle: "Assign items",
  splitAll: "Split all evenly",
  assignHint: "Tap the names who shared each item.",
  rowFallback: "Item",
  clear: "Clear",
  all: "All",
  perPerson: (amt) => `≈ ${amt} kr each`,
  notAssignedYet: "Not assigned yet",
  unassignedNote: (amt) => `${amt} kr is unassigned and not counted.`,

  payTitle: "Pay",
  tip: "Tip",
  none: "None",
  customPercent: "Custom (%)",
  toDistribute: "To split",
  unassignedWarn: (amt) => `Note: ${amt} kr is unassigned.`,
  payerCard: (name) => `${name} (you – receive the money)`,
  payerCardHint: "Your own share. You don't Swish yourself.",

  back: "Back",
  forward: "Next",
  createQr: "Create QR codes",
  messagePlaceholder: "Message",
  messageAria: "Message label",

  liveRoomTitle: "Live room",
  liveRoomHint: "Create a room — everyone taps their own items on their own phone.",
  createRoom: "Create live room",
  creatingRoom: "Creating…",

  currency: "kr",
  mealDefault: "Dinner",
  shareSuffix: " – your share",

  shareTitle: (name) => `Swish – ${name}`,
  shareText: (name, amt) => `${name}: ${amt} kr`,
  qrError: "Couldn't create a QR code. Use the link below.",
  qrAlt: (name) => `Swish QR code for ${name}`,
  qrLockedTo: (payee) => `Scan with any phone · payment is locked to ${payee}`,
  openSwish: "Open Swish",
  copied: "Copied!",
  shareLink: "Share link",
};

export const translations: Record<Lang, Strings> = { sv, en };
