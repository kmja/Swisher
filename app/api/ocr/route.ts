import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { splitOre } from "@/lib/money";
import { fetchRateToSek } from "@/lib/fx";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vision OCR on Cloudflare Workers AI — keyless, via the `AI` binding.
// Both models are EU-safe (Meta's Llama 3.2 vision is license-restricted
// from the EU, so it is deliberately not used). Llama 4 Scout is the strongest
// reader; if its multimodal use is geo-blocked in the EU (error 5016) we fall
// back to Mistral Small 3.1, then LLaVA.
const LLAMA4_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MISTRAL_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const LLAVA_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";
// Claude reads faint receipts far better than the open models; used first when
// an ANTHROPIC_API_KEY is configured, with Workers AI as the fallback.
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
// Allowlist for the debug model override sent from the viewfinder — only
// these can be requested; anything else falls back to the default.
const CLAUDE_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-sonnet-5",
  "claude-opus-4-8",
]);
// Google Gemini — far cheaper than Sonnet per scan (3.1 Flash-Lite ~7×,
// 3 Flash ~4×), used when a gemini-* id is requested and GEMINI_API_KEY is
// set. Same streaming contract as Claude, so the live progress ticks work.
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_MODELS = new Set([
  "gemini-3.1-flash-lite",
  "gemini-3-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
]);
// The 3.x models may still be served under a -preview id. Try the bare id
// first, then a -preview variant, so a not-yet-GA rename doesn't silently
// drop the scan to the Workers AI fallback (which would confuse the A/B).
function geminiCandidates(model: string): string[] {
  return model.startsWith("gemini-3") ? [model, `${model}-preview`] : [model];
}

// English names of the app languages, for the translation instruction.
const LANG_NAME: Record<string, string> = {
  sv: "Swedish", en: "English", de: "German", fr: "French", es: "Spanish",
  it: "Italian", nl: "Dutch", da: "Danish", no: "Norwegian", fi: "Finnish",
  pl: "Polish", pt: "Portuguese",
};

