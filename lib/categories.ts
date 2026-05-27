export type Category = "food" | "drink" | "dessert" | "other";

export const CATEGORY_ORDER: Category[] = ["food", "drink", "dessert", "other"];

export const CATEGORY_EMOJI: Record<Category, string> = {
  food: "🍽️",
  drink: "🍺",
  dessert: "🍰",
  other: "🧾",
};

export const CATEGORY_LABEL: Record<"sv" | "en", Record<Category, string>> = {
  sv: { food: "Mat", drink: "Dryck", dessert: "Efterrätt", other: "Övrigt" },
  en: { food: "Food", drink: "Drinks", dessert: "Dessert", other: "Other" },
};

export function normalizeCategory(v: unknown): Category {
  return v === "food" || v === "drink" || v === "dessert" || v === "other" ? v : "other";
}

// Strip diacritics so "läsk"/"lask", "smörgås"/"smorgas", "entrecôte"/"entrecote"
// all match — receipts often drop å/ä/ö to a/o.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Build a keyword matcher used for BOTH category and emoji, so they always
 * agree. A long word (≥4 chars) matches a whole token or a compound
 * prefix/suffix ("bryggkaffe"→kaffe, "fläskfilé"→fläsk) but NOT an arbitrary
 * internal substring (so "läsk" does not match "fläsk"). Short words (≤3) and
 * multi-word phrases match only whole tokens / exact phrases.
 */
function makeMatcher(words: string[]): (desc: string) => boolean {
  const normed = words.map(norm);
  const phrases = normed.filter((w) => w.includes(" "));
  const whole = new Set(normed.filter((w) => !w.includes(" ") && w.length <= 3));
  const affix = normed.filter((w) => !w.includes(" ") && w.length >= 4);
  return (desc: string) => {
    const s = norm(desc);
    if (phrases.some((p) => s.includes(p))) return true;
    const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
    // A suffix match needs a real compound stem in front (≥3 chars), so "läsk"
    // (soda) matches "sockerläsk" but NOT "fläsk" (pork) or "råraka" vs "räka".
    return tokens.some((tok) =>
      whole.has(tok) ||
      affix.some(
        (w) =>
          tok === w ||
          // Compound prefix only for distinctive (≥5-char) words, so a short
          // keyword like "böna" doesn't swallow a brand like "Bonaqua".
          (w.length >= 5 && tok.startsWith(w)) ||
          (tok.endsWith(w) && tok.length >= w.length + 3),
      ),
    );
  };
}

const isDrink = makeMatcher([
  "öl", "lager", "ipa", "ale", "stout", "pilsner", "porter", "cider", "brewing", "bryggeri",
  "vin", "rödvin", "rött vin", "vitt vin", "rosé", "blanc", "rouge", "bubbel", "champagne", "cava",
  "prosecco", "mousserande", "wine", "merlot", "cabernet", "chardonnay", "sauvignon", "riesling",
  "pinot", "rioja", "chablis", "vouvray",
  "cocktail", "drink", "aviation", "negroni", "spritz", "mojito", "margarita", "martini", "aperol",
  "gin", "tonic", "whisky", "whiskey", "vodka", "rom", "tequila", "sprit", "snaps", "nubbe", "shot",
  "konjak", "cognac", "kaffe", "coffee", "espresso", "latte", "cappuccino", "americano", "macchiato",
  "cortado", "te", "tea", "chai", "läsk", "saft", "must", "julmust", "glögg", "cola", "fanta",
  "sprite", "pepsi", "soda", "juice", "vatten", "water", "ramlösa", "loka", "festis", "smoothie",
  "milkshake", "mjölk", "milk", "trocadero", "pommac", "champis", "zingo", "kopparberg", "rekorderlig",
  "energidryck", "nocco", "red bull", "redbull", "helles", "veteöl", "weissbier", "vienna", "pucko",
]);
const isDessert = makeMatcher([
  "glass", "gelato", "dessert", "efterrätt", "kaka", "kakor", "cake", "cheesecake", "paj", "pie",
  "tiramisu", "crème", "creme", "brûlée", "brulee", "kräm", "maräng", "marängsviss", "fromage",
  "choklad", "chocolate", "sorbet", "pannacotta", "panna cotta", "kladdkaka", "våffla", "våfflor",
  "waffle", "semla", "bulle", "kanelbulle", "ostkaka", "mousse", "parfait", "sundae", "äppelpaj",
  "chokladboll", "praliner", "munk", "donut", "pannkaka", "baklava", "cannoli", "mochi",
]);
const isFood = makeMatcher([
  "sallad", "salad", "nicoise", "niçoise", "pizza", "calzone", "pasta", "lasagne", "burgare",
  "burger", "hamburgare", "biff", "entrecôte", "entrecote", "ryggbiff", "oxfilé", "fläskfilé",
  "flankstek", "plankstek", "stek", "kött", "fläsk", "gris", "kalv", "fisk", "fish", "lax",
  "regnbåge", "regnbågslax", "gravlax", "torsk", "sill", "strömming", "räka", "räkor", "ostron",
  "mussla", "musslor", "skaldjur", "kyckling", "chicken", "anka", "kalkon", "korv", "falukorv",
  "varmkorv", "kebab", "falafel", "fralla", "macka", "mackor", "smörgås", "knäcke", "sandwich",
  "wrap", "panini", "bagel", "toast", "omelett", "ägg", "schnitzel", "soppa", "soup", "gryta",
  "tacos", "taco", "nachos", "sushi", "nigiri", "maki", "poke", "ramen", "nudlar", "ris", "risotto",
  "pommes", "fries", "potatis", "bröd", "ost", "mozzarella", "prosciutto", "salami", "skinka",
  "chark", "broccoli", "sparris", "grönsak", "kantarell", "kantareller", "svamp", "rotselleri",
  "selleri", "förrätt", "varmrätt", "huvudrätt", "tallrik", "meny",
  "hummer", "kräfta", "kräftor", "löjrom", "matjessill", "matjes", "skagen", "räkmacka",
  "köttbullar", "wallenbergare", "oxbringa", "oxrygg", "oxkind", "lamm", "isterband", "kalops",
  "raggmunk", "råraka", "janssons", "pyttipanna", "kroppkakor", "rotmos", "kåldolmar", "kålpudding",
  "duxelle", "rödbeta", "brioche", "pastrami", "halloumi",
  "bao", "edamame", "samosa", "empanada", "tagine", "tajine", "hummus", "shakshuka", "risotto",
  "spring roll", "vårrulle", "pad thai", "curry", "tikka masala", "ceviche", "biryani",
]);

