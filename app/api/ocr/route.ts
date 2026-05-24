import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vision OCR on Cloudflare Workers AI — keyless, via the `AI` binding.
// Both models are EU-safe (Meta's Llama 3.2 vision is license-restricted
// from the EU, so it is deliberately not used). Mistral Small 3.1 is the
// stronger reader; LLaVA is the resilient fallback.
const MISTRAL_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const LLAVA_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

const PROMPT = `You read a photographed Swedish restaurant receipt (kvitto). Return ONLY a JSON object — no markdown, no commentary — exactly matching:
{"items":[{"description":string,"price":number,"quantity":number,"shared":boolean,"category":"food"|"drink"|"dessert"|"other","y":number}],"total":number|null,"moms":number|null,"dricks":number|null,"place":string|null,"date":string|null}

Rules:
- "place" is the restaurant/café name, usually printed at the top. null if unclear.
- "date" is the receipt date as "YYYY-MM-DD" (convert formats like "16jan17" → "2017-01-16"). null if unreadable.
- "y" is the vertical position of this item's line on the receipt image as a percent from the top (0 = very top edge, 100 = very bottom edge). Estimate it as accurately as you can.
- "items" are the ordered dishes/drinks: a short description and the price.
- Clean up each description into the real menu item. Receipts are often misread or abbreviated, so correct obvious OCR errors and misspellings to the word that was clearly intended — fix dropped, swapped or wrong letters (e.g. "ryggkaffe" → "Bryggkaffe", "entrecöte"/"entrecote" → "Entrecôte", "vamkorv" → "Varmkorv", "ceasarsallad" → "Caesarsallad") and use normal capitalisation, not ALL CAPS.
- When a line names a brand or product, keep that real brand name as printed instead of forcing a generic word (e.g. "Coca-Cola", "Ramlösa", "Pågen", "Brooklyn Lager", "Heinz"). Never invent a brand that isn't there, and never rewrite a genuine brand into a plain word.
- "price" is the price for ONE item (per unit) in SEK as a number, e.g. 95. "quantity" is how many were ordered on that line; default 1. So a line "2 x 95" or "2 Öl 190,00" is {"price":95,"quantity":2} — NOT price 190.
- "shared": true when the line is likely shared by the table — bottles/carafes of wine, pitchers, large platters, sides "att dela"/"to share", a shared starter. Otherwise false.
- "category": "drink" for any beverage, "dessert" for sweets/desserts, "food" for any other dish, "other" if unclear. Items are Swedish — interpret common names (fralla=sandwich, läsk=soda, flankstek/ryggbiff=beef, regnbåge=fish, glögg=mulled wine) and note å/ä/ö may be written as a/o.
- Swedish prices already include moms (VAT); use the printed line prices as-is. Do not add or remove tax.
- Use a dot as the decimal separator in your JSON even though the receipt uses a comma.
- "total" = the amount to pay ("Att betala", "Totalt", "Summa"), else null. "moms" = VAT amount if printed, else null. "dricks" = tip if printed, else null.
- Never include subtotal/total/moms/tip lines inside "items". Keep it concise — one object per ordered line.`;

type AiResult = { response?: string; description?: string; choices?: { message?: { content?: string } }[] } | string;
type WorkersAI = { run: (model: string, inputs: Record<string, unknown>) => Promise<AiResult> };

function resultText(result: AiResult): string {
  if (typeof result === "string") return result;
  return result.response ?? result.description ?? result.choices?.[0]?.message?.content ?? "";
}

const USER_TEXT = "Extract the line items, total, moms and dricks from this receipt.";

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
    | { items?: unknown; total?: unknown; moms?: unknown; dricks?: unknown; place?: unknown; date?: unknown }
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
      quantity?: unknown;
      y?: unknown;
    }[]) {
      const description = String(it?.description ?? "").trim();
      const price = Number(it?.price);
      if (!description || !Number.isFinite(price)) continue;
      const shared = it?.shared === true;
      const category = typeof it?.category === "string" ? it.category : undefined;
      const y = Number.isFinite(Number(it?.y)) ? Number(it?.y) : undefined;
      const qty = Math.max(1, Math.min(20, Math.round(Number(it?.quantity)) || 1));
      for (let i = 0; i < qty; i++) items.push({ description, price, shared, category, y });
    }
    return {
      items,
      total: num(parsed.total),
      moms: num(parsed.moms),
      dricks: num(parsed.dricks),
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
    const q = obj.match(/"quantity"\s*:\s*(\d+)/);
    const ym = obj.match(/"y"\s*:\s*(\d+(?:\.\d+)?)/);
    if (d && p) {
      const qty = Math.max(1, Math.min(20, q ? Number(q[1]) : 1));
      for (let i = 0; i < qty; i++) {
        items.push({
          description: d[1].trim(),
          price: Number(p[1]),
          shared: /"shared"\s*:\s*true/.test(obj),
          category: c?.[1],
          y: ym ? Number(ym[1]) : undefined,
        });
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
  try {
    const { env } = getCloudflareContext();
    ai = (env as unknown as { AI?: WorkersAI }).AI;
  } catch {
    // Not running inside the Cloudflare runtime (e.g. plain `next start`).
  }
  if (!ai) {
    return NextResponse.json(
      { error: "OCR runs on Cloudflare Workers AI and isn't available here. Enter items manually." },
      { status: 503 },
    );
  }
  const client = ai;

  const attempts: { name: string; run: () => Promise<AiResult> }[] = [
    {
      name: "mistral",
      run: () =>
        client.run(MISTRAL_MODEL, {
          max_tokens: 2048,
          messages: [
            { role: "system", content: PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: USER_TEXT },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
    },
    {
      name: "llava",
      run: () => client.run(LLAVA_MODEL, { prompt: `${PROMPT}\n\n${USER_TEXT}`, image: Array.from(bytes), max_tokens: 2048 }),
    },
  ];

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
