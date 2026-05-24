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
  items: { description: string; price: number; shared?: boolean; category?: string }[];
  total: number | null;
  moms: number | null;
  dricks: number | null;
  /** Restaurant/merchant name read from the receipt. */
  place: string | null;
  /** Receipt date as YYYY-MM-DD. */
  date: string | null;
};

/** Per-person computed breakdown, all amounts in öre. */
export type Share = {
  dinerId: string;
  name: string;
  subtotalOre: number;
  tipOre: number;
  totalOre: number;
};
