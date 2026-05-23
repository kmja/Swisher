import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import type { OcrResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vision model on Cloudflare Workers AI. Keyless — billed against the
// account's free daily Neuron allocation via the `AI` binding.
const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";

const PROMPT = `You read a photographed Swedish restaurant receipt (kvitto). Return ONLY a JSON object — no markdown, no commentary — exactly matching:
{"items":[{"description":string,"price":number}],"total":number|null,"moms":number|null,"dricks":number|null}

Rules:
- "items" are the ordered dishes/drinks: a short description and the line price in SEK as a number (e.g. 185.50). Multiply by quantity when a line shows "2 x 95".
- Swedish prices already include moms (VAT); use the printed line prices as-is. Do not add or remove tax.
- Use a dot as the decimal separator in your JSON even though the receipt uses a comma.
- "total" = the amount to pay ("Att betala", "Totalt", "Summa"), else null. "moms" = VAT amount if printed, else null. "dricks" = tip if printed, else null.
- Never include subtotal/total/moms/tip lines inside "items".`;

type WorkersAI = {
  run: (
    model: string,
    inputs: Record<string, unknown>,
  ) => Promise<{ response?: string; description?: string } | string>;
};

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
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const dataUrl = body.image;
  const match = typeof dataUrl === "string" && dataUrl.match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Expected a base64 image data URL." }, { status: 400 });
  }
  const bytes = Uint8Array.from(Buffer.from(match[1], "base64"));

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

  try {
    const result = await ai.run(MODEL, {
      prompt: PROMPT,
      image: Array.from(bytes),
      max_tokens: 1024,
    });
    const text = typeof result === "string" ? result : (result.response ?? result.description ?? "");
    if (!text) throw new Error("Empty response from the vision model.");
    return NextResponse.json(extractJson(text));
  } catch (err) {
    const message = err instanceof Error ? err.message : "OCR failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
