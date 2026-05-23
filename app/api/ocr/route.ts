import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.OCR_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You read photographed Swedish restaurant receipts (kvitto) and return ONLY structured JSON.

Rules:
- Output JSON exactly matching: {"items":[{"description":string,"price":number}],"total":number|null,"moms":number|null,"dricks":number|null}
- "items" are the ordered line items: a short description and the line price in SEK as a number (e.g. 185.50). Multiply by quantity if a line shows "2 x 95".
- Swedish receipts are VAT-inclusive: prices already include moms. Use the printed line prices as-is. Do NOT add or remove tax.
- Use a dot as the decimal separator in your JSON output even though the receipt uses a comma.
- "total" = the amount to pay (look for "Att betala", "Totalt", "Summa"). null if unreadable.
- "moms" = the VAT amount if printed, else null. "dricks" = tip if printed, else null.
- Skip subtotal/total/moms/dricks lines from "items"; they are not orderable dishes.
- Output ONLY the JSON object, no markdown fences, no commentary.`;

function extractJson(text: string): OcrResult {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((it: { description?: unknown; price?: unknown }) => ({
          description: String(it?.description ?? "").trim(),
          price: Number(it?.price),
        }))
        .filter((it: { description: string; price: number }) => it.description && Number.isFinite(it.price))
    : [];

  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    items,
    total: num(parsed.total),
    moms: num(parsed.moms),
    dricks: num(parsed.dricks),
  };
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OCR is not configured. Set ANTHROPIC_API_KEY or enter items manually." },
      { status: 503 },
    );
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const dataUrl = body.image;
  const match = typeof dataUrl === "string" && dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  const base64 = match[2];

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extract the line items, total, moms and dricks from this receipt." },
          ],
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const result = extractJson(text);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
