import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { splitOre } from "@/lib/money";
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

const PROMPT = `You read a photographed Swedish restaurant receipt (kvitto). Return ONLY a JSON object — no markdown, no commentary — exactly matching:
{"items":[{"description":string,"price":number,"quantity":number,"shared":boolean,"category":"food"|"drink"|"dessert"|"other","emoji":string,"y":number}],"total":number|null,"moms":number|null,"dricks":number|null,"charged":number|null,"place":string|null,"date":string|null}

Rules:
- "place" is the restaurant/café name, usually printed at the top. null if unclear.
- "date" is the receipt date as "YYYY-MM-DD" (convert formats like "16jan17" → "2017-01-16"). null if unreadable.
- "y" is the vertical position of this item's line on the receipt image as a percent from the top (0 = very top edge, 100 = very bottom edge). Estimate it as accurately as you can.
- "items" are the ordered dishes/drinks: a short description and the price.
- The description is the item NAME only. Strip the leading quantity (it goes in "quantity"): "2 glas Sybille Kuntz" → description "Glas Sybille Kuntz", quantity 2; "3 Kaffe" → "Kaffe", quantity 3.
- Spell each item the correct Swedish way: restore å/ä/ö and fix OCR letter slips so a recognisable dish/drink reads properly — e.g. "lansorts lage" → "Landsorts Lager", "rakor" → "räkor", "rört majonäs" → "Rökt majonnäs", "fläskkar" → "Fläskkarré", "marängsvisst" → "Marängsviss", "kalvkinn" → "Kalvkind", "fårslök" → "Färsklök", "gstron" → "Ostron", "entrecote" → "Entrecôte" — and use normal capitalisation, not ALL CAPS.
- "emoji" is one emoji that best represents the item, using your knowledge of brands and types: a wine — including brands like "Sybille Kuntz" or "O'scuru" — is 🍷; a beer is 🍺; Coca-Cola/soda is 🥤; coffee is ☕; oysters are 🦪; pork/meat is 🥩. Pick the most specific food or drink emoji you can.
- Crucially, keep it the SAME item — only correct its spelling, never swap an unclear word for a different, more plausible-sounding dish. If you genuinely cannot tell what a word is, transcribe it literally letter by letter rather than guessing. Never invent items, lines, or prices that are not printed on the receipt.
- When a line names a brand or product, keep that real brand name as printed instead of forcing a generic word (e.g. "Coca-Cola", "Ramlösa", "Pågen", "Brooklyn Lager", "Heinz"). Never invent a brand that isn't there, and never rewrite a genuine brand into a plain word.
- "price" is the total charged for the WHOLE line in SEK — the number in the rightmost (total) column. For "2 Bryggkaffe 35,00 70,00" price is 70; for "3 Stor Lager 195,00" price is 195. "quantity" is the leading count of units on the line (default 1). Always read the line total, never the per-unit price, so the items add up to the receipt total.
- Read every price digit by digit and keep the digit count right — thermal receipts are faint and dropping a trailing zero (reading 1180 as 118, or 590 as 59) is a common mistake. Check each price carefully.
- For a multi-unit line, quantity × per-unit price should equal the line total — a quick sanity check on your own reading. Read the printed grand total ("Tot Kvitto", "Totalt", "Summa", or the amount after "SEK") carefully and accurately, but do NOT adjust item prices to make them add up to it — report exactly what each line shows, even if the lines don't sum to the printed total.
- "shared": true ONLY when a line is clearly meant for the whole table to split — a whole bottle or carafe of wine, a pitcher, a large platter, or a side/starter explicitly marked "att dela"/"to share". Individual servings are NOT shared: a beer, a glass of wine, a coffee, or one person's dish is false even when it is a large ("stor") size. When unsure, use false.
- "category": "drink" for any beverage, "dessert" for sweets/desserts, "food" for any other dish, "other" if unclear. Items are Swedish — interpret common names (fralla=sandwich, läsk=soda, flankstek/ryggbiff=beef, regnbåge=fish, glögg=mulled wine) and note å/ä/ö may be written as a/o.
- Swedish prices already include moms (VAT); use the printed line prices as-is. Do not add or remove tax.
- Use a dot as the decimal separator in your JSON even though the receipt uses a comma.
- "total" = the itemised bill, i.e. the sum of the ordered items ("Att betala", "Totalt", "Summa"), else null. "moms" = VAT amount if printed, else null. "dricks" = tip if a tip line is printed, else null.
- "charged" = the amount actually paid at the bottom — a card/payment line such as "Mastercard", "Kontokort", "Kortköp", "Köp", "Debiterat", "Betalt", or "Slip"/terminal total. It may be HIGHER than "total" when the guest rounded up or tipped. null if no payment line is shown. Do not copy "total" into "charged" unless a real payment line shows that amount.
- Never include subtotal/total/moms/tip lines inside "items". Keep it concise — one object per ordered line.`;

