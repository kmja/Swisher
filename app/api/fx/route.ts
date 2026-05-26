import { NextResponse } from "next/server";
import { fetchRateToSek } from "@/lib/fx";

export const runtime = "nodejs";

/** Look up the SEK rate for a currency on a given date, so the host can correct
 *  a mis-detected currency on the client and re-convert the amounts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency = url.searchParams.get("currency") ?? "";
  const date = url.searchParams.get("date");
  if (!/^[A-Za-z]{3}$/.test(currency)) {
    return NextResponse.json({ error: "Invalid currency." }, { status: 400 });
  }
  const fx = await fetchRateToSek(currency, date);
  if (!fx) return NextResponse.json({ rate: null });
  return NextResponse.json({ rate: fx.rate, approx: fx.approx, date: fx.date ?? null });
}
