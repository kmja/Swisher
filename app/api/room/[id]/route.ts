import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import type { RoomDO } from "@/lib/room-do";

export const runtime = "nodejs";

function stubFor(id: string): ReturnType<DurableObjectNamespace<RoomDO>["get"]> | null {
  try {
    const { env } = getCloudflareContext();
    const ns = (env as unknown as { ROOM?: DurableObjectNamespace<RoomDO> }).ROOM;
    if (!ns) return null;
    return ns.get(ns.idFromName(id.toUpperCase()));
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stub = stubFor(id);
  if (!stub) return NextResponse.json({ error: "Live rooms unavailable here." }, { status: 503 });
  const state = await stub.getState();
  if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
  return NextResponse.json(state);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stub = stubFor(id);
  if (!stub) return NextResponse.json({ error: "Live rooms unavailable here." }, { status: 503 });

  let body: {
    action?: string;
    name?: string;
    personId?: string;
    itemId?: string;
    targetId?: string;
    description?: string;
    priceOre?: number;
    shared?: boolean;
    shareCount?: number | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  switch (body.action) {
    case "join": {
      const r = await stub.join(String(body.name ?? ""));
      if (!r) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json(r);
    }
    case "claim": {
      const state = await stub.toggleClaim(String(body.personId ?? ""), String(body.itemId ?? ""));
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    case "paid": {
      const state = await stub.togglePaid(String(body.personId ?? ""), String(body.targetId ?? ""));
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    case "done": {
      const state = await stub.toggleDone(String(body.personId ?? ""));
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    case "edit": {
      const patch: { description?: string; priceOre?: number; shared?: boolean; shareCount?: number | null } = {};
      if (typeof body.description === "string") patch.description = body.description;
      if (typeof body.priceOre === "number") patch.priceOre = body.priceOre;
      if (typeof body.shared === "boolean") patch.shared = body.shared;
      if (body.shareCount === null || typeof body.shareCount === "number") patch.shareCount = body.shareCount;
      const state = await stub.editItem(String(body.personId ?? ""), String(body.itemId ?? ""), patch);
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    case "removeItem": {
      const state = await stub.removeItem(String(body.personId ?? ""), String(body.itemId ?? ""));
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    case "addItem": {
      const state = await stub.addItem(String(body.personId ?? ""), {
        description: String(body.description ?? ""),
        priceOre: Number(body.priceOre),
        shared: body.shared === true,
      });
      if (!state) return NextResponse.json({ error: "Room not found." }, { status: 404 });
      return NextResponse.json({ state });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