const buildPrompt = (opts: { emoji: boolean; translateTo: string | null; alsoKnown?: string[] }) => {
  // Languages the diner is assumed to read — the target plus any extra
  // languages we don't bother translating away from (e.g. Nordic users
  // read English fine, so an English receipt stays untranslated for them).
  const known = opts.translateTo
    ? [...new Set([opts.translateTo, ...(opts.alsoKnown ?? [])])].join(" or ")
    : "";
  return `You read a photographed restaurant receipt (kvitto) — usually Swedish, but sometimes from another country. Return ONLY a JSON object — no markdown, no commentary — exactly matching:
{"items":[{"description":string,"price":number,"quantity":number,"category":"starter"|"food"|"drink"|"dessert"|"tip"|"other"${opts.emoji ? ',"emoji":string' : ""}${opts.translateTo ? ',"translation":string|null' : ""}}],"total":number|null,"moms":number|null,"dricks":number|null,"charged":number|null,"place":string|null,"date":string|null,"currency":string|null,"country":string|null}

Rules:
- "place" is the restaurant/café name, usually printed at the top. null if unclear.
- "date" is the receipt date as "YYYY-MM-DD" (convert formats like "16jan17" → "2017-01-16"). null if unreadable.
- "currency" is the ISO 4217 code of the printed prices: "SEK" for Swedish kronor ("kr", ":-", "moms"), "EUR" (€), "USD"/"$", "GBP"/"£", "NOK"/"DKK" (also "kr" but Norwegian/Danish text and place), "CHF", "THB" (฿), "JPY" (¥), "PLN", "CZK", etc. Infer it from the currency symbol, the language, the VAT label (moms=Sweden, MwSt=Germany/Austria, TVA=France/Belgium, IVA=Italy/Spain, BTW=Netherlands), and the address. Default "SEK" when it is clearly a Swedish receipt.
- "country" is the ISO 3166-1 alpha-2 country code where the receipt was issued ("SE","NO","DK","FI","DE","FR","IT","ES","GB","US","CH","NL","TH","JP"…), inferred from the address, phone prefix, language and currency. null if unclear.
- Always report every price EXACTLY as printed in the receipt's own currency. NEVER convert amounts to SEK or any other currency yourself — just read the numbers shown.
- "items" are the ordered dishes/drinks: a short description and the price.
- The description is the item NAME only. Strip the leading quantity (it goes in "quantity"): "2 glas Sybille Kuntz" → description "Glas Sybille Kuntz", quantity 2; "3 Kaffe" → "Kaffe", quantity 3.
- Spell each item the correct Swedish way: restore å/ä/ö and fix OCR letter slips so a recognisable dish/drink reads properly — e.g. "lansorts lage" → "Landsorts Lager", "rakor" → "räkor", "rört majonäs" → "Rökt majonnäs", "fläskkar" → "Fläskkarré", "marängsvisst" → "Marängsviss", "kalvkinn" → "Kalvkind", "fårslök" → "Färsklök", "gstron" → "Ostron", "entrecote" → "Entrecôte" — and use normal capitalisation, not ALL CAPS.
${opts.emoji ? `- "emoji" is one emoji that best represents the item, using your knowledge of brands and types: a wine — including brands like "Sybille Kuntz" or "O'scuru" — is 🍷; a beer is 🍺; Coca-Cola/soda is 🥤; coffee is ☕; oysters are 🦪; pork/meat is 🥩. Pick the most specific food or drink emoji you can.
` : ""}${opts.translateTo ? `- "translation": if the description is NOT already in ${known}, translate it into a natural ${opts.translateTo} dish/drink name (e.g. into English: "Bruschetta cu file" → "Bruschetta with beef tenderloin", "Tagliatelle ai funghi porcini" → "Tagliatelle with porcini mushrooms"). Keep brand names, place names and proper nouns as-is. Use null when the description is already in ${known}, or is just a brand/number that needs no translation.
` : ""}
- Crucially, keep it the SAME item — only correct its spelling, never swap an unclear word for a different, more plausible-sounding dish. If you genuinely cannot tell what a word is, transcribe it literally letter by letter rather than guessing. Never invent items, lines, or prices that are not printed on the receipt.
- When a line names a brand or product, keep that real brand name as printed instead of forcing a generic word (e.g. "Coca-Cola", "Ramlösa", "Pågen", "Brooklyn Lager", "Heinz"). Never invent a brand that isn't there, and never rewrite a genuine brand into a plain word.
- MULTI-LINE ITEMS — critical: POS receipts often spread a single ordered item across two (or more) lines. The first line has the line item and the price column; the next line(s) — typically indented, with no price column, and a smaller/lowercase font — continue or specify the description. ALWAYS merge them into ONE item: the second-line detail belongs IN the description, the continuation line is NEVER its own item. Patterns to look for:
  · Wrapped item name (the printer ran out of column width and broke the word): "Prosciutto Co" + "tto 40cm" → "Prosciutto Cotto 40cm".
  · Generic placeholder + specific variant: "Softdrink nr 2" + "Coca Cola 0,4" → "Softdrink nr 2 - Coca Cola 0,4"; the very next "Softdrink nr 2" line with "Bonaqua Glassf" below it → "Softdrink nr 2 - Bonaqua Glassflaska". Two identical-looking parent lines with different continuations are DIFFERENT items — preserve the variant so the human can tell which drink was which.
  · Generic + specific wine / beer: "Husets vin" + "Pinot Noir" → "Husets vin - Pinot Noir"; "Tap" + "Brooklyn Lager" → "Brooklyn Lager"; "Glas vin" + "Sybille Kuntz Riesling" → "Glas vin - Sybille Kuntz Riesling".
  · Modifier lines: "Pizza Margherita" + "extra ost" → "Pizza Margherita, extra ost".
  · Dietary / preparation variants on indented sub-lines belong to the parent line above — even when they carry a small surcharge. Merge their description into the parent and add their price to the parent's price, instead of emitting them as a separate item. Trigger words include: glutenfri / gluten-free / fara gluten / ohne Gluten / sans gluten / sin gluten / senza glutine, vegansk / vegan, vegetarisk / vegetarian / veggie, laktosfri / lactose-free / dairy-free / mjölkfri, ekologisk / organic, mild / spicy / hot, well-done / medium / rare, "extra X", "utan X" / "no X" / "fara X" (Romanian "without X") / "cu X" (Romanian "with X"), supliment / supplement / tillägg / surcharge / tillval / modificare. This rule also applies when the modifier line is NOT indented but starts with a POS modifier prefix such as "z " or "* " or a line number (these are codes some POS systems print to mark modifications to the preceding item). Example: "* Lafayette D *  165,00" with indented "1 x glutenfri  13,00" below → ONE item, description "Lafayette D, glutenfri", price 178,00. Example: "PIZZA REGINA  99,00" followed by "z supliment FARA GLUTEN  35,00" → ONE item, description "Pizza Regina, fara gluten", price 134,00. By contrast, indented side dishes and sauces with their own real prices ("Cajun", "Lemon-chive", "Sweet potato", "Fries", "Tryffel", "Cheddar") are NOT dietary variants — keep them as separate items.
  Output exactly one item per parent line. If you see N indented unpriced continuation lines, they belong to the priced line directly above — never emit them as separate items.
- DROP 0-price lines entirely: a printed item line with price 0 (free water "Vatten", complimentary bread, an included no-cost modifier like "vegetarisk" 0,00) is not a billable item. Do NOT emit it as an item at all — neither standalone nor merged.
- Second pass: after reading, review every description against your full knowledge of Swedish and Nordic restaurant menus and correct anything that doesn't read as a real item — covering dishes (löjrom, råraka, rostbiff, oxfilé, entrecôte, råbiff, gravlax, toast skagen, plankstek, raggmunk, ärtsoppa…), ingredients/garnishes (kantarell, svamp duxelle, rödbeta, hjortron, brioche, pastrami, matjessill, tryffel…), drinks, beers and wines incl. styles and producer/brewery/winery brands (helles, veteöl, IPA, pilsner, lager, vienna, pinot noir, riesling…), and common shorthand (40cl, "gl"=glas, "fl"=flaska, "st"=stycken, "/hg"=per hekto). Fix OCR slips and odd-looking words to the closest real Swedish/Nordic item — but only correct spelling, never swap in a different dish, and never invent anything not printed.
- "price" is the total charged for the WHOLE line in SEK — the number in the rightmost (total) column. For "2 Bryggkaffe 35,00 70,00" price is 70; for "3 Stor Lager 195,00" price is 195. "quantity" is the leading count of units on the line (default 1). Always read the line total, never the per-unit price, so the items add up to the receipt total.
- Read every price digit by digit and keep the digit count right — thermal receipts are faint and dropping a trailing zero (reading 1180 as 118, or 590 as 59) is a common mistake. Check each price carefully.
- For a multi-unit line, quantity × per-unit price should equal the line total — a quick sanity check on your own reading. Read the printed grand total ("Tot Kvitto", "Totalt", "Summa", or the amount after "SEK") carefully and accurately, but do NOT adjust item prices to make them add up to it — report exactly what each line shows, even if the lines don't sum to the printed total.
- "category": "drink" for any beverage, "dessert" for sweets/desserts after the meal, "starter" for an appetiser ("Förrätt", antipasti/tapas/meze, bruschetta, carpaccio, tartare, "räkcocktail", "toast skagen", a sharing platter/board served at the start), "food" for any main dish, "tip" for a gratuity / tip / service charge / dricks line that appears as a printed line item on the receipt (use "tip" here, set its price to the tip amount, AND also set the top-level "dricks" field to that amount), "other" if unclear. Items are Swedish — interpret common names (fralla=sandwich, läsk=soda, flankstek/ryggbiff=beef, regnbåge=fish, glögg=mulled wine) and note å/ä/ö may be written as a/o.
- Swedish prices already include moms (VAT); use the printed line prices as-is. Do not add or remove tax.
- Use a dot as the decimal separator in your JSON even though the receipt uses a comma.
- "total" = the itemised bill — the "Total", "Totalt", "Summa", or "Att betala" line, i.e. the sum of the ordered items. "moms" = VAT amount if printed, else null. "dricks" = tip if a tip line is printed, else null. Also: if the receipt has a pre-printed gratuity selection — rows like "10% ___ 15% (O) 20% ___" or "Tip: 10% / 15% / 18%" — and one option is visually marked (circled, checked, underlined, or otherwise distinguished from the others), compute dricks = round(selected_percentage × total / 100) and set it. This is common on US, Canadian, Romanian, and other receipts.
- "charged" = the amount actually paid, printed on a separate card/payment line BELOW the total — e.g. "MasterCard", "Mastercard Bankkort", "Bankkort", "Visa", "Kontokort", "Kortköp", "Köp", "Debiterat", "Betalt", or a terminal/slip total. Read it whenever such a line exists. It is often HIGHER than "total" because the guest rounded up or tipped at the terminal — so when you see e.g. "Total 2546,00" and below it "MasterCard Bankkort 2700,00", set total=2546 and charged=2700 (the 154 difference is the tip). null only if no payment line is shown; never copy "total" into "charged".
- Never output non-item rows as items: skip totals and metadata such as "Summa", "Total", "Att betala", "Moms"/"Varav moms", "Netto", "Kontant", "Växel", "Kort"/"Kortköp"/"Bankkort"/"Swish", "Dricks", "Avrundning", "Bord", "Servitör", "Org.nr", "Kvitto", "Terminal". Keep it concise — one object per ordered dish/drink line.
- POS receipts are UPPERCASE, faint, abbreviated and often truncated. Expand truncations to the full Swedish name ("BRAISERAD KALVKIN" → "Braiserad Kalvkind", "JANSSONS FREST" → "Janssons Frestelse", "WALLENB" → "Wallenbergare", "ESPR MARTINI" → "Espresso Martini", "NORRL GULD" → "Norrlands Guld"), and undo letter-shape errors: l/1/I, 0/O↔o/ö, rn→m, cl/d confusion, dropped é/ô (entrecote→Entrecôte, creme brulee→Crème Brûlée). A trailing size like "33cl", "40cl", "4cl", "gl", "fl" or "/hg" is part of a drink/by-weight line — keep the item name, not the size, in the description.`;
};

