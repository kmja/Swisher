export type Category = "starter" | "food" | "drink" | "dessert" | "other";

export const CATEGORY_ORDER: Category[] = ["starter", "food", "drink", "dessert", "other"];

export const CATEGORY_EMOJI: Record<Category, string> = {
  starter: "🥗",
  food: "🍽️",
  drink: "🍺",
  dessert: "🍰",
  other: "🧾",
};

export const CATEGORY_LABEL: Record<"sv" | "en", Record<Category, string>> = {
  sv: { starter: "Förrätt", food: "Varmrätt", drink: "Dryck", dessert: "Efterrätt", other: "Övrigt" },
  en: { starter: "Starters", food: "Mains", drink: "Drinks", dessert: "Dessert", other: "Other" },
};

export function normalizeCategory(v: unknown): Category {
  return v === "starter" || v === "food" || v === "drink" || v === "dessert" || v === "other" ? v : "other";
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
  // Swedish vowels (incl. å/ä/ö, normalized to a/o here). A prefix match only
  // counts if the next char is a consonant — so "fläsk" prefix-matches the
  // compound "fläskfilé" (f→consonant) but NOT the homonym "flaska" (a→vowel).
  const isVowel = (c: string) => "aeiouyåäö".includes(c);
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
          // Compound prefix only for distinctive (≥5-char) words, and only when
          // a 3+ char remainder follows that starts with a consonant — so
          // "fläsk" matches "fläskfilé" but not "flaska" (bottle).
          (w.length >= 5 &&
            tok.startsWith(w) &&
            tok.length >= w.length + 3 &&
            !isVowel(tok[w.length] ?? "")) ||
          (tok.endsWith(w) && tok.length >= w.length + 3),
      ),
    );
  };
}

const isDrink = makeMatcher([
  "öl", "lager", "ipa", "ale", "stout", "pilsner", "porter", "cider", "brewing", "bryggeri",
  "vin", "rödvin", "rött vin", "vitt vin", "rosé", "blanc", "rouge", "bubbel", "champagne", "cava",
  "prosecco", "mousserande", "wine", "merlot", "cabernet", "chardonnay", "sauvignon", "riesling",
  "pinot", "rioja", "chablis", "vouvray", "barolo", "barbaresco", "brunello", "chianti", "amarone",
  "valpolicella", "montepulciano", "sangiovese", "nebbiolo", "tempranillo", "malbec", "syrah",
  "shiraz", "zinfandel", "gamay", "bordeaux", "bourgogne", "burgundy", "sancerre", "garnacha",
  "grenache", "primitivo", "viognier", "gewürztraminer", "soave", "frascati", "lambrusco",
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
  "selleri", "varmrätt", "huvudrätt", "tallrik", "meny",
  "hummer", "kräfta", "kräftor", "löjrom", "matjessill", "matjes", "skagen", "räkmacka",
  "köttbullar", "wallenbergare", "oxbringa", "oxrygg", "oxkind", "lamm", "isterband", "kalops",
  "raggmunk", "råraka", "janssons", "pyttipanna", "kroppkakor", "rotmos", "kåldolmar", "kålpudding",
  "duxelle", "rödbeta", "brioche", "pastrami", "halloumi",
  "bao", "edamame", "samosa", "empanada", "tagine", "tajine", "hummus", "shakshuka", "risotto",
  "spring roll", "vårrulle", "pad thai", "curry", "tikka masala", "ceviche", "biryani",
]);

const isStarter = makeMatcher([
  "förrätt", "starter", "appetizer", "antipasti", "antipasto", "tapas", "meze", "mezze",
  "amuse", "bruschetta", "carpaccio", "tartare", "vitello tonnato", "räkcocktail",
  "toast skagen", "skagentoast", "löjromstoast",
  "charkbricka", "ostbricka", "delikatessbricka", "skaldjursplateau", "skaldjursplatå",
  "delningsbricka",
]);