type AiResult = { response?: string; description?: string; choices?: { message?: { content?: string } }[] } | string;
type WorkersAI = { run: (model: string, inputs: Record<string, unknown>) => Promise<AiResult> };

function resultText(result: AiResult): string {
  if (typeof result === "string") return result;
  return result.response ?? result.description ?? result.choices?.[0]?.message?.content ?? "";
}

const USER_TEXT = "Extract the line items, total, moms and dricks from this receipt.";

/**
 * Call Claude (Haiku) via the Messages API over plain fetch — no SDK, so it
 * runs in the Worker. Returns the model's text; throws on non-2xx so the caller
 * falls back to Workers AI. The system prompt carries a cache breakpoint (it
 * only takes effect once the prompt exceeds Claude's ~4k-token cache minimum).
 */
async function runClaude(apiKey: string, mediaType: string, base64: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: USER_TEXT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`anthropic ${res.status}: ${(await res.text().catch(() => "")).slice(0, 120)}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
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
    | { items?: unknown; total?: unknown; moms?: unknown; dricks?: unknown; charged?: unknown; place?: unknown; date?: unknown }
    | null = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = null;
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  if (parsed && Array.isArray(parsed.items)) {
    const items: OcrResult["items"] = [];
    for (const it of parsed.items as {
      description?: unknown;
      price?: unknown;
      shared?: unknown;
      category?: unknown;
      emoji?: unknown;
      quantity?: unknown;
      y?: unknown;
    }[]) {
      const description = String(it?.description ?? "").trim();
      const price = Number(it?.price);
      if (!description || !Number.isFinite(price)) continue;
      const shared = it?.shared === true;
      const category = typeof it?.category === "string" ? it.category : undefined;
      const emoji = typeof it?.emoji === "string" ? it.emoji : undefined;
      const y = Number.isFinite(Number(it?.y)) ? Number(it?.y) : undefined;
      const qty = Math.max(1, Math.min(20, Math.round(Number(it?.quantity)) || 1));
      // price is the line total; split it into one row per unit so each can be
      // claimed separately, while the rows still sum back to the line total.
      for (const partOre of splitOre(Math.round(price * 100), qty)) {
        items.push({ description, price: partOre / 100, shared, category, emoji, y });
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
    if (d && p) {
      const qty = Math.max(1, Math.min(20, q ? Number(q[1]) : 1));
      const shared = /"shared"\s*:\s*true/.test(obj);
      const y = ym ? Number(ym[1]) : undefined;
      for (const partOre of splitOre(Math.round(Number(p[1]) * 100), qty)) {
        items.push({ description: d[1].trim(), price: partOre / 100, shared, category: c?.[1], emoji: em?.[1], y });
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
  };
}

export async function POST(req: Request) {
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const match = typeof body.image === "string" && body.image.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  }
  const dataUrl = body.image as string;
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));

  let ai: WorkersAI | undefined;
  let anthropicKey: string | undefined;
  try {
    const { env } = getCloudflareContext();
    const e = env as unknown as { AI?: WorkersAI; ANTHROPIC_API_KEY?: string };
    ai = e.AI;
    anthropicKey = e.ANTHROPIC_API_KEY;
  } catch {
    // Not running inside the Cloudflare runtime (e.g. plain `next start`).
  }

  const attempts: { name: string; run: () => Promise<AiResult> }[] = [];

  if (anthropicKey) {
    const key = anthropicKey;
    attempts.push({ name: ANTHROPIC_MODEL, run: () => runClaude(key, match[1], match[2]) });
  }

  if (ai) {
    const client = ai;
    const visionMessages = [
      { role: "system", content: PROMPT },
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
      { name: "llava", run: () => client.run(LLAVA_MODEL, { prompt: `${PROMPT}\n\n${USER_TEXT}`, image: Array.from(bytes), max_tokens: 2048 }) },
    );
  }

  if (attempts.length === 0) {
    return NextResponse.json(
      { error: "OCR isn't available here. Enter items manually." },
      { status: 503 },
    );
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
        return NextResponse.json(parsed, { headers: { "X-Ocr-Model": name } });
      }
      diag.push(`${name}:no-items`);
    } catch (err) {
      diag.push(`${name}:${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`);
    }
  }
  return NextResponse.json({ error: `Couldn't read the receipt. ${diag.join(" | ")}` }, { status: 502 });
}
