import { oreToKronor } from "./money";

/**
 * Normalise a Swedish mobile number to the local 0XXXXXXXXX form used as a
 * Swish payee. Accepts "+46 70 123 45 67", "0046701234567", "070-123 45 67".
 * Returns null when the result is not a plausible Swedish mobile number.
 */
export function normalizePhone(input: string): string | null {
  if (typeof input !== "string") return null;
  let s = input.replace(/[\s\-()]/g, "");
  if (s.startsWith("+46")) s = "0" + s.slice(3);
  else if (s.startsWith("0046")) s = "0" + s.slice(4);
  else if (s.startsWith("46") && s.length === 11) s = "0" + s.slice(2);

  // Swedish mobile numbers: 07 followed by 8 digits.
  if (/^07\d{8}$/.test(s)) return s;
  return null;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

export type SwishPayment = {
  /** Normalised payee mobile number, e.g. "0701234567". */
  payee: string;
  /** Amount in öre. */
  amountOre: number;
  message: string;
};

/**
 * Swish payment messages allow only a limited character set (max 50). Normalise
 * fancy dashes to a hyphen and drop anything outside the safe set, so the QR
 * generator and the app don't reject or garble the message.
 */
export function sanitizeMessage(message: string): string {
  return message
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^0-9A-Za-zÅÄÖåäöÆØæøÉéÜü .,:;!?()/+&-]/g, "")
    .trim()
    .slice(0, 50);
}

/**
 * Build the locked `swish://payment?data=` deep link. This is the documented
 * consumer prefill format: a phone that has Swish opens it straight to a locked
 * payment (a phone *without* Swish shows "address invalid" — handled by the QR
 * fallback). All fields are non-editable so the payer can't change the
 * recipient, amount, or message before confirming.
 */
export function buildSwishUri({ payee, amountOre, message }: SwishPayment): string {
  const data = {
    version: 1,
    payee: { value: payee, editable: false },
    amount: { value: oreToKronor(amountOre), editable: false },
    message: { value: sanitizeMessage(message), editable: false },
  };
  return `swish://payment?data=${encodeURIComponent(JSON.stringify(data))}`;
}

/** Request body for the public getSwish prefilled QR generator. */
export function buildPrefilledQrBody({ payee, amountOre, message }: SwishPayment) {
  return {
    format: "png",
    size: 300,
    border: 1,
    transparent: false,
    payee: { value: payee, editable: false },
    amount: { value: oreToKronor(amountOre), editable: false },
    message: { value: sanitizeMessage(message), editable: false },
  };
}

export const SWISH_QR_ENDPOINT =
  "https://mpc.getswish.net/qrg-swish/api/v1/prefilled";
