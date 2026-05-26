import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { buildPrefilledQrBody, buildSwishUri, normalizePhone, SWISH_QR_ENDPOINT } from "@/lib/swish";
import { buildEpcPayload, isValidIban } from "@/lib/sepa";

export const runtime = "nodejs";

function pngResponse(buffer: Buffer, source: string) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "X-Qr-Source": source,
    },
  });
}

async function localQr(text: string, source: string) {
  const dataUrl = await QRCode.toDataURL(text, { width: 300, margin: 1, errorCorrectionLevel: "M" });
  return pngResponse(Buffer.from(dataUrl.split(",")[1], "base64"), source);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // SEPA / EPC "Girocode" QR — scanned by a European banking app.
  if (searchParams.get("method") === "sepa") {
    const iban = searchParams.get("iban") ?? "";
    const name = searchParams.get("name") ?? "";
    const eurCents = Number(searchParams.get("eurCents"));
    const message = (searchParams.get("message") ?? "").slice(0, 140);
    if (!isValidIban(iban)) return NextResponse.json({ error: "Invalid IBAN." }, { status: 400 });
    if (!Number.isFinite(eurCents) || eurCents <= 0) {
      return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
    }
    try {
      return await localQr(buildEpcPayload({ name, iban, eurCents, message }), "epc");
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "QR failed." }, { status: 502 });
    }
  }

  const payee = normalizePhone(searchParams.get("payee") ?? "");
  const amountOre = Number(searchParams.get("amountOre"));
  const message = (searchParams.get("message") ?? "").slice(0, 50);

  if (!payee) {
    return NextResponse.json({ error: "Invalid or missing payee." }, { status: 400 });
  }
  if (!Number.isFinite(amountOre) || amountOre <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  const payment = { payee, amountOre, message };

  // Primary: the official getSwish prefilled QR (recognised natively by Swish).
  try {
    const res = await fetch(SWISH_QR_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify(buildPrefilledQrBody(payment)),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      return pngResponse(Buffer.from(arrayBuffer), "getswish");
    }
  } catch {
    // fall through to local generation
  }

  // Fallback: encode the locked swish:// deep link locally. Scannable
  // cross-device — any phone with Swish opens it prefilled.
  try {
    const uri = buildSwishUri(payment);
    const dataUrl = await QRCode.toDataURL(uri, { width: 300, margin: 1, errorCorrectionLevel: "M" });
    const base64 = dataUrl.split(",")[1];
    return pngResponse(Buffer.from(base64, "base64"), "local");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "QR generation failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