/** Keyword fallback (Swedish + English) when the model gives no category. */
function guessCategory(description: string): Category {
  if (isDrink(description)) return "drink";
  if (isDessert(description)) return "dessert";
  if (isFood(description)) return "food";
  return "other";
}

/** Resolve a display category from the model's hint and the description. */
export function categoryFor(description: string, hint?: string): Category {
  const fromHint = hint ? normalizeCategory(hint) : "other";
  if (fromHint !== "other") return fromHint;
  return guessCategory(description);
}

// Items that lack a good Unicode emoji get a hand-drawn SVG (see ItemIcons).
// emojiFor returns the sentinel "ci:<id>"; the UI swaps in the matching icon.
// This map is the single source of truth for which names map to each icon.
export const CUSTOM_ICON_NAMES: Record<string, string[]> = {
  bun: ["kanelbulle", "kanelbullar", "kanelsnurra", "kanelsnurror", "kardemummabulle", "kardemummabullar"],
  semla: ["semla", "semlor", "fastlagsbulle"],
  snaps: ["snaps", "nubbe", "akvavit", "brännvin", "o.p. anderson", "op anderson", "bäska", "skåne akvavit", "hallands fläder"],
  kottbullar: ["köttbullar", "köttbulle"],
  skagen: ["toast skagen", "skagen", "skagenröra", "räkmacka", "räksmörgås"],
  prinsesstarta: ["prinsesstårta", "prinsessbakelse"],
  glogg: ["glögg"],
  lojrom: ["löjrom", "löjromstoast", "stenbitsrom"],
  energidryck: ["energidryck", "red bull", "redbull", "nocco", "celsius", "monster", "battery"],
  macaron: ["macaron", "macarons"],
  paella: ["paella"],
  poke: ["poke", "poke bowl", "pokebowl"],
  tartare: ["tartare", "råbiff", "steak tartare", "biff tartar"],
  fishandchips: ["fish and chips", "fish & chips", "fish n chips", "fish chips"],
  charcuterie: ["charcuterie", "charkbricka", "ostbricka", "osttallrik", "antipasti", "plockmat"],
  nachos: ["nachos"],
  tiramisu: ["tiramisu"],
  spritz: ["aperol spritz", "aperol", "spritz", "limespritz"],
  gintonic: ["gin tonic", "gin & tonic", "gin och tonic", "gintonic", "g&t"],
  burrata: ["burrata", "caprese", "mozzarella tomat"],
  churros: ["churros", "churro"],
  bao: ["bao", "bao bun", "baobun", "gua bao", "steamed bun"],
  springroll: ["spring roll", "spring rolls", "vårrulle", "vårrullar", "summer roll", "egg roll", "friterad vårrulle"],
  edamame: ["edamame"],
  padthai: ["pad thai", "padthai", "pad see ew"],
  samosa: ["samosa", "samosas"],
  curry: ["curry", "tikka masala", "butter chicken", "korma", "vindaloo", "masala", "röd curry", "grön curry"],
  empanada: ["empanada", "empanadas"],
  tagine: ["tagine", "tajine"],
  hummus: ["hummus", "houmous", "hommus"],
  shakshuka: ["shakshuka", "shakshouka"],
  baklava: ["baklava", "baklawa"],
  risotto: ["risotto"],
  cannoli: ["cannoli", "cannolo"],
  mochi: ["mochi"],
};

