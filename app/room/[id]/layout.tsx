import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RoomDO } from "@/lib/room-do";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { env } = getCloudflareContext();
    const ns = (env as unknown as { ROOM?: DurableObjectNamespace<RoomDO> }).ROOM;
    if (!ns) return {};
    const stub = ns.get(ns.idFromName(id.toUpperCase()));
    const state = await stub.getState();
    if (!state?.place) return {};
    const title = `${state.place} — Kvitt`;
    return {
      title,
      openGraph: { title },
      twitter: { title },
    };
  } catch {
    return {};
  }
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
