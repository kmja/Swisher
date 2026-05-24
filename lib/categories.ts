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