const CUSTOM_ICON_RULES: [(desc: string) => boolean, string][] = Object.entries(CUSTOM_ICON_NAMES).map(
  ([id, names]) => [makeMatcher(names), `ci:${id}`],
);

// Specific item → emoji, most-specific first (first match wins). Custom SVG
// icons are matched before the emoji rules. Uses the compound-aware matcher.
const EMOJI_RULES: [(desc: string) => boolean, string][] = [
  ...CUSTOM_ICON_RULES,
  // drinks
  [makeMatcher(["öl", "lager", "ipa", "ale", "stout", "pilsner", "porter", "brewing", "bryggeri"]), "🍺"],
  [makeMatcher(["champagne", "mumm", "bubbel", "cava", "prosecco", "mousserande"]), "🍾"],
  [makeMatcher(["cocktail", "aviation", "negroni", "spritz", "mojito", "margarita", "martini", "aperol", "daiquiri", "gimlet"]), "🍸"],
  [makeMatcher(["vin", "rödvin", "rött vin", "vitt vin", "rosé", "blanc", "rouge", "wine", "merlot", "cabernet", "chardonnay", "sauvignon", "riesling", "pinot", "rioja", "chablis", "vouvray", "glögg"]), "🍷"],
  [makeMatcher(["whisky", "whiskey", "vodka", "rom", "tequila", "sprit", "snaps", "nubbe", "shot", "konjak", "cognac", "gin"]), "🥃"],
  [makeMatcher(["kaffe", "coffee", "espresso", "latte", "cappuccino", "americano", "macchiato", "cortado"]), "☕"],
  [makeMatcher(["te", "tea", "chai"]), "🍵"],
  [makeMatcher(["läsk", "soda", "softdrink", "cola", "fanta", "sprite", "pepsi", "festis", "julmust", "must", "trocadero", "pommac", "champis", "zingo", "loka", "ramlösa", "bonaqua", "tonic"]), "🥤"],
  [makeMatcher(["cider", "kopparberg", "rekorderlig", "somersby", "briska"]), "🍏"],
  [makeMatcher(["energidryck", "red bull", "redbull", "nocco"]), "⚡"],
  [makeMatcher(["juice", "apelsinjuice", "äppeljuice", "smoothie", "saft"]), "🧃"],
  [makeMatcher(["vatten", "water", "mineralvatten"]), "💧"],
  [makeMatcher(["mjölk", "milk", "milkshake", "pucko"]), "🥛"],
  // food
  [makeMatcher(["pizza", "calzone"]), "🍕"],
  [makeMatcher(["pasta", "spaghetti", "carbonara", "lasagne", "tagliatelle", "penne", "bolognese"]), "🍝"],
  [makeMatcher(["burgare", "burger", "hamburgare", "cheeseburgare"]), "🍔"],
  [makeMatcher(["pommes", "fries", "strips"]), "🍟"],
  [makeMatcher(["sushi", "nigiri", "maki", "sashimi", "poke", "löjrom", "löjromstoast"]), "🍣"],
  [makeMatcher(["ostron", "mussla", "musslor", "moules"]), "🦪"],
  [makeMatcher(["hummer", "kräfta", "kräftor", "langust"]), "🦞"],
  [makeMatcher(["räka", "räkor", "skaldjur", "skagen", "krabba", "räkmacka", "räksmörgås"]), "🍤"],
  [makeMatcher(["fisk", "lax", "regnbåge", "regnbågslax", "gravlax", "torsk", "sill", "matjessill", "matjes", "strömming", "fish"]), "🐟"],
  [makeMatcher(["kyckling", "chicken", "vingar", "wings"]), "🍗"],
  [makeMatcher(["korv", "varmkorv", "falukorv", "isterband", "prinskorv", "hotdog", "grillkorv"]), "🌭"],
  [makeMatcher(["biff", "entrecôte", "ryggbiff", "oxfilé", "oxrygg", "oxbringa", "oxkind", "flankstek", "plankstek", "stek", "kött", "köttbullar", "wallenbergare", "fläsk", "fläskfilé", "gris", "kalv", "lamm", "schnitzel", "kotlett", "anka", "kalkon"]), "🥩"],
  [makeMatcher(["prosciutto", "salami", "skinka", "chark"]), "🥓"],
  [makeMatcher(["sallad", "salad", "nicoise", "niçoise"]), "🥗"],
  [makeMatcher(["kåldolmar", "kålpudding", "surkål", "grönkål", "vitkål"]), "🥬"],
  [makeMatcher(["soppa", "soup", "gryta", "kalops", "ramen"]), "🍲"],
  [makeMatcher(["taco", "tacos", "burrito", "quesadilla", "nachos"]), "🌮"],
  [makeMatcher(["kebab", "falafel", "shawarma", "gyros", "wrap"]), "🥙"],
  [makeMatcher(["fralla", "macka", "mackor", "smörgås", "knäcke", "sandwich", "panini", "sub"]), "🥪"],
  [makeMatcher(["bröd", "baguette", "focaccia"]), "🥖"],
  [makeMatcher(["mozzarella", "ost", "cheese", "brie"]), "🧀"],
  [makeMatcher(["ägg", "omelett", "äggröra"]), "🍳"],
  [makeMatcher(["broccoli", "sparris", "grönsak", "böna", "haricot"]), "🥦"],
  [makeMatcher(["svamp", "kantarell", "kantareller", "tryffel"]), "🍄"],
  [makeMatcher(["potatis", "mos", "klyftpotatis", "raggmunk", "råraka", "janssons", "pyttipanna", "pytt", "kroppkakor", "rotmos", "hasselback", "rotselleri", "selleri", "rotfrukt"]), "🥔"],
  [makeMatcher(["ris", "risotto", "nudlar", "noodles", "wok"]), "🍜"],
  // dessert
  [makeMatcher(["glass", "gelato", "glasstrut", "sundae"]), "🍨"],
  [makeMatcher(["paj", "pie", "äppelpaj"]), "🥧"],
  [makeMatcher(["munk", "donut", "doughnut"]), "🍩"],
  [makeMatcher(["våffla", "våfflor", "waffle"]), "🧇"],
  [makeMatcher(["pannkaka", "pannkakor", "crepe", "crêpe"]), "🥞"],
  [makeMatcher(["crème", "creme", "brûlée", "brulee", "maräng", "marängsviss", "kräm", "mousse", "fromage", "parfait"]), "🍮"],
  [makeMatcher(["choklad", "chocolate", "chokladboll", "praliner"]), "🍫"],
  [makeMatcher(["bulle", "bullar", "wienerbröd", "croissant", "giffel"]), "🥐"],
  [makeMatcher(["cookie", "kakor", "biscotti", "småkakor"]), "🍪"],
  [makeMatcher(["kaka", "cake", "cheesecake", "tårta", "ostkaka", "kladdkaka", "muffins", "cupcake"]), "🍰"],
];