/** Keyword fallback (Swedish + English) when the model gives no category. */
function guessCategory(description: string): Category {
  if (isDrink(description)) return "drink";
  if (isDessert(description)) return "dessert";
  if (isStarter(description)) return "starter";
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
  lasagne: ["lasagne", "lasagna"],
  waterbottle: [
    "flaska vatten", "vattenflaska", "mineralvatten", "kolsyrat vatten",
    "loka", "ramlösa", "vichy", "perrier", "evian", "san pellegrino", "bonaqua",
  ],
  waterglass: ["glas vatten", "vattenglas", "kranvatten", "isvatten"],
  watercarafe: [
    "karaff vatten", "tillbringare vatten", "vattenkaraff", "kanna vatten",
    "vatten karaff", "vatten tillbringare",
  ],
  winecarafe: [
    "karaff vin", "karaff rödvin", "karaff vitt vin", "karaff rosé",
    "vinkaraff", "wine carafe", "vin karaff",
  ],
  beerpitcher: [
    "tillbringare öl", "kanna öl", "stop öl", "pitcher öl", "öl tillbringare",
    "öl kanna", "60cl öl", "70cl öl", "stop", "öl stop",
  ],
  sangria: ["sangria", "karaff sangria", "kanna sangria", "tillbringare sangria"],
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
  [makeMatcher([
    "vin", "rödvin", "rött vin", "vitt vin", "rosé", "blanc", "rouge", "wine", "merlot", "cabernet",
    "chardonnay", "sauvignon", "riesling", "pinot", "rioja", "chablis", "vouvray", "glögg",
    "barolo", "barbaresco", "brunello", "chianti", "amarone", "valpolicella", "montepulciano",
    "sangiovese", "nebbiolo", "tempranillo", "malbec", "syrah", "shiraz", "zinfandel", "gamay",
    "bordeaux", "bourgogne", "burgundy", "sancerre", "garnacha", "grenache", "primitivo",
    "viognier", "gewürztraminer", "soave", "frascati", "lambrusco",
  ]), "🍷"],
  [makeMatcher(["whisky", "whiskey", "vodka", "rom", "tequila", "sprit", "snaps", "nubbe", "shot", "konjak", "cognac", "gin"]), "🥃"],
  [makeMatcher(["kaffe", "coffee", "espresso", "latte", "cappuccino", "americano", "macchiato", "cortado"]), "☕"],
  [makeMatcher(["te", "tea", "chai"]), "🍵"],
  [makeMatcher(["läsk", "soda", "softdrink", "cola", "fanta", "sprite", "pepsi", "festis", "julmust", "must", "trocadero", "pommac", "champis", "zingo", "tonic"]), "🥤"],
  [makeMatcher(["cider", "kopparberg", "rekorderlig", "somersby", "briska"]), "🍏"],
  [makeMatcher(["energidryck", "red bull", "redbull", "nocco"]), "⚡"],
  [makeMatcher(["juice", "apelsinjuice", "äppeljuice", "smoothie", "saft"]), "🧃"],
  [makeMatcher(["vatten", "water", "mineralvatten"]), "💧"],
  [makeMatcher(["mjölk", "milk", "milkshake", "pucko"]), "🥛"],
  // food
  // Pizza needs to match before the prosciutto/skinka pork rule so that
  // pizzeria lines like "Prosciutto Cotto 40cm" don't fall through to 🐖.
  // Widen with classic pizza names + a regex on the size suffix Xcm — the
  // tell-tale pizzeria size on a line like "Capricciosa 33cm" or "Margherita
  // 40cm". Real pizza names ("prosciutto cotto", "quattro formaggi") cover
  // the menu-item shorthand; ambiguous words like "vegetariano" are left
  // alone so a vegetarian non-pizza dish isn't dragged in.
  [
    (d: string) =>
      makeMatcher([
        "pizza", "calzone", "margherita", "capricciosa", "diavola", "funghi",
        "hawaii", "marinara", "salsiccia", "pepperoni", "peperoni", "frutti di mare",
        "quattro stagioni", "quattro formaggi", "prosciutto cotto", "prosciutto crudo",
        "salame piccante",
      ])(d) || /\d{2,3}\s*cm\b/i.test(d),
    "🍕",
  ],
  [makeMatcher(["pasta", "spaghetti", "carbonara", "tagliatelle", "penne", "bolognese"]), "🍝"],
  [makeMatcher(["burgare", "burger", "hamburgare", "cheeseburgare"]), "🍔"],
  [makeMatcher(["pommes", "fries", "strips"]), "🍟"],
  [makeMatcher(["sushi", "nigiri", "maki", "sashimi", "poke", "löjrom", "löjromstoast"]), "🍣"],
  [makeMatcher(["ostron", "mussla", "musslor", "moules"]), "🦪"],
  [makeMatcher(["hummer", "kräfta", "kräftor", "langust"]), "🦞"],
  [makeMatcher(["räka", "räkor", "skaldjur", "skagen", "krabba", "räkmacka", "räksmörgås"]), "🍤"],
  [makeMatcher(["fisk", "lax", "regnbåge", "regnbågslax", "gravlax", "torsk", "sill", "matjessill", "matjes", "strömming", "fish"]), "🐟"],
  [makeMatcher(["kyckling", "kycklingfilé", "kycklingbröst", "kycklinglår", "kycklinglever", "chicken"]), "🐔"],
  [makeMatcher(["vingar", "wings"]), "🍗"],
  [makeMatcher(["korv", "varmkorv", "falukorv", "isterband", "prinskorv", "hotdog", "grillkorv"]), "🌭"],
  // Animal-specific meat icons (specific keywords first; generic "kött/stek" falls through to 🥩).
  [makeMatcher(["lamm", "lammracks", "lammkotlett", "lammstek", "lammgryta", "lammfilé", "lammkebab", "lammkött", "lammbog"]), "🐑"],
  [makeMatcher(["fläsk", "fläskfilé", "fläskkarré", "fläsklägg", "gris", "grisfilé", "griskind", "skinka", "prosciutto", "bacon"]), "🐖"],
  [makeMatcher(["anka", "ankbröst", "anklever", "anklår", "duck"]), "🦆"],
  [makeMatcher(["kalkon", "kalkonbröst", "kalkonfilé", "turkey"]), "🦃"],
  [makeMatcher(["biff", "entrecôte", "entrecote", "ryggbiff", "oxfilé", "oxrygg", "oxbringa", "oxkind", "oxsvans", "flankstek", "köttbullar", "wallenbergare", "kalv", "kalvkind", "kalvkött", "kalvfilé", "carpaccio"]), "🐄"],
  [makeMatcher(["plankstek", "stek", "kött", "schnitzel", "kotlett", "salami"]), "🥩"],
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
