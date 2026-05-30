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
  /** Guide shown over the viewfinder when a previous shot is overlaid. */
  lineUpOverlay: string;
  /** Secondary button: take an additional shot in the same scan session. */
  takeAnotherShot: string;
  /** Primary button: commit the N captured shots to OCR. */
  readReceiptN: (n: number) => string;
  /** Tertiary: throw away pending shots and start over. */
  discardShots: string;
  /** Aria label for the viewfinder flashlight toggle. */
  torchOn: string;
  torchOff: string;
  reading: string;
  scanning: string;
  scanPhrases: string[];
  itemsFound: (n: number) => string;
  /** Soft intro for the host setup card overlaid on the live scan. */
  inTheMeantime: string;
  /** Tiny captions under each setup-card input explaining why we ask. */
  whyName: string;
  whyNumber: string;
  whyGroup: string;
  /** Reassurance footer for the setup card. */
  stayLocal: string;
  /** CTA on the setup card; only after this tap (and scan completion) is the
   *  host moved to the items step. */
  setupDone: string;
  readReceipt: string;
  chooseOther: string;
  photoOrChoose: string;
  takePhoto: string;
  chooseLibrary: string;
  skipManual: string;

  // items
  itemsTitle: string;
  itemsHint: string;
  readBy: (model: string) => string;
  ocrFallback: string;
  sortBy: string;
  byCategory: string;
  byReceipt: string;
  descPlaceholder: string;
  pricePlaceholder: string;
  removeRow: string;
  removedItem: (desc: string) => string;
  undo: string;
  removedTitle: (n: number) => string;
  restore: string;
  addRow: string;
  addPhoto: string;
  addingPhoto: string;
  viewSource: string;
  viewSourceFull: string;
  viewSourceCrop: string;
  /** Short label for the "open the receipt photo overlay" button. */
  showReceipt: string;
  rowsSum: string;
  receiptTotalLabel: string;
  chargedLabel: string;
  totalDiff: (amt: string) => string;
  payerTitle: string;
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
  mealPresets: string[];

  // live room
  liveRoomTitle: string;
  liveRoomHint: string;
  createRoom: string;
  creatingRoom: string;

  // shared items
  groupSizeLabel: string;
  sharedGroupPrompt: string;
  sharedToggle: string;
  shareThis: string;
  /** Short single-word label for the share toggle (fits next to a switch). */
  sharedLabel: string;
  sharedSplit: (n: number, amt: string) => string;
  splitWays: string;
  maybeShared: string;

  // flow
  splitYourself: string;
  assignManually: string;
  tipSplitNote: (amt: string) => string;

  // formatting + message template
  currency: string;
  mealDefault: string;

  // foreign currency
  fxLine: (country: string, currency: string, rate: string) => string;
  fxApprox: string;
  fxMissing: (currency: string) => string;
  currencyLabel: string;

  // navigation / history
  history: string;
  newReceipt: string;

  // QrCard
  shareTitle: (name: string) => string;
  shareText: (name: string, amt: string) => string;
  payWithSwish: (amt: string) => string;
  qrError: string;
  qrAlt: (name: string) => string;
  qrLockedTo: (payee: string) => string;
  openSwish: string;
  copied: string;
  shareLink: string;
  swishOpensApp: string;
  noSwishApp: string;

  // payout method + SEPA
  payMethodLabel: string;
  payMethodSwish: string;
  payMethodSepa: string;
  ibanPlaceholder: string;
  ibanInvalid: string;
  swishOptional: string;
  sepaScan: string;
  sepaTo: (name: string) => string;
  copyIban: string;
  ibanCopied: string;
  haveSwish: (amt: string) => string;
  sepaSettlesEur: string;
}

