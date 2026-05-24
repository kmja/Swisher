import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vision OCR on Cloudflare Workers AI — keyless, via the `AI` binding.
// Both models are EU-safe (Meta's Llama 3.2 vision is license-restricted
// from the EU, so it is deliberately not used). Mistral Small 3.1 is the
// stronger reader; LLaVA is the resilient fallback if Mistral is
// unavailable or returns nothing usable.
const MISTRAL_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const LLAVA_MODEL = "@cf/llava-hf/llava-1.5-7b-hf";

const PROMPT = `You read a photographed Swedish restaurant receipt (kvitto). Return ONLY a JSON object — no markdown, no commentary — exactly matching:
{"items":[{"description":string,"price":number,"shared":boolean}],"total":number|null,"moms":number|null,"dricks":number|null}

Rules:
- "items" are the ordered dishes/drinks: a short description and the line price in SEK as a number (e.g. 185.50). Multiply by quantity when a line shows "2 x 95".
- "shared": true when the line is likely shared by the table — bottles/carafes of wine, pitchers, large platters, sides "att dela"/"to share", a shared starter. Otherwise false.
- Swedish prices already include moms (VAT); use the printed line prices as-is. Do not add or remove tax.
- Use a dot as the decimal separator in your JSON even though the receipt uses a comma.
- "total" = the amount to pay ("Att betala", "Totalt", "Summa"), else null. "moms" = VAT amount if printed, else null. "dricks" = tip if printed, else null.
- Never include subtotal/total/moms/tip lines inside "items".`;

type AiResult = { response?: string; description?: string; choices?: { message?: { content?: string } }[] } | string;
type WorkersAI = { run: (model: string, inputs: Record<string, unknown>) => Promise<AiResult> };

function resultText(result: AiResult): string {
  if (typeof result === "string") return result;
  return result.response ?? result.description ?? result.choices?.[0]?.message?.content ?? "";
}

const USER_TEXT = "Extract the line items, total, moms and dricks from this receipt.";

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
        .map((it: { description?: unknown; price?: unknown; shared?: unknown }) => ({
          description: String(it?.description ?? "").trim(),
          price: Number(it?.price),
          shared: it?.shared === true,
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

  // Mistral (chat + image) first, then LLaVA (image bytes) as a fallback.
  const attempts: (() => Promise<AiResult>)[] = [
    () =>
      ai.run(MISTRAL_MODEL, {
        max_tokens: 1024,
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
    () => ai.run(LLAVA_MODEL, { prompt: `${PROMPT}\n\n${USER_TEXT}`, image: Array.from(bytes), max_tokens: 1024 }),
  ];

  let lastError = "OCR failed.";
  for (const attempt of attempts) {
    try {
      const text = resultText(await attempt());
      if (!text.trim()) {
        lastError = "Empty response from the vision model.";
        continue;
      }
      const parsed = extractJson(text);
      if (parsed.items.length === 0 && parsed.total === null) {
        lastError = "The model couldn't read this receipt.";
        continue;
      }
      return NextResponse.json(parsed);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "OCR failed.";
    }
  }
  return NextResponse.json({ error: lastError }, { status: 502 });
}
