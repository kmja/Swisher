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
    // A suffix match needs a real compound stem in front (≥2 chars), so "läsk"
    // (soda) matches "sockerläsk" but NOT "fläsk" (pork) — "flask" is not "f"+"lask".
    return tokens.some((tok) =>
      whole.has(tok) ||
      affix.some((w) => tok === w || tok.startsWith(w) || (tok.endsWith(w) && tok.length >= w.length + 2)),
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
  "milkshake", "mjölk", "milk",
]);
const isDessert = makeMatcher([
  "glass", "gelato", "dessert", "efterrätt", "kaka", "kakor", "cake", "cheesecake", "paj", "pie",
  "tiramisu", "crème", "creme", "brûlée", "brulee", "kräm", "maräng", "marängsviss", "fromage",
  "choklad", "chocolate", "sorbet", "pannacotta", "panna cotta", "kladdkaka", "våffla", "våfflor",
  "waffle", "semla", "bulle", "kanelbulle", "ostkaka", "mousse", "parfait", "sundae", "äppelpaj",
  "chokladboll", "praliner", "munk", "donut", "pannkaka",
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

// Sentinel returned by emojiFor for cinnamon/cardamom buns. Unicode has no
// cinnamon-bun emoji, so the UI swaps this for a custom SVG (see ItemEmoji).
export const CINNAMON_BUN = "cinnamon-bun";

// Specific item → emoji, most-specific first (first match wins). Uses the same
// compound-aware matcher as the categoriser.
const EMOJI_RULES: [(desc: string) => boolean, string][] = [
  // drinks
  [makeMatcher(["öl", "lager", "ipa", "ale", "stout", "pilsner", "porter", "brewing", "bryggeri"]), "🍺"],
  [makeMatcher(["champagne", "mumm", "bubbel", "cava", "prosecco", "mousserande"]), "🍾"],
  [makeMatcher(["cocktail", "aviation", "negroni", "spritz", "mojito", "margarita", "martini", "aperol", "daiquiri", "gimlet"]), "🍸"],
  [makeMatcher(["vin", "rödvin", "rött vin", "vitt vin", "rosé", "blanc", "rouge", "wine", "merlot", "cabernet", "chardonnay", "sauvignon", "riesling", "pinot", "rioja", "chablis", "vouvray", "glögg"]), "🍷"],
  [makeMatcher(["whisky", "whiskey", "vodka", "rom", "tequila", "sprit", "snaps", "nubbe", "shot", "konjak", "cognac", "gin"]), "🥃"],
  [makeMatcher(["kaffe", "coffee", "espresso", "latte", "cappuccino", "americano", "macchiato", "cortado"]), "☕"],
  [makeMatcher(["te", "tea", "chai"]), "🍵"],
  [makeMatcher(["läsk", "soda", "cola", "fanta", "sprite", "pepsi", "festis", "julmust", "must", "loka", "ramlösa", "tonic", "cider"]), "🥤"],
  [makeMatcher(["juice", "apelsinjuice", "äppeljuice", "smoothie"]), "🧃"],
  [makeMatcher(["vatten", "water", "mineralvatten"]), "💧"],
  [makeMatcher(["mjölk", "milk", "milkshake"]), "🥛"],
  // food
  [makeMatcher(["pizza", "calzone"]), "🍕"],
  [makeMatcher(["pasta", "spaghetti", "carbonara", "lasagne", "tagliatelle", "penne", "bolognese"]), "🍝"],
  [makeMatcher(["burgare", "burger", "hamburgare", "cheeseburgare"]), "🍔"],
  [makeMatcher(["pommes", "fries", "strips"]), "🍟"],
  [makeMatcher(["sushi", "nigiri", "maki", "sashimi", "poke"]), "🍣"],
  [makeMatcher(["ostron"]), "🦪"],
  [makeMatcher(["räka", "räkor", "skaldjur", "mussla", "musslor", "krabba", "kräfta", "hummer"]), "🍤"],
  [makeMatcher(["fisk", "lax", "regnbåge", "regnbågslax", "gravlax", "torsk", "sill", "strömming", "fish"]), "🐟"],
  [makeMatcher(["kyckling", "chicken", "vingar", "wings"]), "🍗"],
  [makeMatcher(["korv", "varmkorv", "falukorv", "hotdog", "grillkorv"]), "🌭"],
  [makeMatcher(["biff", "entrecôte", "ryggbiff", "oxfilé", "flankstek", "plankstek", "stek", "kött", "fläsk", "fläskfilé", "gris", "kalv", "schnitzel", "kotlett", "anka", "kalkon"]), "🥩"],
  [makeMatcher(["prosciutto", "salami", "skinka", "chark"]), "🥓"],
  [makeMatcher(["sallad", "salad", "nicoise", "niçoise"]), "🥗"],
  [makeMatcher(["soppa", "soup", "gryta", "ramen"]), "🍲"],
  [makeMatcher(["taco", "tacos", "burrito", "quesadilla", "nachos"]), "🌮"],
  [makeMatcher(["kebab", "falafel", "shawarma", "gyros", "wrap"]), "🥙"],
  [makeMatcher(["fralla", "macka", "mackor", "smörgås", "knäcke", "sandwich", "panini", "sub"]), "🥪"],
  [makeMatcher(["bröd", "baguette", "focaccia"]), "🥖"],
  [makeMatcher(["mozzarella", "ost", "cheese", "brie"]), "🧀"],
  [makeMatcher(["ägg", "omelett", "äggröra"]), "🍳"],
  [makeMatcher(["broccoli", "sparris", "grönsak", "böna", "haricot"]), "🥦"],
  [makeMatcher(["svamp", "kantarell", "kantareller", "tryffel"]), "🍄"],
  [makeMatcher(["potatis", "mos", "klyftpotatis", "rotselleri", "selleri", "rotfrukt"]), "🥔"],
  [makeMatcher(["ris", "risotto", "nudlar", "noodles", "wok"]), "🍜"],
  // dessert
  [makeMatcher(["glass", "gelato", "glasstrut", "sundae"]), "🍨"],
  [makeMatcher(["paj", "pie", "äppelpaj"]), "🥧"],
  [makeMatcher(["munk", "donut", "doughnut"]), "🍩"],
  [makeMatcher(["våffla", "våfflor", "waffle"]), "🧇"],
  [makeMatcher(["pannkaka", "pannkakor", "crepe", "crêpe"]), "🥞"],
  [makeMatcher(["crème", "creme", "brûlée", "brulee", "maräng", "marängsviss", "kräm", "mousse", "fromage", "parfait"]), "🍮"],
  [makeMatcher(["choklad", "chocolate", "chokladboll", "praliner"]), "🍫"],
  [makeMatcher(["kanelbulle", "kanelbullar", "kanelsnurra", "kanelsnurror", "kardemummabulle", "kardemummabullar"]), CINNAMON_BUN],
  [makeMatcher(["bulle", "bullar", "semla", "semlor", "wienerbröd", "croissant", "giffel"]), "🥐"],
  [makeMatcher(["cookie", "kakor", "biscotti", "småkakor"]), "🍪"],
  [makeMatcher(["kaka", "cake", "cheesecake", "tårta", "ostkaka", "kladdkaka", "muffins", "cupcake"]), "🍰"],
];

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
