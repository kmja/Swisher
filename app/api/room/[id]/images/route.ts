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

/** Receipt photos for the room — fetched lazily so they don't bloat the polling state. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stub = stubFor(id);
  if (!stub) return NextResponse.json({ images: [] }, { status: 503 });
  const images = await stub.getImages();
  return NextResponse.json({ images }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
