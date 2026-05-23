import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/swish";
import type { RoomDO } from "@/lib/room-do";

export const runtime = "nodejs";

// No ambiguous characters (0/O/1/I) so codes are easy to read aloud / type.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = (n = 6) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join("");

function roomNamespace(): DurableObjectNamespace<RoomDO> | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { ROOM?: DurableObjectNamespace<RoomDO> }).ROOM ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ns = roomNamespace();
  if (!ns) {
    return NextResponse.json(
      { error: "Live rooms require the Cloudflare runtime (deploy or cf:preview)." },
      { status: 503 },
    );
  }

  let body: {
    payeeName?: string;
    payeeNumber?: string;
    message?: string;
    tipPercent?: number;
    items?: { description?: unknown; priceOre?: unknown }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payeeNumber = normalizePhone(String(body.payeeNumber ?? ""));
  if (!payeeNumber) {
    return NextResponse.json({ error: "Invalid payee Swish number." }, { status: 400 });
  }

  const items = (Array.isArray(body.items) ? body.items : [])
    .map((it) => ({ description: String(it?.description ?? "").trim(), priceOre: Math.round(Number(it?.priceOre)) }))
    .filter((it) => it.description && Number.isFinite(it.priceOre) && it.priceOre > 0)
    .slice(0, 100);
  if (items.length === 0) {
    return NextResponse.json({ error: "Add at least one item." }, { status: 400 });
  }

  const id = newCode();
  const stub = ns.get(ns.idFromName(id));
  const state = await stub.init({
    id,
    payeeName: String(body.payeeName ?? "").slice(0, 40),
    payeeNumber,
    message: String(body.message ?? "").slice(0, 50),
    tipPercent: Number(body.tipPercent) || 0,
    items,
  });

  return NextResponse.json({ id, personId: state.payeePersonId });
}
