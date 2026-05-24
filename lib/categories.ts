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
// all match — receipts often drop å/ä/ö to a/o. Matching is then whole-word over
// plain a-z, so "lax" won't match "regnbagslax" and "glas" won't match "glass".
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const wholeWord = (words: string[]) => new RegExp(`(?<![a-z])(?:${words.map(norm).join("|")})(?![a-z])`);

const DRINK_RE = wholeWord([
  "öl", "lager", "ipa", "ale", "stout", "pilsner", "cider", "vin", "rödvin", "vitt vin", "rosé",
  "bubbel", "champagne", "cava", "prosecco", "wine", "beer", "cocktail", "drink", "gin", "tonic",
  "whisky", "whiskey", "vodka", "rom", "tequila", "snaps", "nubbe", "shot", "kaffe", "coffee",
  "espresso", "latte", "cappuccino", "americano", "te", "tea", "läsk", "saft", "must", "julmust",
  "glögg", "cola", "fanta", "sprite", "pepsi", "soda", "juice", "vatten", "water", "ramlösa",
  "loka", "festis", "smoothie", "milkshake", "flaska", "carafe", "karaff",
]);
const DESSERT_RE = wholeWord([
  "glass", "dessert", "efterrätt", "kaka", "kakor", "cake", "cheesecake", "paj", "pie", "tiramisu",
  "crème", "creme", "brûlée", "brulee", "choklad", "chocolate", "sorbet", "pannacotta", "panna cotta",
  "kladdkaka", "våffla", "våfflor", "waffle", "semla", "bulle", "kanelbulle", "ostkaka", "mousse",
  "parfait", "sundae", "äppelpaj", "chokladboll",
]);
const FOOD_RE = wholeWord([
  "sallad", "salad", "pizza", "pasta", "lasagne", "burgare", "burger", "hamburgare", "biff",
  "entrecôte", "entrecote", "ryggbiff", "oxfilé", "fläskfilé", "flankstek", "plankstek", "stek",
  "kött", "fläsk", "fisk", "fish", "lax", "regnbåge", "regnbågslax", "gravlax", "torsk", "sill",
  "strömming", "räka", "räkor", "skaldjur", "musslor", "kyckling", "chicken", "anka", "kalkon",
  "korv", "falukorv", "varmkorv", "kebab", "falafel", "fralla", "macka", "mackor", "smörgås",
  "sandwich", "wrap", "panini", "bagel", "toast", "omelett", "schnitzel", "soppa", "soup", "gryta",
  "tacos", "taco", "nachos", "sushi", "nigiri", "maki", "poke", "ramen", "nudlar", "ris", "pommes",
  "fries", "potatis", "bröd", "ost", "förrätt", "varmrätt", "huvudrätt", "tallrik",
]);

/** Keyword fallback (Swedish + English) when the model gives no category. */
function guessCategory(description: string): Category {
  const s = norm(description);
  if (DRINK_RE.test(s)) return "drink";
  if (DESSERT_RE.test(s)) return "dessert";
  if (FOOD_RE.test(s)) return "food";
  return "other";
}

/** Resolve a display category from the model's hint and the description. */
export function categoryFor(description: string, hint?: string): Category {
  const fromHint = hint ? normalizeCategory(hint) : "other";
  if (fromHint !== "other") return fromHint;
  return guessCategory(description);
}

// Emoji matcher: distinctive words (≥4 chars) match as substrings so Swedish
// compounds work (köttbullar→🥩, kebabtallrik→🥙); short ambiguous words
// (öl, te, ris, ost, vin) match whole-word only to avoid false hits.
function emojiMatcher(words: string[]): (s: string) => boolean {
  const normed = words.map(norm);
  const shorts = normed.filter((w) => w.length <= 3);
  const longs = normed.filter((w) => w.length >= 4);
  const shortRe = shorts.length ? new RegExp(`(?<![a-z])(?:${shorts.join("|")})(?![a-z])`) : null;
  return (s) => (shortRe ? shortRe.test(s) : false) || longs.some((w) => s.includes(w));
}

