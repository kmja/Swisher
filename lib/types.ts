export type LineItem = {
  id: string;
  description: string;
  /** Price in öre (1 SEK = 100 öre) to avoid floating-point drift. */
  priceOre: number;
  /** Diner ids sharing this item. Empty = unassigned. Ignored when shared. */
  sharers: string[];
  /** Split across the whole group rather than specific diners. */
  shared?: boolean;
};

export type Diner = {
  id: string;
  name: string;
};

/** Raw structured result from the OCR step (kronor as numbers, comma already parsed). */
export type OcrResult = {
  items: { description: string; price: number; shared?: boolean; category?: string; emoji?: string; y?: number }[];
  total: number | null;
  moms: number | null;
  dricks: number | null;
  /** Amount actually charged/paid (e.g. a card transaction line). May exceed `total` when a tip was added. */
  charged: number | null;
  /** Restaurant/merchant name read from the receipt. */
  place: string | null;
  /** Receipt date as YYYY-MM-DD. */
  date: string | null;
  /** ISO 4217 currency of the printed prices (e.g. "EUR"); "SEK" by default. */
  currency: string | null;
  /** ISO 3166-1 alpha-2 country the receipt was issued in (e.g. "IT"). */
  country: string | null;
};

/** Per-person computed breakdown, all amounts in öre. */
export type Share = {
  dinerId: string;
  name: string;
  subtotalOre: number;
  tipOre: number;
  totalOre: number;
};