const sv: Strings = {
  steps: { capture: "Foto", items: "Rader", assign: "Fördela", pay: "Betala" },

  title: "Dela kvittot",
  intro: "Skanna kvittot, peta i vem som åt vad, och få en låst Swish-QR per person.",
  tapToPhoto: "Tryck för att skanna kvittot",
  scanCta: "Skanna kvitto",
  scanGuide: "Få plats med hela kvittot i ramen",
  lineUpOverlay: "Linjera den ljusrosa raden med samma rad på kvittot",
  takeAnotherShot: "+ Ny bild",
  readReceiptN: (n) => `Läs av (${n})`,
  discardShots: "Börja om",
  torchOn: "Slå på ficklampan",
  torchOff: "Stäng av ficklampan",
  reading: "Läser av…",
  scanning: "Skannar kvittot…",
  scanPhrases: ["Läser av rader…", "Hittar priser…", "Känner igen rätter…", "Snart klar…"],
  itemsFound: (n) => `${n} rader tillagda`,
  inTheMeantime: "Under tiden…",
  whyName: "Visas för dina gäster så de vet vem de Swishar till.",
  whyNumber: "Används bara här i mobilen för att skapa en Swish-QR — vi sparar inget på en server.",
  whyGroup: "Hjälper appen dela rätt om något står på notan att dela på.",
  stayLocal: "Allt stannar på din telefon.",
  setupDone: "Klar",
  readReceipt: "Läs av kvittot",
  chooseOther: "Välj annan bild",
  photoOrChoose: "Fota eller välj bild",
  takePhoto: "Ta foto",
  chooseLibrary: "Välj från galleri",
  skipManual: "Hoppa över – skriv in själv",

  itemsTitle: "Stämmer det här?",
  itemsHint: "Vi har försökt läsa av varje rad från kvittot — gå igenom listan, rätta det som blivit fel, och markera vilka rader som ska delas. Priser inkl. moms.",
  readBy: (model) => `Avläst av ${model}`,
  ocrFallback: "Avläst med en reservläsare – kontrollera beloppen extra noga.",
  sortBy: "Sortera",
  byCategory: "Efter kategori",
  byReceipt: "Efter kvitto",
  descPlaceholder: "Beskrivning",
  pricePlaceholder: "0,00",
  removeRow: "Ta bort rad",
  removedItem: (desc) => `Tog bort ${desc}`,
  undo: "Ångra",
  removedTitle: (n) => `Borttagna (${n})`,
  restore: "Återställ",
  addRow: "+ Lägg till rad",
  addPhoto: "+ Lägg till foto (långt kvitto)",
  addingPhoto: "Skannar…",
  viewSource: "Visa på kvittot",
  viewSourceFull: "Visa hela kvittot",
  viewSourceCrop: "Visa bara raden",
  showReceipt: "Kvitto",
  rowsSum: "Summa rader",
  receiptTotalLabel: "Kvittots total",
  chargedLabel: "Betalat (kort)",
  totalDiff: (amt) =>
    `Summan stämmer inte – ${amt} SEK ifrån kvittots total. Kontrollera om en rad saknas eller är felläst.`,
  payerTitle: "Vem la ut för notan?",
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
  perPerson: (amt) => `≈ ${amt} SEK per person`,
  notAssignedYet: "Inte fördelad än",
  unassignedNote: (amt) => `${amt} SEK är inte fördelat och räknas inte med.`,

  payTitle: "Betala",
  tip: "Dricks",
  none: "Ingen",
  customPercent: "Eget värde (%)",
  toDistribute: "Att fördela",
  unassignedWarn: (amt) => `Obs: ${amt} SEK är inte fördelat.`,
  payerCard: (name) => `${name} (du – får pengarna)`,
  payerCardHint: "Din egen del. Du swishar inte dig själv.",

  back: "Tillbaka",
  forward: "Vidare",
  createQr: "Skapa QR-koder",
  messagePlaceholder: "Meddelande",
  messageAria: "Meddelande-etikett",
  placePlaceholder: "Plats",
  mealPresets: ["Middag", "Lunch", "Brunch", "Fika", "Resa"],

  liveRoomTitle: "Live-rum",
  liveRoomHint: "Skapa ett rum – så petar var och en in sina egna rätter på sin egen telefon.",
  createRoom: "Bjud in att dela",
  creatingRoom: "Bjuder in…",

  groupSizeLabel: "Antal som delar",
  sharedGroupPrompt: "Det ser ut som ni har delade rätter – hur många är ni?",
  sharedToggle: "Delas av alla",
  shareThis: "Dela",
  sharedLabel: "Delas",
  sharedSplit: (n, amt) => `${n} sätt · ≈ ${amt} SEK/pers`,
  splitWays: "Dela på",
  maybeShared: "Delas?",

  splitYourself: "Dela upp själv i stället",
  assignManually: "Fördela på nästa steg →",
  tipSplitNote: (amt) => `Dricks ${amt} SEK från kvittot – delas lika`,

  currency: "SEK",
  mealDefault: "Middag",

  fxLine: (country, currency, rate) => `${country} · priser omräknade från ${currency} (1 ${currency} ≈ ${rate})`,
  fxApprox: "uppskattad kurs",
  fxMissing: (currency) =>
    `Kunde inte hämta växelkurs för ${currency}. Beloppen visas i ${currency} – justera till kronor manuellt.`,
  currencyLabel: "Valuta",
  history: "Historik",
  newReceipt: "Nytt kvitto",

  shareTitle: (name) => `Swish – ${name}`,
  shareText: (name, amt) => `${name}: ${amt} SEK`,
  payWithSwish: (amt) => `Betala ${amt} SEK med Swish`,
  qrError: "Kunde inte skapa QR-kod. Använd länken nedan.",
  qrAlt: (name) => `Swish QR-kod för ${name}`,
  qrLockedTo: (payee) => `Skanna med valfri telefon · betalningen är låst till ${payee}`,
  openSwish: "Öppna Swish",
  copied: "Kopierad!",
  shareLink: "Dela länk",
  swishOpensApp: "Öppnar Swish-appen – kräver att den finns på den här telefonen",
  noSwishApp:
    "Kunde inte öppna Swish. Knappen öppnar Swish-appen, så den måste vara installerad på den här telefonen. Skanna annars QR-koden ovan med en annan telefon.",

  payMethodLabel: "Hur vill du få betalt?",
  payMethodSwish: "Swish (kr)",
  payMethodSepa: "SEPA (€)",
  ibanPlaceholder: "IBAN (t.ex. DE89 3704 0044 …)",
  ibanInvalid: "Ange ett giltigt IBAN.",
  swishOptional: "Swish-nummer (valfritt)",
  sepaScan: "Skanna med din bankapp",
  sepaTo: (name) => `Till ${name}`,
  copyIban: "Kopiera IBAN",
  ibanCopied: "IBAN kopierat!",
  haveSwish: (amt) => `Har du Swish? Betala ${amt} SEK i stället`,
  sepaSettlesEur: "Betalningar sker i euro via banköverföring (SEPA).",
};

