import QRCode from "qrcode";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// QR of the room's own join URL (built server-side from the request origin, so
// it can't be pointed at an arbitrary host).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = id.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const url = `${new URL(req.url).origin}/room/${code}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1, errorCorrectionLevel: "M" });
    const base64 = dataUrl.split(",")[1];
    return new NextResponse(new Uint8Array(Buffer.from(base64, "base64")), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "QR failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