// --- shared-item detection -------------------------------------------------
// A deterministic second layer on top of the model's `shared` guess. "auto"
// cues are near-certain (we mark them shared automatically); "suggest" cues are
// often-but-not-always shared (we only hint, the user confirms).
const autoSharedMatch = makeMatcher([
  "att dela", "to share", "för bordet", "till bordet", "för två", "for two", "for the table", "fruits de mer",
  "75cl", "70cl", "100cl", "150cl", "magnum", "helflaska", "karaff", "carafe", "tillbringare", "pitcher",
  "plateau", "charkbricka", "ostbricka", "delikatessbricka", "skaldjursplatå", "skaldjursplateau",
  "delningsbricka", "antipasti", "antipasto", "tapas", "meze", "mezze",
]);
const maybeSharedMatch = makeMatcher([
  "mixed grill", "blandad grill", "flaska", "btl", "bottle", "bröd", "vitlöksbröd", "oliver", "olives",
  "nachos", "guacamole", "hummus", "bruschetta", "lökringar", "edamame",
]);

/**
 * Whether an item description looks like a shared one. "auto" = mark it shared
 * automatically; "suggest" = offer a one-tap hint; null = no signal.
 */
export function sharedSuggestion(description: string): "auto" | "suggest" | null {
  if (autoSharedMatch(description)) return "auto";
  if (maybeSharedMatch(description)) return "suggest";
  return null;
}

/** A model-supplied emoji is usable only if it's an emoji, not stray text. */
function isEmoji(s: string | undefined): s is string {
  return !!s && s.length <= 8 && !/[a-z0-9]/i.test(s);
}

/**
 * Pick the most specific food/drink emoji: a curated keyword rule first, then
 * the model's own emoji (it knows brands — e.g. wines like O'scuru → 🍷), and
 * finally the generic category icon.
 */
export function emojiFor(description: string, hint?: string, modelEmoji?: string): string {
  for (const [match, emoji] of EMOJI_RULES) if (match(description)) return emoji;
  if (isEmoji(modelEmoji)) return modelEmoji;
  return CATEGORY_EMOJI[categoryFor(description, hint)];
}
