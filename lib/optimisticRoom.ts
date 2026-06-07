/**
 * Client-side mirror of RoomDO.init() — builds an optimistic RoomState
 * the items page can stash in sessionStorage right before navigating to
 * /room/[id], so the room page boots straight to "ok" instead of waiting
 * for the create-room POST round-trip.
 *
 * The server respects client-supplied ids (room code, host id, item ids)
 * so the optimistic state lines up with what eventually lands in the
 * Durable Object. Any deviation between this helper and the server's
 * init() will surface as a "state jiggle" the first time the room page
 * polls — keep them in lock-step.
 */

import { isFullyShared } from "./money";
import type { RoomState } from "./room-do";

// Same alphabet + length the API route generates room codes with; lets
// the client produce a code with no risk of collision with a server
// code while staying within the format the room page expects.
const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(n = 6): string {
  const arr = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(arr, (b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join("");
}

export type OptimisticRoomInput = {
  id: string;
  hostId: string;
  payeeName: string;
  payeeNumber: string;
  method: "swish" | "sepa";
  payeeIban: string;
  message: string;
  place: string;
  date: string;
  tipOre: number;
  currency: string;
  rate: number;
  country: string;
  imageCount: number;
  groupSize?: number;
  items: Array<{
    id: string;
    description: string;
    priceOre: number;
    category?: string;
    emoji?: string;
    shared?: boolean;
    shareCount?: number;
  }>;
};

export function buildOptimisticRoomState(input: OptimisticRoomInput): RoomState {
  const hostName = input.payeeName.trim().slice(0, 40) || "Värd";
  const groupSize =
    typeof input.groupSize === "number" && input.groupSize >= 2 ? Math.round(input.groupSize) : 1;
  return {
    id: input.id,
    createdAt: Date.now(),
    payeeName: hostName,
    payeeNumber: input.payeeNumber,
    method: input.method,
    payeeIban: (input.payeeIban ?? "").slice(0, 40),
    payeePersonId: input.hostId,
    message: input.message.slice(0, 50),
    place: input.place.slice(0, 60),
    date: input.date.slice(0, 20),
    tipOre: Math.max(0, Math.round(input.tipOre)),
    currency: (input.currency || "SEK").slice(0, 3).toUpperCase(),
    rate: input.rate > 0 ? input.rate : 1,
    country: (input.country ?? "").slice(0, 2).toUpperCase(),
    imageCount: Math.min(input.imageCount, 5),
    groupSize:
      typeof input.groupSize === "number" && input.groupSize >= 2
        ? Math.min(50, Math.round(input.groupSize))
        : undefined,
    items: input.items.map((it) => {
      const shareCount =
        typeof it.shareCount === "number" && it.shareCount > 0 ? Math.round(it.shareCount) : undefined;
      const fully = isFullyShared({ shared: it.shared === true, shareCount }, groupSize);
      return {
        id: it.id,
        description: it.description.slice(0, 80),
        priceOre: Math.max(0, Math.round(it.priceOre)),
        category: it.category,
        emoji: it.emoji,
        shared: it.shared === true,
        shareCount,
        claimedBy: fully ? [input.hostId] : [],
      };
    }),
    people: [{ id: input.hostId, name: hostName }],
    paidBy: [],
    doneBy: [],
  };
}

/** SessionStorage key for the pending create-room POST that the items
 *  page hands off to the room page when it navigates optimistically. */
export const pendingCreateKey = (id: string) => `kvitt-room-pending-create:${id}`;

/** Shape of the payload the items page stashes; the room page replays it
 *  on mount (and on retry) as the body of POST /api/room. */
export type PendingCreatePayload = {
  id: string;
  hostId: string;
  payeeName: string;
  payeeNumber: string;
  message: string;
  method: "swish" | "sepa";
  payeeIban: string;
  place: string;
  date: string;
  tipOre: number;
  currency: string;
  rate: number;
  country: string;
  images: string[];
  groupSize?: number;
  items: Array<{
    id: string;
    description: string;
    priceOre: number;
    category?: string;
    emoji?: string;
    shared?: boolean;
    shareCount?: number;
  }>;
};