type AiResult = { response?: string; description?: string; choices?: { message?: { content?: string } }[] } | string;
type WorkersAI = { run: (model: string, inputs: Record<string, unknown>) => Promise<AiResult> };

function resultText(result: AiResult): string {
  if (typeof result === "string") return result;
  return result.response ?? result.description ?? result.choices?.[0]?.message?.content ?? "";
}

const USER_TEXT = "Extract the line items, total, moms and dricks from this receipt.";
const USER_TEXT_MULTI =
  "These are consecutive overlapping photo frames of ONE tall receipt, in order from the top of the receipt to the bottom. Each subsequent frame overlaps the previous one — sometimes by a lot. Read the receipt as a SINGLE document: every printed line appears in exactly one output item, even if it's visible in multiple frames. If the same line appears in frame N and frame N+1, emit it ONCE. Use the clearest copy of each line. Pay attention to multi-line items (a parent line with a continuation line below — merge them per the existing multi-line rules). Items must come out in the order they appear on the receipt (top → bottom across the whole stitched document).";

/**
 * Call Claude (Haiku) via the Messages API over plain fetch — no SDK, so it
 * runs in the Worker. Returns the model's text; throws on non-2xx so the caller
 * falls back to Workers AI. The system prompt carries a cache breakpoint (it
 * only takes effect once the prompt exceeds Claude's ~4k-token cache minimum).
 *
 * Accepts either one image or a sequence (panorama sweep). The multi-image
 * path uses a different user message asking the model to merge overlapping
 * frames into one ordered item list.
 */
