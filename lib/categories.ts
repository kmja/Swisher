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

// Whole-word matcher whose boundaries treat accented letters (å ä ö é ô …) as
// word characters, so "entrecôte" doesn't match "te" and "glass" doesn't match
// "glas". Input must be lower-cased.
const LETTER = "a-zà-ÿ";
const wholeWord = (words: string[]) => new RegExp(`(?<![${LETTER}])(?:${words.join("|")})(?![${LETTER}])`);

const DRINK_RE = wholeWord([
  "öl", "lager", "ipa", "cider", "vin", "rödvin", "vitt vin", "wine", "beer", "cocktail", "drink",
  "gin", "whisky", "vodka", "rom", "tequila", "snaps", "shot", "kaffe", "coffee", "espresso",
  "latte", "cappuccino", "te", "tea", "läsk", "soda", "cola", "juice", "vatten", "water",
  "smoothie", "milkshake", "flaska", "carafe", "karaff",
]);
const DESSERT_RE = wholeWord([
  "glass", "dessert", "efterrätt", "kaka", "cake", "cheesecake", "paj", "pie", "tiramisu", "crème",
  "creme", "brûlée", "brulee", "choklad", "chocolate", "sorbet", "pannacotta", "panna cotta",
  "kladdkaka", "våffla", "våfflor", "waffle",
]);
const FOOD_RE = wholeWord([
  "sallad", "salad", "pizza", "pasta", "burgare", "burger", "biff", "entrecôte", "entrecote",
  "kött", "fläsk", "fisk", "fish", "lax", "kyckling", "chicken", "soppa", "soup", "råbiff", "toast",
  "smörgås", "sandwich", "pommes", "fries", "förrätt", "varmrätt", "huvudrätt", "tallrik",
  "plankstek", "tacos", "sushi", "nachos", "bröd", "ost", "skaldjur", "räkor", "räk",
]);

/** Keyword fallback (Swedish + English) when the model gives no category. */
function guessCategory(description: string): Category {
  const s = description.toLowerCase();
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