const en: Strings = {
  steps: { capture: "Photo", items: "Items", assign: "Assign", pay: "Pay" },

  title: "Split the receipt",
  intro: "Scan the receipt, tap who ate what, and get a locked Swish QR per person.",
  tapToPhoto: "Tap to scan the receipt",
  scanCta: "Scan receipt",
  scanGuide: "Fit the whole receipt in the frame",
  lineUpOverlay: "Line the pink overlay up with the same row on the receipt",
  takeAnotherShot: "+ New shot",
  readReceiptN: (n) => `Read receipt (${n})`,
  discardShots: "Start over",
  torchOn: "Turn flashlight on",
  torchOff: "Turn flashlight off",
  reading: "Reading…",
  scanning: "Scanning receipt…",
  scanPhrases: ["Reading lines…", "Finding prices…", "Recognising items…", "Almost done…"],
  itemsFound: (n) => `${n} items added`,
  inTheMeantime: "In the meantime…",
  whyName: "Shown to your guests so they know who they're paying.",
  whyNumber: "Used right here on your phone to build the Swish QR — nothing is sent to a server.",
  whyGroup: "Lets the app split shared items evenly across the group.",
  stayLocal: "Everything stays on your phone.",
  setupDone: "Done",
  readReceipt: "Scan receipt",
  chooseOther: "Choose another image",
  photoOrChoose: "Take or choose a photo",
  takePhoto: "Take photo",
  chooseLibrary: "Choose from library",
  skipManual: "Skip – enter manually",

  itemsTitle: "Does this look right?",
  itemsHint: "We've tried to read every line from the receipt — go through the list, fix anything that came out wrong, and mark which rows are shared. Prices include VAT.",
  readBy: (model) => `Read by ${model}`,
  ocrFallback: "Read by a fallback model — double-check the amounts.",
  sortBy: "Sort",
  byCategory: "By category",
  byReceipt: "By receipt",
  descPlaceholder: "Description",
  pricePlaceholder: "0.00",
  removeRow: "Remove row",
  removedItem: (desc) => `Removed ${desc}`,
  undo: "Undo",
  removedTitle: (n) => `Removed (${n})`,
  restore: "Restore",
  addRow: "+ Add row",
  addPhoto: "+ Add another photo (long receipt)",
  addingPhoto: "Scanning…",
  viewSource: "Show on receipt",
  viewSourceFull: "Show full receipt",
  viewSourceCrop: "Show just this line",
  showReceipt: "Receipt",
  rowsSum: "Items total",
  receiptTotalLabel: "Receipt total",
  chargedLabel: "Charged (card)",
  totalDiff: (amt) =>
    `The sums don't match — ${amt} SEK from the receipt total. Check for a missing or misread row.`,
  payerTitle: "Who paid the bill?",
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
  perPerson: (amt) => `≈ ${amt} SEK each`,
  notAssignedYet: "Not assigned yet",
  unassignedNote: (amt) => `${amt} SEK is unassigned and not counted.`,

  payTitle: "Pay",
  tip: "Tip",
  none: "None",
  customPercent: "Custom (%)",
  toDistribute: "To split",
  unassignedWarn: (amt) => `Note: ${amt} SEK is unassigned.`,
  payerCard: (name) => `${name} (you – receive the money)`,
  payerCardHint: "Your own share. You don't Swish yourself.",

  back: "Back",
  forward: "Next",
  createQr: "Create QR codes",
  messagePlaceholder: "Message",
  messageAria: "Message label",
  placePlaceholder: "Place",
  mealPresets: ["Dinner", "Lunch", "Brunch", "Coffee", "Trip"],

  liveRoomTitle: "Live room",
  liveRoomHint: "Create a room — everyone taps their own items on their own phone.",
  createRoom: "Invite people to split",
  creatingRoom: "Inviting…",

  groupSizeLabel: "People sharing",
  sharedGroupPrompt: "Looks like you have shared items — how many are you?",
  sharedToggle: "Shared",
  shareThis: "Share",
  sharedLabel: "Shared",
  sharedSplit: (n, amt) => `${n} ways · ≈ ${amt} SEK each`,
  splitWays: "Split",
  maybeShared: "Shared?",

  splitYourself: "Split it yourself instead",
  assignManually: "Assign on the next screen →",
  tipSplitNote: (amt) => `${amt} SEK tip from the receipt — split equally`,

  currency: "SEK",
  mealDefault: "Dinner",

  fxLine: (country, currency, rate) => `${country} · prices converted from ${currency} (1 ${currency} ≈ ${rate})`,
  fxApprox: "estimated rate",
  fxMissing: (currency) =>
    `Couldn't fetch an exchange rate for ${currency}. Amounts are shown in ${currency} — adjust to kronor manually.`,
  currencyLabel: "Currency",
  history: "History",
  newReceipt: "New receipt",

  shareTitle: (name) => `Swish – ${name}`,
  shareText: (name, amt) => `${name}: ${amt} SEK`,
  payWithSwish: (amt) => `Pay ${amt} SEK with Swish`,
  qrError: "Couldn't create a QR code. Use the link below.",
  qrAlt: (name) => `Swish QR code for ${name}`,
  qrLockedTo: (payee) => `Scan with any phone · payment is locked to ${payee}`,
  openSwish: "Open Swish",
  copied: "Copied!",
  shareLink: "Share link",
  swishOpensApp: "Opens the Swish app — needs it installed on this phone",
  noSwishApp:
    "Couldn't open Swish. The button launches the Swish app, so it has to be installed on this phone. Otherwise scan the QR code above with another phone.",

  payMethodLabel: "How do you want to be paid?",
  payMethodSwish: "Swish (kr)",
  payMethodSepa: "SEPA (€)",
  ibanPlaceholder: "IBAN (e.g. DE89 3704 0044 …)",
  ibanInvalid: "Enter a valid IBAN.",
  swishOptional: "Swish number (optional)",
  sepaScan: "Scan with your bank app",
  sepaTo: (name) => `To ${name}`,
  copyIban: "Copy IBAN",
  ibanCopied: "IBAN copied!",
  haveSwish: (amt) => `Have Swish? Pay ${amt} SEK instead`,
  sepaSettlesEur: "Payments are made in euros via bank transfer (SEPA).",
};

export const translations: Record<Lang, Strings> = { sv, en };