async function runClaude(
  apiKey: string,
  images: { mediaType: string; base64: string }[],
  model: string,
  prompt: string,
): Promise<string> {
  const multi = images.length > 1;
  const userContent: Array<{ type: string; [k: string]: unknown }> = [];
  for (const img of images) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    });
  }
  userContent.push({ type: "text", text: multi ? USER_TEXT_MULTI : USER_TEXT });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: [{ type: "text", text: prompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

/**
 * Streaming variant of runClaude: same request with `stream: true`, parsing
 * the SSE frames and invoking `onText` with the accumulated text after each
 * delta so the route can emit live progress. Resolves to the full text.
 */
async function runClaudeStream(
  apiKey: string,
  images: { mediaType: string; base64: string }[],
  onText: (soFar: string) => void,
  model: string,
  prompt: string,
): Promise<string> {
  const multi = images.length > 1;
  const userContent: Array<{ type: string; [k: string]: unknown }> = [];
  for (const img of images) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    });
  }
  userContent.push({ type: "text", text: multi ? USER_TEXT_MULTI : USER_TEXT });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      system: [{ type: "text", text: prompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload) as { type?: string; delta?: { type?: string; text?: string } };
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
          text += evt.delta.text;
          onText(text);
        }
      } catch {
        /* ping / unknown frame */
      }
    }
  }
  return text;
}

/** Build the Gemini `contents` parts: every image inline, then the user
 *  instruction (single- or multi-frame). Shared by both Gemini paths. */
