export type LineItem = {
  id: string;
  description: string;
  /** Price in öre (1 SEK = 100 öre) to avoid floating-point drift. */
  priceOre: number;
  /** Diner ids sharing this item. Empty = unassigned. */
  sharers: string[];
};

export type Diner = {
  id: string;
  name: string;
};

/** Raw structured result from the OCR step (kronor as numbers, comma already parsed). */
export type OcrResult = {
  items: { description: string; price: number }[];
  total: number | null;
  moms: number | null;
  dricks: number | null;
};

/** Per-person computed breakdown, all amounts in öre. */
export type Share = {
  dinerId: string;
  name: string;
  subtotalOre: number;
  tipOre: number;
  totalOre: number;
};
