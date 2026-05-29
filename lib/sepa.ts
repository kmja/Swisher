/**
 * SEPA / EPC "Girocode" QR support. The EPC QR (standard EPC069-12) encodes a
 * SEPA credit transfer — beneficiary name, IBAN, amount and reference — that
 * European banking apps read and prefill. It's the euro-area analog to the
 * Swish deep link: the app never touches money, it just builds the request.
 * The EPC amount field is EUR-only by spec.
 */

export function normalizeIban(input: string): string {
  return (input || "").replace(/\s+/g, "").toUpperCase();
}

/** Group an IBAN into blocks of four for display, e.g. "DE89 3704 0044 …". */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();
}

/** Validate an IBAN: structure + ISO 7064 mod-97 checksum. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= "A" && ch <= "Z" ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const d of value) remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/**
 * Best-effort bank name for an IBAN, derived offline from the IBAN's own bank
 * identifier. NL only for now — every Dutch IBAN encodes the bank as a 4-letter
 * code at positions 5–8, which is small enough to map by hand. DE/FR/ES would
 * need much larger lookup tables; left for later.
 */
const NL_BANKS: Record<string, string> = {
  ABNA: "ABN AMRO",
  ASNB: "ASN Bank",
  BUNQ: "bunq",
  INGB: "ING",
  KNAB: "Knab",
  RABO: "Rabobank",
  REVO: "Revolut",
  SNSB: "SNS Bank",
  TRIO: "Triodos",
};

export function ibanBankName(iban: string): string | null {
  const normalized = normalizeIban(iban);
  if (!isValidIban(normalized)) return null;
  if (normalized.startsWith("NL")) {
    return NL_BANKS[normalized.slice(4, 8)] ?? null;
  }
  return null;
}

/** Strip characters outside the EPC-safe set and collapse whitespace. */
function clean(text: string, max: number): string {
  return (text || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^0-9A-Za-zÅÄÖåäöÆØæøÉéÜü .,:;!?()/'+&-]/g, "")
    .trim()
    .slice(0, max);
}

export type EpcPayment = {
  name: string;
  iban: string;
  /** Amount in euro cents (EPC QR is EUR-only). */
  eurCents: number;
  message: string;
};

/**
 * Build the 11-line EPC069-12 (version 002) payload. BIC is omitted, which is
 * allowed for SEPA-area transfers. The amount goes in the unstructured
 * remittance line so the payer sees what the payment is for.
 */
export function buildEpcPayload({ name, iban, eurCents, message }: EpcPayment): string {
  const amount = `EUR${(eurCents / 100).toFixed(2)}`;
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    "", // BIC — optional within the EEA
    clean(name, 70) || "Payee",
    normalizeIban(iban),
    amount,
    "", // purpose code
    "", // structured remittance reference
    clean(message, 140), // unstructured remittance
  ].join("\n");
}