function geminiParts(
  images: { mediaType: string; base64: string }[],
  multi: boolean,
): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = images.map((img) => ({
    inline_data: { mime_type: img.mediaType, data: img.base64 },
  }));
  parts.push({ text: multi ? USER_TEXT_MULTI : USER_TEXT });
  return parts;
}

// responseMimeType forces raw JSON (no markdown fences). No thinkingConfig
// override: each model uses its default reasoning (3.x models think by
// default, which should fix the price-column misalignment 2.5 Flash-Lite
// showed with thinking off). Output is generous so thinking tokens plus a
// long receipt never truncate the JSON and skew the comparison.
const GEMINI_GEN_CONFIG = {
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const geminiBody = (
  images: { mediaType: string; base64: string }[],
  prompt: string,
): string =>
  JSON.stringify({
    system_instruction: { parts: [{ text: prompt }] },
    contents: [{ role: "user", parts: geminiParts(images, images.length > 1) }],
    generationConfig: GEMINI_GEN_CONFIG,
  });

/** Non-streaming Gemini call — mirrors runClaude. Tries each candidate id in
 *  turn, skipping ones the API doesn't recognise (404), so a -preview rename
 *  doesn't fail the scan. Throws on other non-2xx so the caller falls back
 *  to Workers AI. */
async function runGemini(
  apiKey: string,
  images: { mediaType: string; base64: string }[],
  models: string[],
  prompt: string,
): Promise<string> {
  const body = geminiBody(images, prompt);
  let lastErr = "gemini: no candidate resolved";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body,
      },
    );
    if (res.status === 404) {
      lastErr = `gemini ${model}:404`;
      continue;
    }
    if (!res.ok) {
      throw new Error(`gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  }
  throw new Error(lastErr);
}

/** Streaming variant of runGemini — parses the `?alt=sse` frames and calls
 *  onText with the accumulated text after each chunk. Tries each candidate
 *  id (skipping 404s) before streaming. Resolves to the full text. Same
 *  shape as runClaudeStream so the streaming route is agnostic. */
async function runGeminiStream(
  apiKey: string,
  images: { mediaType: string; base64: string }[],
  onText: (soFar: string) => void,
  models: string[],
  prompt: string,
): Promise<string> {
  const body = geminiBody(images, prompt);
  let res: Response | null = null;
  let lastErr = "gemini: no candidate resolved";
  for (const model of models) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body,
      },
    );
    if (r.status === 404) {
      lastErr = `gemini ${model}:404`;
      continue;
    }
    if (!r.ok || !r.body) {
      throw new Error(`gemini ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}`);
    }
    res = r;
    break;
  }
  if (!res || !res.body) throw new Error(lastErr);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const evt = JSON.parse(payload) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const chunk = (evt.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
        if (chunk) {
          text += chunk;
          onText(text);
        }
      } catch {
        /* keep-alive / unknown frame */
      }
    }
  }
  return text;
}

/** The complete item objects the (partial) model output contains so far —
 *  drives the live "N lines found" counter and the per-item emoji pops
 *  while the model reads. Items are flat objects, so brace-free matching
 *  finds exactly the finished ones. */
function streamedItems(text: string): string[] {
  return text.match(/\{[^{}]*"description"[^{}]*\}/g) ?? [];
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Pull line items + totals out of the model's text. Tolerant of imperfect
 * output: strips code fences and trailing commas, and if the JSON won't parse
 * (e.g. the model truncated mid-array) it salvages every complete item object
 * by regex so a cut-off response still yields usable rows.
 */
function extractJson(text: string): OcrResult {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);
  const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");

  let parsed:
    | {
        items?: unknown;
        total?: unknown;
        moms?: unknown;
        dricks?: unknown;
        charged?: unknown;
        place?: unknown;
        date?: unknown;
        currency?: unknown;
        country?: unknown;
      }
    | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const cur = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : null);
  const ctry = (v: unknown) => (typeof v === "string" && /^[A-Za-z]{2}$/.test(v.trim()) ? v.trim().toUpperCase() : null);

  if (parsed && Array.isArray(parsed.items)) {
    const items: OcrResult["items"] = [];
    for (const it of parsed.items as {
      description?: unknown;
      price?: unknown;
      category?: unknown;
      emoji?: unknown;
      quantity?: unknown;
      y?: unknown;
      translation?: unknown;
    }[]) {
      const description = String(it?.description ?? "").trim();
      const price = Number(it?.price);
      if (!description || !Number.isFinite(price)) continue;
      // Drop 0-price lines (free water, complimentary modifier). The
      // prompt asks the model to skip these but enforce it here too so
      // a stray "Vatten 0,00" never makes it into the items list.
      if (price === 0) continue;
      const category = typeof it?.category === "string" ? it.category : undefined;
      const emoji = typeof it?.emoji === "string" ? it.emoji : undefined;
      const y = Number.isFinite(Number(it?.y)) ? Number(it?.y) : undefined;
      const translation = typeof it?.translation === "string" && it.translation.trim() ? it.translation.trim() : undefined;
      const qty = Math.max(1, Math.min(20, Math.round(Number(it?.quantity)) || 1));
      // price is the line total; split it into one row per unit so each can be
      // claimed separately, while the rows still sum back to the line total.
      for (const partOre of splitOre(Math.round(price * 100), qty)) {
        items.push({ description, price: partOre / 100, category, emoji, y, translation });
      }
    }
    return {
      items,
      total: num(parsed.total),
      moms: num(parsed.moms),
      dricks: num(parsed.dricks),
      charged: num(parsed.charged),
      place: str(parsed.place),
      date: str(parsed.date),
      currency: cur(parsed.currency),
      country: ctry(parsed.country),
    };
  }

  // Salvage: extract every complete {...} object that has description + price.
  const items: OcrResult["items"] = [];
  for (const obj of text.match(/\{[^{}]*\}/g) ?? []) {
    const d = obj.match(/"description"\s*:\s*"([^"]*)"/);
    const p = obj.match(/"price"\s*:\s*(-?\d+(?:\.\d+)?)/);
    const c = obj.match(/"category"\s*:\s*"([^"]*)"/);
    const em = obj.match(/"emoji"\s*:\s*"([^"]*)"/);
    const q = obj.match(/"quantity"\s*:\s*(\d+)/);
    const ym = obj.match(/"y"\s*:\s*(\d+(?:\.\d+)?)/);
    const tr = obj.match(/"translation"\s*:\s*"([^"]*)"/);
    if (d && p) {
      const priceNum = Number(p[1]);
      if (priceNum === 0) continue;
      const qty = Math.max(1, Math.min(20, q ? Number(q[1]) : 1));
      const y = ym ? Number(ym[1]) : undefined;
      const translation = tr && tr[1].trim() ? tr[1].trim() : undefined;
      for (const partOre of splitOre(Math.round(priceNum * 100), qty)) {
        items.push({ description: d[1].trim(), price: partOre / 100, category: c?.[1], emoji: em?.[1], y, translation });
      }
    }
  }
  const grab = (k: string) => {
    const m = text.match(new RegExp(`"${k}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
    return m ? Number(m[1]) : null;
  };
  const grabStr = (k: string) => {
    const m = text.match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`));
    return m && m[1].trim() ? m[1].trim() : null;
  };
  return {
    items,
    total: grab("total"),
    moms: grab("moms"),
    dricks: grab("dricks"),
    charged: grab("charged"),
    place: grabStr("place"),
    date: grabStr("date"),
    currency: cur(grabStr("currency")),
    country: ctry(grabStr("country")),
  };
}

/** Multiply every monetary field by the SEK rate, leaving the rest untouched. */
function toSek(r: OcrResult, rate: number): OcrResult {
  const c = (v: number | null) => (v == null ? null : v * rate);
  return {
    ...r,
    items: r.items.map((it) => ({ ...it, price: it.price * rate })),
    total: c(r.total),
    moms: c(r.moms),
    dricks: c(r.dricks),
    charged: c(r.charged),
  };
}

/**
 * Wrap a parsed result with currency info, converting amounts to SEK when the
 * receipt is foreign so the rest of the app (and Swish) can work in kronor.
 */
async function withCurrency(parsed: OcrResult): Promise<Record<string, unknown>> {
  const currency = parsed.currency ?? "SEK";
  if (currency === "SEK") {
    return { ...parsed, currency: "SEK", rate: 1, rateApprox: false, rateDate: null };
  }
  // Use the rate from the receipt's own date (what the diners actually paid).
  const fx = await fetchRateToSek(currency, parsed.date);
  if (!fx) {
    // No rate available: keep native amounts and let the UI warn + offer manual fix.
    return { ...parsed, currency, rate: null, rateApprox: false, rateDate: null };
  }
  return { ...toSek(parsed, fx.rate), currency, rate: fx.rate, rateApprox: fx.approx, rateDate: fx.date ?? null };
}

export async function POST(req: Request) {
  let body: { image?: string; images?: string[]; model?: string; emoji?: boolean; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const requested = typeof body.model === "string" ? body.model : "";
  const isGemini = GEMINI_MODELS.has(requested);
  const claudeModel = CLAUDE_MODELS.has(requested) ? requested : ANTHROPIC_MODEL;
  const geminiModel = isGemini ? requested : GEMINI_MODEL;
  // Translate into the app's language — and only when an item isn't already
  // in it (the model returns null otherwise), so a Swedish user reading a
  // Swedish receipt pays nothing, while a foreign receipt gets translated
  // into their language. Falls back to English if the lang is unknown.
  const translateTo = typeof body.lang === "string" ? LANG_NAME[body.lang] ?? "English" : "English";
  // Nordic diners read English fine, so an English receipt shouldn't be
  // translated into a Nordic app language — treat English as already-known.
  const NORDIC = new Set(["sv", "da", "no", "fi"]);
  const alsoKnown = typeof body.lang === "string" && NORDIC.has(body.lang) ? ["English"] : [];
  const prompt = buildPrompt({ emoji: body.emoji !== false, translateTo, alsoKnown });

  // Accept either `image` (single dataURL) or `images` (panorama frames in
  // order, top → bottom). Validate every input is a base64 dataURL.
  const rawUrls: string[] = Array.isArray(body.images) && body.images.length > 0
    ? body.images
    : typeof body.image === "string" ? [body.image] : [];
  if (rawUrls.length === 0) {
    return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  }
  const parsed = rawUrls.map((u) => u.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i));
  if (parsed.some((m) => !m)) {
    return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  }
  const matches = parsed as RegExpMatchArray[];
  // For Workers AI fallback we use the first image only (those models don't
  // accept image arrays); Claude handles the whole sequence.
  const primary = matches[0];
  const dataUrl = rawUrls[0];
  const bytes = Uint8Array.from(Buffer.from(primary[2], "base64"));

  let ai: WorkersAI | undefined;
  let anthropicKey: string | undefined;
  let geminiKey: string | undefined;
  try {
    const { env } = getCloudflareContext();
    const e = env as unknown as { AI?: WorkersAI; ANTHROPIC_API_KEY?: string; GEMINI_API_KEY?: string };
    ai = e.AI;
    anthropicKey = e.ANTHROPIC_API_KEY;
    geminiKey = e.GEMINI_API_KEY;
  } catch {
    // Not running inside the Cloudflare runtime (e.g. plain `next start`).
  }

  // The primary reader is the model the client selected — Claude by
  // default, Gemini when a gemini-* id is requested and a key is set.
  // Both stream and share the extractJson contract; Workers AI models
  // are the keyless fallback. If Gemini is asked for but unkeyed, fall
  // back to Claude so the request still succeeds.
  const images = matches.map((m) => ({ mediaType: m[1], base64: m[2] }));
  let primaryAttempt:
    | { name: string; run: () => Promise<string>; stream: (onText: (soFar: string) => void) => Promise<string> }
    | null = null;
  if (isGemini && geminiKey) {
    const key = geminiKey;
    const candidates = geminiCandidates(geminiModel);
    primaryAttempt = {
      name: geminiModel,
      run: () => runGemini(key, images, candidates, prompt),
      stream: (onText) => runGeminiStream(key, images, onText, candidates, prompt),
    };
  } else if (anthropicKey) {
    const key = anthropicKey;
    primaryAttempt = {
      name: claudeModel,
      run: () => runClaude(key, images, claudeModel, prompt),
      stream: (onText) => runClaudeStream(key, images, onText, claudeModel, prompt),
    };
  }

  const attempts: { name: string; run: () => Promise<AiResult> }[] = [];

  if (primaryAttempt) {
    attempts.push({ name: primaryAttempt.name, run: primaryAttempt.run });
  }

  if (ai) {
    const client = ai;
    const visionMessages = [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          { type: "text", text: USER_TEXT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];
    attempts.push(
      { name: "llama4", run: () => client.run(LLAMA4_MODEL, { max_tokens: 2048, messages: visionMessages }) },
      { name: "mistral", run: () => client.run(MISTRAL_MODEL, { max_tokens: 2048, messages: visionMessages }) },
      { name: "llava", run: () => client.run(LLAVA_MODEL, { prompt: `${prompt}\n\n${USER_TEXT}`, image: Array.from(bytes), max_tokens: 2048 }) },
    );
  }

  if (attempts.length === 0) {
    return NextResponse.json(
      { error: "OCR isn't available here. Enter items manually." },
      { status: 503 },
    );
  }

  // Streaming path: when the client opts in via Accept, stream the read
  // live — a progress event per completed line item, then the final
  // result. The Workers AI fallbacks still run (non-streaming) inside the
  // same response if Claude fails, so the contract is: 0+ progress
  // events, then exactly one result or error. SSE is preferred — it's
  // the one content type every hop (Cloudflare, proxies, browsers)
  // treats as strictly unbuffered; x-ndjson is kept for one-deploy-old
  // clients.
  const accept = req.headers.get("accept") ?? "";
  const wantsSse = accept.includes("text/event-stream");
  const wantsNdjson = accept.includes("application/x-ndjson");
  if ((wantsSse || wantsNdjson) && primaryAttempt) {
    const chosen = primaryAttempt;
    const fallbacks = attempts.filter((a) => a.name !== chosen.name);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => {
          try {
            const json = JSON.stringify(obj);
            controller.enqueue(encoder.encode(wantsSse ? `data: ${json}\n\n` : `${json}\n`));
          } catch {
            /* client went away mid-stream */
          }
        };
        // Flush an immediate no-op frame so headers + first byte leave
        // right away — some layers hold the response until first write.
        send({ progress: { count: 0 } });
        const diag: string[] = [];
        try {
          let lastCount = 0;
          const text = await chosen.stream((soFar) => {
            const found = streamedItems(soFar);
            if (found.length > lastCount) {
              lastCount = found.length;
              // Ship the just-finished item's display fields with the tick
              // so the client can pop its emoji on the photo.
              let item: { description?: string; emoji?: string; category?: string } | undefined;
              try {
                const it = JSON.parse(found[found.length - 1]) as Record<string, unknown>;
                item = {
                  description: typeof it.description === "string" ? it.description : undefined,
                  emoji: typeof it.emoji === "string" ? it.emoji : undefined,
                  category: typeof it.category === "string" ? it.category : undefined,
                };
              } catch {
                /* odd escaping — the count still ticks */
              }
              send({ progress: { count: lastCount, item } });
            }
          });
          const parsed = extractJson(text);
          if (parsed.items.length > 0 || parsed.total !== null) {
            send({ result: await withCurrency(parsed), model: chosen.name });
            controller.close();
            return;
          }
          diag.push(`${chosen.name}:no-items`);
        } catch (err) {
          diag.push(`${chosen.name}:${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`);
        }
        for (const { name, run } of fallbacks) {
          try {
            const text = resultText(await run());
            if (!text.trim()) {
              diag.push(`${name}:empty`);
              continue;
            }
            const parsed = extractJson(text);
            if (parsed.items.length > 0 || parsed.total !== null) {
              send({ result: await withCurrency(parsed), model: name });
              controller.close();
              return;
            }
            diag.push(`${name}:no-items`);
          } catch (err) {
            diag.push(`${name}:${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`);
          }
        }
        send({ error: `Couldn't read the receipt. ${diag.join(" | ")}` });
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": wantsSse ? "text/event-stream; charset=utf-8" : "application/x-ndjson",
        // no-transform stops intermediary compression from re-buffering
        // the stream; X-Accel-Buffering covers nginx-style proxies.
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const diag: string[] = [];
  for (const { name, run } of attempts) {
    try {
      const text = resultText(await run());
      if (!text.trim()) {
        diag.push(`${name}:empty`);
        continue;
      }
      const parsed = extractJson(text);
      if (parsed.items.length > 0 || parsed.total !== null) {
        return NextResponse.json(await withCurrency(parsed), { headers: { "X-Ocr-Model": name } });
      }
      diag.push(`${name}:no-items`);
    } catch (err) {
      diag.push(`${name}:${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`);
    }
  }
  return NextResponse.json({ error: `Couldn't read the receipt. ${diag.join(" | ")}` }, { status: 502 });
}
