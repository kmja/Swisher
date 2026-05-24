export type Lang = "sv" | "en";

export interface Strings {
  /** Label shown on the language toggle for the *other* language. */
  steps: { capture: string; items: string; assign: string; pay: string };

  // capture
  title: string;
  intro: string;
  tapToPhoto: string;
  scanCta: string;
  scanGuide: string;
  reading: string;
  scanning: string;
  scanPhrases: string[];
  itemsFound: (n: number) => string;
  readReceipt: string;
  chooseOther: string;
  photoOrChoose: string;
  takePhoto: string;
  chooseLibrary: string;
  skipManual: string;

  // items
  itemsTitle: string;
  itemsHint: string;
  descPlaceholder: string;
  pricePlaceholder: string;
  removeRow: string;
  addRow: string;
  addPhoto: string;
  addingPhoto: string;
  viewSource: string;
  viewSourceFull: string;
  viewSourceCrop: string;
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
  placePlaceholder: string;

  // live room
  liveRoomTitle: string;
  liveRoomHint: string;
  createRoom: string;
  creatingRoom: string;

  // shared items
  groupSizeLabel: string;
  sharedGroupPrompt: string;
  sharedToggle: string;
  sharedSplit: (n: number, amt: string) => string;

  // flow
  splitYourself: string;
  assignManually: string;
  tipSplitNote: (amt: string) => string;

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
  intro: "Skanna kvittot, peta i vem som åt vad, och få en låst Swish-QR per person.",
  tapToPhoto: "Tryck för att skanna kvittot",
  scanCta: "Skanna kvitto",
  scanGuide: "Få plats med hela kvittot i ramen",
  reading: "Läser av…",
  scanning: "Skannar kvittot…",
  scanPhrases: ["Läser av rader…", "Hittar priser…", "Känner igen rätter…", "Snart klar…"],
  itemsFound: (n) => `${n} rader tillagda`,
  readReceipt: "Läs av kvittot",
  chooseOther: "Välj annan bild",
  photoOrChoose: "Fota eller välj bild",
  takePhoto: "Ta foto",
  chooseLibrary: "Välj från galleri",
  skipManual: "Hoppa över – skriv in själv",

  itemsTitle: "Rader",
  itemsHint: "Kontrollera och rätta avläsningen. Priser inkl. moms.",
  descPlaceholder: "Beskrivning",
  pricePlaceholder: "0,00",
  removeRow: "Ta bort rad",
  addRow: "+ Lägg till rad",
  addPhoto: "+ Lägg till foto (långt kvitto)",
  addingPhoto: "Skannar…",
  viewSource: "Visa på kvittot",
  viewSourceFull: "Visa hela kvittot",
  viewSourceCrop: "Visa bara raden",
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
  placePlaceholder: "Plats",

  liveRoomTitle: "Live-rum",
  liveRoomHint: "Skapa ett rum – så petar var och en in sina egna rätter på sin egen telefon.",
  createRoom: "Bjud in att dela",
  creatingRoom: "Bjuder in…",

  groupSizeLabel: "Antal som delar (valfritt)",
  sharedGroupPrompt: "Ni har delade rätter – hur många är ni?",
  sharedToggle: "Delas av alla",
  sharedSplit: (n, amt) => `${n} sätt · ≈ ${amt} kr/pers`,

  splitYourself: "Dela upp själv i stället",
  assignManually: "Fördela på nästa steg →",
  tipSplitNote: (amt) => `Dricks ${amt} kr från kvittot – delas lika`,

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
  intro: "Scan the receipt, tap who ate what, and get a locked Swish QR per person.",
  tapToPhoto: "Tap to scan the receipt",
  scanCta: "Scan receipt",
  scanGuide: "Fit the whole receipt in the frame",
  reading: "Reading…",
  scanning: "Scanning receipt…",
  scanPhrases: ["Reading lines…", "Finding prices…", "Recognising items…", "Almost done…"],
  itemsFound: (n) => `${n} items added`,
  readReceipt: "Scan receipt",
  chooseOther: "Choose another image",
  photoOrChoose: "Take or choose a photo",
  takePhoto: "Take photo",
  chooseLibrary: "Choose from library",
  skipManual: "Skip – enter manually",

  itemsTitle: "Items",
  itemsHint: "Check and fix the scan. Prices include VAT.",
  descPlaceholder: "Description",
  pricePlaceholder: "0.00",
  removeRow: "Remove row",
  addRow: "+ Add row",
  addPhoto: "+ Add another photo (long receipt)",
  addingPhoto: "Scanning…",
  viewSource: "Show on receipt",
  viewSourceFull: "Show full receipt",
  viewSourceCrop: "Show just this line",
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
  placePlaceholder: "Place",

  liveRoomTitle: "Live room",
  liveRoomHint: "Create a room — everyone taps their own items on their own phone.",
  createRoom: "Invite people to split",
  creatingRoom: "Inviting…",

  groupSizeLabel: "People sharing (optional)",
  sharedGroupPrompt: "You have shared items — how many are you?",
  sharedToggle: "Shared",
  sharedSplit: (n, amt) => `${n} ways · ≈ ${amt} kr each`,

  splitYourself: "Split it yourself instead",
  assignManually: "Assign on the next screen →",
  tipSplitNote: (amt) => `${amt} kr tip from the receipt — split equally`,

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