// Specific item → emoji, most-specific first (first match wins).
const EMOJI_RULES: [(s: string) => boolean, string][] = [
  // drinks
  [emojiMatcher(["öl", "lager", "ipa", "ale", "stout", "pilsner", "porter"]), "🍺"],
  [emojiMatcher(["champagne", "bubbel", "cava", "prosecco", "mousserande"]), "🍾"],
  [emojiMatcher(["vin", "rödvin", "vitt vin", "rosé", "wine", "glögg"]), "🍷"],
  [emojiMatcher(["cocktail", "negroni", "spritz", "mojito", "margarita", "martini", "aperol"]), "🍸"],
  [emojiMatcher(["whisky", "whiskey", "vodka", "rom", "tequila", "snaps", "nubbe", "shot", "konjak", "cognac", "gin"]), "🥃"],
  [emojiMatcher(["kaffe", "coffee", "espresso", "latte", "cappuccino", "americano", "macchiato", "cortado"]), "☕"],
  [emojiMatcher(["te", "tea", "chai"]), "🍵"],
  [emojiMatcher(["läsk", "soda", "cola", "fanta", "sprite", "pepsi", "festis", "julmust", "must", "loka", "ramlösa", "tonic", "cider"]), "🥤"],
  [emojiMatcher(["juice", "apelsinjuice", "äppeljuice", "smoothie"]), "🧃"],
  [emojiMatcher(["vatten", "water", "mineralvatten"]), "💧"],
  [emojiMatcher(["mjölk", "milk", "fil", "milkshake"]), "🥛"],
  // food
  [emojiMatcher(["pizza", "calzone"]), "🍕"],
  [emojiMatcher(["pasta", "spaghetti", "carbonara", "lasagne", "tagliatelle", "penne", "bolognese"]), "🍝"],
  [emojiMatcher(["burgare", "burger", "hamburgare", "cheeseburgare"]), "🍔"],
  [emojiMatcher(["pommes", "fries", "strips"]), "🍟"],
  [emojiMatcher(["sushi", "nigiri", "maki", "sashimi", "poke"]), "🍣"],
  [emojiMatcher(["räka", "räkor", "skaldjur", "musslor", "krabba", "kräfta", "hummer"]), "🍤"],
  [emojiMatcher(["fisk", "lax", "regnbåge", "regnbågslax", "torsk", "sill", "strömming", "gravlax", "fish"]), "🐟"],
  [emojiMatcher(["kyckling", "chicken", "vingar", "wings"]), "🍗"],
  [emojiMatcher(["korv", "varmkorv", "falukorv", "hotdog", "grillkorv"]), "🌭"],
  [emojiMatcher(["biff", "entrecôte", "ryggbiff", "oxfilé", "flankstek", "plankstek", "stek", "kött", "fläsk", "fläskfilé", "schnitzel", "kotlett", "anka", "kalkon"]), "🥩"],
  [emojiMatcher(["sallad", "salad", "sallader"]), "🥗"],
  [emojiMatcher(["soppa", "soup", "gryta", "ramen"]), "🍲"],
  [emojiMatcher(["taco", "tacos", "burrito", "quesadilla", "nachos"]), "🌮"],
  [emojiMatcher(["kebab", "falafel", "shawarma", "gyros", "wrap"]), "🥙"],
  [emojiMatcher(["fralla", "macka", "mackor", "smörgås", "sandwich", "panini", "sub"]), "🥪"],
  [emojiMatcher(["bröd", "baguette", "focaccia"]), "🥖"],
  [emojiMatcher(["ost", "cheese", "brie"]), "🧀"],
  [emojiMatcher(["ägg", "omelett", "äggröra"]), "🍳"],
  [emojiMatcher(["ris", "risotto", "nudlar", "noodles", "wok"]), "🍜"],
  [emojiMatcher(["potatis", "mos", "klyftpotatis"]), "🥔"],
  // dessert
  [emojiMatcher(["glass", "gelato", "glasstrut", "sundae"]), "🍨"],
  [emojiMatcher(["paj", "pie", "äppelpaj"]), "🥧"],
  [emojiMatcher(["munk", "donut", "doughnut"]), "🍩"],
  [emojiMatcher(["våffla", "våfflor", "waffle"]), "🧇"],
  [emojiMatcher(["pannkaka", "pannkakor", "crepe", "crêpe"]), "🥞"],
  [emojiMatcher(["choklad", "chocolate", "chokladboll", "praliner"]), "🍫"],
  [emojiMatcher(["bulle", "kanelbulle", "semla", "wienerbröd", "croissant"]), "🥐"],
  [emojiMatcher(["cookie", "kakor", "biscotti", "småkakor"]), "🍪"],
  [emojiMatcher(["kaka", "cake", "cheesecake", "tårta", "ostkaka", "kladdkaka", "muffins", "cupcake"]), "🍰"],
];

/** Pick the most specific food/drink emoji for an item, else the category icon. */
export function emojiFor(description: string, hint?: string): string {
  const s = norm(description);
  for (const [match, emoji] of EMOJI_RULES) if (match(s)) return emoji;
  return CATEGORY_EMOJI[categoryFor(description, hint)];
}
