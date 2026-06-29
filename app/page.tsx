"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrCard from "@/components/QrCard";
import QrDialog from "@/components/QrDialog";
import { computeShares, formatOre, parseAmountToOre } from "@/lib/money";
import { isValidPhone, normalizePhone } from "@/lib/swish";
import { isValidIban, normalizeIban, formatIban, ibanBankName } from "@/lib/sepa";
import KvittLogo from "@/components/KvittLogo";
import StepHeader from "@/components/StepHeader";
import { translations, type Lang, type Strings } from "@/lib/i18n";
import { detectDefaultLang, detectDefaultMethod } from "@/lib/locales";
import { categoryFor, CATEGORY_EMOJI, CATEGORY_LABEL, CATEGORY_ORDER, sharedSuggestion } from "@/lib/categories";
import { formatReceiptDate } from "@/lib/date";
import ItemEmoji from "@/components/ItemEmoji";
import { Money, FxProvider } from "@/components/Money";
import { currencyFlag, flagEmoji, formatNative, regionName, type Fx } from "@/lib/currency";
import { addHistory } from "@/lib/history";
import { analyzeImageQuality, type ImageQuality } from "@/lib/imageQuality";
import { detectTextLines, type DetectedLine } from "@/lib/detectLines";
import { buildOptimisticRoomState, generateRoomCode, pendingCreateKey, type PendingCreatePayload } from "@/lib/optimisticRoom";
import { readLocalSplit, saveLocalSplit } from "@/lib/local-split";
import LangToggle from "@/components/LangToggle";
import type { Diner, LineItem } from "@/lib/types";

type Step = "capture" | "items" | "assign" | "result";
type UiItem = {
  id: string;
  description: string;
  priceInput: string;
  sharers: string[];
  shared: boolean;
  category: string;
  /** Index into `images` of the photo this row was scanned from; -1 if typed. */
  imgIndex: number;
  /** Vertical position on the source photo (0–1) where OCR found this line. */
  y?: number;
  /** Emoji the model picked for this item (knows brands); fallback when no keyword rule matches. */
  emoji?: string;
  /** Tip row — shared by everyone, kept out of the food/bill total. */
  isTip?: boolean;
  /** Fixed number of ways a shared item splits; falls back to the group size. */
  shareCount?: number;
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Stable sort by category (starters → mains → drinks → desserts → other, tip last). */
function sortByCategory(arr: UiItem[]): UiItem[] {
  const rank = (it: UiItem) =>
    it.isTip ? 999 : CATEGORY_ORDER.indexOf(categoryFor(it.description, it.category));
  return [...arr].sort((a, b) => rank(a) - rank(b));
}

/** Visual group-size indicator: a casual cluster of person silhouettes
 *  that bunches up tighter as the count grows. Slight rotation + vertical
 *  jitter (deterministic per index) so the row reads as a real group, not
 *  a uniform fence. Capped at 10 visible chips; anything beyond shows
 *  "+N" so the cluster width stays sane.
 *
 *  Animation: when count changes, the whole cluster gets a brief bounce
 *  pulse (grows on add, dips on remove), and any new chip pops in from
 *  scale 0 → 1. Driven imperatively via element.animate() so it runs
 *  exactly once per change and leaves no CSS class to replay. */
// Per-index variation tables so the cluster reads as a crew of distinct
// people, not stamped clones. Sizes cycle 48/50/52/54/56 px — the
// smallest still shows half itself past the next chip's overlap, so the
// Each chip's identity (size, tint, lift, rotation, z-layer) is pinned
// to its slot index — chip i always looks exactly the same, so the
// pile is reproducible and won't flicker between renders. The arrays
// are hand-shuffled (no dark-light-dark-light, no high-low-high-low)
// so consecutive slots have no obvious rhythm and the pile reads as
// a bunched group of people rather than a neat queue. New chips
// arriving simply mount at the next slot and animate in with a
// mushroom pop — no random insertion / sibling re-shuffle, which
// was the source of the on-device glitching.
// Chips sit on a ~72-px orbit around the count number, so cap their
// diameters at ~50 — bigger and the outer ring would overflow the
// 200-px container; smaller and ten of them at a packed table would
// rattle around with too much air between them.
const CHIP_SIZES = [40, 34, 42, 36, 38, 34, 40, 42, 36, 40];
const CHIP_ROTATIONS = [-5, 7, -1, 4, 2, -8, 6, -3, 1, -6];
// Coprime stride through 0–9 so each slot's depth looks random
// without two chips ever sharing a layer — keeps the leftmost chip
// from always landing on top.
const CHIP_Z_ORDER = [3, 8, 1, 6, 9, 2, 7, 0, 5, 4];

/** Round secondary button styled like the side controls in a native
 *  camera app — translucent dark surface, white icon, soft outline so
 *  it sits comfortably over the live video. The `lg` size matches the
 *  "choose from library" affordance and gives an SVG icon room. */
function CaptureIconButton({
  onClick,
  label,
  children,
  size = "default",
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  size?: "default" | "lg";
}) {
  const dims = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pointer-events-auto flex items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/30 backdrop-blur transition-transform active:scale-95 ${dims}`}
    >
      {children}
    </button>
  );
}

/** Monochrome photo icon (frame + sun + mountains) used for the
 *  choose-from-library button. Rendered with currentColor so it
 *  picks up the button's white text colour automatically. */
function PhotoIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M21 16l-4.5-5.5-4 4.5-2.5-2L3.5 18" />
    </svg>
  );
}

/** Monochrome lightning-bolt icon for the flashlight toggle. Matches
 *  PhotoIcon's stroke weight + currentColor pattern so the two
 *  bottom-corner controls read as a pair. */
function FlashIcon({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13 2 L5 13 h6 l-2 9 8-11 h-6 z" />
    </svg>
  );
}

/** 72 px iOS-camera-style shutter: solid white outer ring, a small
 *  gap, then a solid white disc inside. Tapping fires the capture.
 *  `count` paints a tiny swish badge on the inner disc so the host
 *  can see how many shots have stacked while in multi-shot mode. */
function CaptureShutterButton({
  onClick,
  label,
  disabled,
  count,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="pointer-events-auto relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white/95 shadow-2xl active:scale-95 transition-transform disabled:opacity-40"
    >
      <span aria-hidden className="block h-[54px] w-[54px] rounded-full bg-[#ffffff] shadow-inner" />
      {typeof count === "number" && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-swish px-1.5 text-[11px] font-bold text-white shadow-md ring-2 ring-white">
          {count}
        </span>
      )}
    </button>
  );
}

/** 72 px swish-coloured commit button — same chassis as the shutter
 *  but solid swish-pink with a white checkmark, used to advance from
 *  the preview / multi-shot state into OCR. */
function CaptureCommitButton({
  onClick,
  label,
  compact,
  count,
}: {
  onClick: () => void;
  label: string;
  compact?: boolean;
  count?: number;
}) {
  const size = compact ? "h-12 w-12 text-xl" : "h-[72px] w-[72px] text-3xl";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`pointer-events-auto relative flex items-center justify-center rounded-full bg-swish font-bold text-white shadow-2xl ring-[3px] ring-white/95 active:bg-swish-dark active:scale-95 transition-transform ${size}`}
    >
      ✓
      {typeof count === "number" && count > 0 && !compact && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-swish shadow-md ring-2 ring-swish/30">
          {count}
        </span>
      )}
    </button>
  );
}

type ChipSlot = { addIndex: number };

/** Deterministic seed for a chip: every property derives from the
 *  chip's permanent addIndex, NOT its current slot in the pile. That
 *  way a chip's look doesn't change when its neighbours shift. */
function chipLook(addIndex: number) {
  const i = addIndex - 1;
  return {
    size: CHIP_SIZES[i % CHIP_SIZES.length],
    rot: CHIP_ROTATIONS[i % CHIP_ROTATIONS.length],
    z: CHIP_Z_ORDER[i % CHIP_Z_ORDER.length],
  };
}

/** Reconstruct the pile order for "N adds starting from empty":
 *  odd add-indices push to the right edge, even add-indices unshift
 *  to the left edge, so additions land alternately on each end
 *  instead of always on the right. */
function buildInitialChips(n: number): ChipSlot[] {
  const list: ChipSlot[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % 2 === 1) list.push({ addIndex: i });
    else list.unshift({ addIndex: i });
  }
  return list;
}

// Around-the-table circle layout. Chips sit at evenly-spaced
// positions on a ring centred on the count number — visually reads
// like guests around a round table. Each chip's own personality
// (size, tint, rotation, z) is still pinned to its addIndex, so a
// chip never changes appearance once it's seated; only its angle
// around the ring updates as the table grows or shrinks.
// Container for the round-table widget. Width stays at 200 because
// the side chips' centres are at x = ±65 and the largest chip's
// outer ring lands at x = ±88 — anything narrower and we'd clip.
// Height drops to 170 because the orbit's Y-radius is only 50,
// leaving way more empty headroom above + below the table than the
// component needed. ~12 px clearance to topmost / bottommost chip.
const CIRCLE_WIDTH = 200;
const CIRCLE_HEIGHT = 170;
// The table is squashed into a 3 : 2 ellipse (120 × 80), so the chip
// orbit is squashed to match — otherwise the top / bottom chips
// floated way off the table while the side chips sat right on it.
// Orbit + tabletop shrunk together so the chips still perch on the
// rim — they're proportional, so reducing both by the same fraction
// preserves the "chips sit right on the edge" relationship.
const CIRCLE_RADIUS_X = 65;
const CIRCLE_RADIUS_Y = 50;
const TABLE_RADIUS_X = 53;
const TABLE_RADIUS_Y = 41;

function slotPosition(slot: number, total: number) {
  // 12 o'clock seat at slot 0, walking clockwise. If only one chip
  // is at the table, just centre it (no orbit).
  if (total <= 0) return { x: 0, y: 0 };
  const angle = -Math.PI / 2 + (slot / total) * 2 * Math.PI;
  return {
    x: Math.cos(angle) * CIRCLE_RADIUS_X,
    y: Math.sin(angle) * CIRCLE_RADIUS_Y,
  };
}

/** Pick angles for the table legs that fall in gaps BETWEEN chips
 *  on the lower half of the orbit. For most counts that's a left
 *  + right pair flanking the bottom chip; at 5 (where there's also
 *  a gap directly at 180° between the two lower chips) we add a
 *  middle leg too so the table doesn't look propped up on two stilts
 *  with an obvious hole in the middle. Falls back to 150°/210° when
 *  there are no lower-half gaps to land in.
 *  Angle convention: degrees clockwise from 12 o'clock. */
function tableLegAngles(n: number): number[] {
  if (n < 2) return [150, 210];
  const gaps: number[] = [];
  for (let i = 0; i < n; i++) gaps.push(((i + 0.5) * 360) / n);
  const lower = gaps.filter((a) => a > 90 && a < 270);
  if (lower.length === 0) return [150, 210];
  if (lower.length === 1) {
    // Single bottom gap (N = 3 has one at 180°). Split into two
    // legs offset to either side so we still get a left + right
    // pair instead of a single stilt.
    const c = lower[0];
    return [c - 22, c + 22];
  }
  const result: number[] = [];
  // Include a centre leg if the gap closest to 6 o'clock IS 180°
  // (true for odd N where the equator passes through a gap rather
  // than a chip — N=5 / 7 / 9 …).
  const hasMiddleGap = lower.some((a) => Math.abs(a - 180) < 0.5);
  if (hasMiddleGap) result.push(180);
  const left = lower
    .filter((a) => a < 179.5)
    .sort((a, b) => Math.abs(a - 180) - Math.abs(b - 180))[0];
  const right = lower
    .filter((a) => a > 180.5)
    .sort((a, b) => Math.abs(a - 180) - Math.abs(b - 180))[0];
  if (left != null) result.push(left);
  if (right != null) result.push(right);
  return result.sort((a, b) => a - b);
}

function GroupVisual({ count }: { count: number }) {
  const initialCountRef = useRef(count);
  const [chips, setChips] = useState<ChipSlot[]>(() =>
    buildInitialChips(Math.max(0, Math.min(count, 50))),
  );
  // Monotonic counter — every add pulls the next value, every remove
  // doesn't decrement. Tap +/- repeatedly and the new chip's look
  // and orbit position cycle on each tap.
  const nextAddIndexRef = useRef<number>(initialCountRef.current + 1);

  // Sync chips with parent's count. Add: alternates the side it
  // joins the array (odd push, even unshift), so guests "sit down"
  // alternately at adjacent seats either side of the host instead
  // of always at the next clockwise seat. Remove: drops the newest
  // (highest addIndex) chip.
  useEffect(() => {
    setChips((prev) => {
      if (prev.length === count) return prev;
      let next = prev;
      if (next.length < count) {
        next = [...next];
        while (next.length < count) {
          const idx = nextAddIndexRef.current;
          nextAddIndexRef.current = idx + 1;
          if (idx % 2 === 1) next.push({ addIndex: idx });
          else next.unshift({ addIndex: idx });
        }
      } else {
        next = [...next];
        while (next.length > count) {
          let maxAt = 0;
          let max = -1;
          for (let i = 0; i < next.length; i++) {
            if (next[i].addIndex > max) {
              max = next[i].addIndex;
              maxAt = i;
            }
          }
          next.splice(maxAt, 1);
        }
      }
      return next;
    });
  }, [count]);

  const visibleChips = chips.slice(0, 10);
  const overflow = Math.max(0, chips.length - 10);

  // Cluster wobble for stepper feedback.
  const clusterRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(count);
  useEffect(() => {
    if (prevCountRef.current === count) return;
    const grew = count > prevCountRef.current;
    prevCountRef.current = count;
    if (clusterRef.current?.animate) {
      clusterRef.current.animate(
        [
          { transform: "scale(1)" },
          { transform: grew ? "scale(1.04)" : "scale(0.97)" },
          { transform: "scale(1)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)" },
      );
    }
  }, [count]);

  // FLIP-along-the-orbit. Each chip's transform composes its angle-
  // based position with its personality rotation. On count change:
  //   - chips with no remembered position are brand new → mushroom
  //     pop in place (scale 0 → 1.18 → 1) at their target seat.
  //   - chips whose seat moved animate the transform delta from
  //     their old orbit position to the new one.
  const chipElsRef = useRef<Map<number, HTMLSpanElement>>(new Map());
  const prevPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const firstRunRef = useRef(true);
  useLayoutEffect(() => {
    if (firstRunRef.current) {
      firstRunRef.current = false;
      for (let i = 0; i < visibleChips.length; i++) {
        prevPosRef.current.set(visibleChips[i].addIndex, slotPosition(i, visibleChips.length));
      }
      return;
    }
    const n = visibleChips.length;
    for (let i = 0; i < n; i++) {
      const chip = visibleChips[i];
      const el = chipElsRef.current.get(chip.addIndex);
      if (!el || typeof el.animate !== "function") continue;
      const look = chipLook(chip.addIndex);
      const pos = slotPosition(i, n);
      const restingTransform = `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${look.rot}deg)`;
      const oldPos = prevPosRef.current.get(chip.addIndex);
      if (!oldPos) {
        el.animate(
          [
            { transform: `${restingTransform} scale(0)`, opacity: 0 },
            { transform: `${restingTransform} scale(1.18)`, opacity: 1, offset: 0.7 },
            { transform: `${restingTransform} scale(1)`, opacity: 1 },
          ],
          { duration: 360, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
        );
      } else if (Math.hypot(oldPos.x - pos.x, oldPos.y - pos.y) > 0.5) {
        const oldTransform = `translate(-50%, -50%) translate(${oldPos.x}px, ${oldPos.y}px) rotate(${look.rot}deg)`;
        el.animate(
          [{ transform: oldTransform }, { transform: restingTransform }],
          { duration: 340, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
        );
      }
      prevPosRef.current.set(chip.addIndex, pos);
    }
    const ids = new Set(visibleChips.map((c) => c.addIndex));
    for (const k of [...prevPosRef.current.keys()]) {
      if (!ids.has(k)) prevPosRef.current.delete(k);
    }
  }, [visibleChips]);

  return (
    <div
      aria-hidden
      ref={clusterRef}
      className="relative isolate"
      style={{ width: CIRCLE_WIDTH, height: CIRCLE_HEIGHT }}
    >
      {/* Inline SVG filter for the tabletop wood grain. feTurbulence
          generates a 2-D Perlin-noise map; feDisplacementMap then
          uses it to shove pixels of the source (the straight stripe
          gradient) around — strong in Y (high baseFrequency.y) so
          horizontal lines wave up and down, weak in X (low
          baseFrequency.x) so the waves drift slowly side-to-side
          instead of breaking into static. Net effect: ribbons that
          flow + cluster + part like real growth rings on a thick
          plank. Lives here (rather than in app/layout.tsx) so it
          only loads on the items step where GroupVisual renders. */}
      <svg width="0" height="0" aria-hidden className="absolute">
        <defs>
          <filter id="kvitt-wood-grain" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="turbulence" baseFrequency="0.018 0.38" numOctaves="1" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="6" />
          </filter>
        </defs>
      </svg>
      {/* Round dining table. Built from TWO stacked ellipses so the
          tipped-forward disc actually looks like it has a finished
          edge with thickness:
            1. RIM  — sits underneath, offset 5 px DOWN; the
                      visible sliver at the bottom is the "side"
                      of the tabletop. Slightly darker than the
                      surface so it reads as the wood's shadow
                      side.
            2. TOP  — wears the setup card's input chrome (bg-
                      white + shadow-sm + ring-1 ring-black/5).
                      This is what the chips perch on; chips and
                      legs use the same surface family.
          Legs ride along the rim's bottom edge so they appear to
          extend down from the table's side, not from the surface.
          The whole stack lives in the same wrapper the chips
          orbit so positioning maths stays simple. */}
      {(() => {
        const tableW = TABLE_RADIUS_X * 2;
        const tableH = TABLE_RADIUS_Y * 2;
        const RIM_DEPTH = 5;
        const legPositions = tableLegAngles(visibleChips.length).map((angle) => {
          const rad = (angle * Math.PI) / 180;
          // x / y are offsets from the table's centre, in px.
          return { angle, x: TABLE_RADIUS_X * Math.sin(rad), y: -TABLE_RADIUS_Y * Math.cos(rad) };
        });
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${tableW}px`, height: `${tableH}px` }}
          >
            {legPositions.map((pos, i) => {
              // Lean each leg slightly outward from 6 o'clock —
              // the further the leg is from 180° the more it
              // tilts away from the table's centreline, with the
              // pivot pinned to the leg's TOP edge so only the
              // bottom swings. ~9° at 150° / 210°, 0° dead-centre.
              const lean = (180 - pos.angle) * 0.3;
              return (
                <div
                  key={i}
                  className="absolute h-3 w-1.5 rounded-b-md bg-[#a98a55] shadow-sm ring-1 ring-black/5 dark:bg-[#46464e]"
                  style={{
                    left: `${TABLE_RADIUS_X + pos.x}px`,
                    top: `${TABLE_RADIUS_Y + pos.y + RIM_DEPTH - 4}px`,
                    transform: `translateX(-50%) rotate(${lean}deg)`,
                    transformOrigin: "50% 0",
                  }}
                />
              );
            })}
            {/* Bottom rim ellipse — the table's side / thickness.
                Sits one tone below the lit top so the rim reads as
                the shadow side of the same piece of wood. Pushed
                up the dark-mode value so the whole table is
                brighter against the dark card.
                Explicit `key` here AND on the top below — without
                them, React reconciles them positionally and they
                shift one slot each time tableLegAngles() returns
                a different number of legs, which would remount
                the filtered stripe div and re-key the SVG
                turbulence pattern. With keys these stay put. */}
            <div
              key="rim"
              className="absolute inset-0 rounded-[50%] bg-[#a98a55] dark:bg-[#46464e]"
              style={{ transform: `translateY(${RIM_DEPTH}px)` }}
            />
            {/* Mid-oak in LIGHT mode (top #d4b884 / rim #a98a55).
                Dark mode swaps to neutral cool grays (top #5e5e68 /
                rim #46464e) — a warm brown next to the rest of the
                dark palette (#161618 page, #2f2f37 cards, #4a4a55
                muted surfaces) read as a clash. The wood-grain
                stripes still carry the wood character on top of
                the gray surface. */}
            <div key="top" className="absolute inset-0 overflow-hidden rounded-[50%] bg-[#d4b884] shadow-sm ring-1 ring-black/5 dark:bg-[#5e5e68]">
              {/* Wood-grain on the tabletop — TEN thin (1 px) stripes
                  alternating from the left and right edges, each
                  reaching 34-54 % across. Five sit in the top half,
                  five in the bottom; nothing crosses the 40-60 %
                  middle band where the count number lives. Each
                  stripe is its own horizontal linear-gradient
                  background-image, sized to a 1 px band and placed
                  vertically with background-position. The SVG
                  turbulence filter is dialed down (scale 11 → 6)
                  so the warp reads as a soft curl rather than a
                  smear, keeping the lines crisp and graphic. */}
              <div
                className="pointer-events-none absolute -inset-2"
                style={{
                  backgroundImage: [
                    "linear-gradient(90deg, var(--table-grain) 0 50%, transparent 53% 100%)",
                    "linear-gradient(90deg, transparent 0 63%, var(--table-grain) 66% 100%)",
                    "linear-gradient(90deg, var(--table-grain) 0 42%, transparent 45% 100%)",
                    "linear-gradient(90deg, transparent 0 43%, var(--table-grain) 46% 100%)",
                    "linear-gradient(90deg, var(--table-grain) 0 35%, transparent 38% 100%)",
                    "linear-gradient(90deg, transparent 0 56%, var(--table-grain) 59% 100%)",
                    "linear-gradient(90deg, var(--table-grain) 0 48%, transparent 51% 100%)",
                    "linear-gradient(90deg, transparent 0 63%, var(--table-grain) 66% 100%)",
                    "linear-gradient(90deg, var(--table-grain) 0 43%, transparent 46% 100%)",
                    "linear-gradient(90deg, transparent 0 43%, var(--table-grain) 46% 100%)",
                  ].join(", "),
                  backgroundSize:
                    "100% 1px, 100% 1px, 100% 1px, 100% 1px, 100% 1px," +
                    "100% 1px, 100% 1px, 100% 1px, 100% 1px, 100% 1px",
                  backgroundPosition:
                    "0 5%, 0 13%, 0 21%, 0 29%, 0 37%," +
                    "0 63%, 0 71%, 0 79%, 0 87%, 0 95%",
                  backgroundRepeat: "no-repeat",
                  filter: "url(#kvitt-wood-grain)",
                }}
              />
              {/* Inset bottom shadow on a child div so the parent's
                  Tailwind ring + drop shadow aren't clobbered (ring
                  is implemented as a box-shadow under the hood;
                  a custom inline boxShadow on the parent would
                  replace it). */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[50%]"
                style={{ boxShadow: "inset 0 -4px 8px rgba(0, 0, 0, 0.06)" }}
              />
            </div>
          </div>
        );
      })()}
      {/* Big count number at the centre of the table. tabular-nums
          so 1 / 2 / 3 don't make the centre tick from frame to
          frame as the chips orbit around it. */}
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
        <span className="text-4xl font-medium tabular-nums text-[#f7eccd]">{count || "–"}</span>
      </div>
      {visibleChips.map((chip, i) => {
        const look = chipLook(chip.addIndex);
        const pos = slotPosition(i, visibleChips.length);
        const iconSize = Math.round(look.size * 0.5);
        // Chips on the back half of the table (pos.y < 0, i.e. the
        // upper arc behind the count) sit BELOW the table's z-index
        // so the table top ellipse clips their lower edge — giving
        // a 3D effect where the back chips look tucked behind the
        // table. Chips on the front half rise above the count.
        const behind = pos.y < 0;
        return (
          <span
            key={chip.addIndex}
            ref={(el) => {
              if (el) chipElsRef.current.set(chip.addIndex, el);
              else chipElsRef.current.delete(chip.addIndex);
            }}
            // Opaque fill set just one step off the tabletop — a
            // pale cool gray on the white wood / a step under the
            // dark table tone. Ring is a very faint hairline (one
            // tonal step from the fill) so the chip silhouette
            // reads as "soft pebble" rather than "outlined badge",
            // and the icon swings to the opposite end of the
            // gray ramp from the fill so it stays clearly legible
            // on either chip colour.
            className="absolute left-1/2 top-1/2 flex items-center justify-center rounded-full bg-[#f6f6f8] text-gray-600 ring-1 ring-gray-300 dark:bg-[#6c6c78] dark:text-gray-200 dark:ring-[#555560]"
            style={{
              width: `${look.size}px`,
              height: `${look.size}px`,
              transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${look.rot}deg)`,
              zIndex: behind ? look.z : 30 + look.z,
            }}
          >
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
            </svg>
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="absolute bottom-0 right-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 ring-2 ring-white">
          +{overflow}
        </span>
      )}
    </div>
  );
}

/** Randomised demo orders for "/?demo=1" — picks from generous per-
 *  category pools so the validation step looks different every reload,
 *  AND throws in a deliberately tricky bucket of abbreviations, foreign
 *  words and side-of-the-menu items that exercise the categorisation
 *  and OCR-mismatch paths.
 *
 *  Each item carries its own `shared` flag based on what the dish
 *  actually is — a charcuterie platter is always shared, a single
 *  entrecôte never is, a bottle of wine is, an individual glass isn't.
 *  Deterministic per dish so the same item never flips sides across
 *  reloads. Without this, "Bröd & smör" could land shared one tap and
 *  unshared the next, which would make the demo unusable for repro'ing
 *  bugs. */
type DemoItem = { d: string; shared?: boolean };
const DEMO_POOL: Record<"starters" | "mains" | "drinks" | "desserts" | "tricky", readonly DemoItem[]> = {
  starters: [
    // Table items — shared by nature.
    { d: "Bröd & smör", shared: true },
    { d: "Charkbricka", shared: true },
    { d: "Skaldjursplateau", shared: true },
    { d: "Oliver", shared: true },
    { d: "Hummus med pita", shared: true },
    { d: "Vitlöksbröd", shared: true },
    { d: "Antipasti misto", shared: true },
    // Individual starters.
    { d: "Burrata med tomat" },
    { d: "Carpaccio" },
    { d: "Toast Skagen" },
    { d: "Räkmacka" },
    { d: "Löjromstoast" },
    { d: "Ostron" },
    { d: "Sniglar" },
    { d: "Caesar sallad" },
  ],
  mains: [
    { d: "Entrecôte 250g" },
    { d: "Oxfilé" },
    { d: "Fläskkarré" },
    { d: "Wallenbergare" },
    { d: "Räkpasta" },
    { d: "Vegetarisk lasagne" },
    { d: "Stekt torsk" },
    { d: "Lammracks" },
    { d: "Köttbullar med lingon" },
    { d: "Pad thai" },
    { d: "Risotto ai funghi" },
    { d: "Tikka masala" },
    { d: "Schnitzel" },
    { d: "Magret de canard" },
    { d: "Bouillabaisse" },
    { d: "Coq au vin" },
    { d: "Tagliatelle al ragù" },
    { d: "Janssons frestelse" },
  ],
  drinks: [
    // Bottles / carafes / pitchers — always shared.
    { d: "Flaska Barolo 75cl", shared: true },
    { d: "Flaska Chablis 75cl", shared: true },
    { d: "Karaff rödvin", shared: true },
    { d: "Champagne Mumm", shared: true },
    { d: "Flaska vatten", shared: true },
    // Individual drinks.
    { d: "Stor stark" },
    { d: "Glas rödvin" },
    { d: "Glas vitt vin" },
    { d: "Coca-Cola" },
    { d: "Alkoholfri öl" },
    { d: "Bryggkaffe" },
    { d: "Espresso" },
    { d: "Cappuccino" },
    { d: "Aperol Spritz" },
    { d: "Negroni" },
    { d: "Gin & tonic" },
    { d: "Mojito" },
    { d: "Margarita" },
    { d: "Old Fashioned" },
    { d: "Glögg" },
    { d: "OP Anderson" },
    { d: "Hallands Fläder" },
  ],
  desserts: [
    { d: "Crème brûlée" },
    { d: "Kladdkaka med glass" },
    { d: "Glass" },
    { d: "Cheesecake" },
    { d: "Tiramisu" },
    { d: "Macarons" },
    { d: "Churros" },
    { d: "Cannoli" },
    { d: "Mochi" },
    { d: "Baklava" },
    { d: "Prinsesstårta" },
    { d: "Semla" },
    { d: "Kanelbulle" },
    { d: "Marängsviss" },
    { d: "Citronfromage" },
  ],
  // Tricky pool — abbreviations, foreign / ambiguous words, sides
  // that could fall in any category, and one or two service-line
  // items. Shared flag set per item where it makes sense (bread
  // baskets, plates of fries to share, table water).
  tricky: [
    { d: "BR KAFFE" },
    { d: "ENTRC 250G" },
    { d: "WALLENB" },
    { d: "CAPP DBL" },
    { d: "ESPR MARTINI" },
    { d: "RÄKM SK" },
    { d: "FL VATTEN", shared: true },
    { d: "STR STARK" },
    { d: "GLAS RÖDV" },
    { d: "Råbiff" },
    { d: "Steak tartare" },
    { d: "Vegan plate" },
    { d: "Pintxos", shared: true },
    { d: "Empanada" },
    { d: "Bao bun" },
    { d: "Pho bo" },
    { d: "Banh mi" },
    { d: "Ramen" },
    { d: "Edamame", shared: true },
    { d: "Vårrulle" },
    { d: "Samosa" },
    { d: "Burrata caprese" },
    { d: "Pommes frites", shared: true },
    { d: "Rostade rotsaker", shared: true },
    { d: "Sallad", shared: true },
    { d: "Snaps" },
    { d: "Akvavit" },
    { d: "Dricks" },
    { d: "Couvert", shared: true },
  ],
};

function demoRandInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function demoPickUnique<T>(arr: readonly T[], n: number): T[] {
  const out: T[] = [];
  const pool = [...arr];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = demoRandInt(0, pool.length - 1);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}
function demoPickAny<T>(arr: readonly T[], n: number): T[] {
  return Array.from({ length: n }, () => arr[demoRandInt(0, arr.length - 1)]);
}

/** Plausible-but-fake restaurant names so each "/?demo=1" reload looks
 *  like a different night out. Mix of Swedish bistros, French / Italian,
 *  Asian fusion and pubs so the categorisation pool gets exercised
 *  against a variety of contexts. */
const DEMO_RESTAURANTS = [
  "Bistro Bohème", "Häktet", "Hantverket", "Rolf's Kök",
  "Vassa Eggen", "Konst & Klang", "Café Saturnus", "Tjoget",
  "Brasserie Bobonne", "Trattoria Romana", "L'Atelier",
  "Roxy", "Vrå", "Misshumasshu", "Imouto",
  "Pelikan", "Tennstopet", "Riche",
  "Sticks'n'Sushi", "Burger Söder", "Pickled", "Aira",
  "Köket på Hornsgatan", "Lilla Nygatan 7", "Operahyllan",
];

/** Pick a random restaurant name + a random date in the past six
 *  months. Date is ISO YYYY-MM-DD so the date input + the receipt-
 *  date formatter both handle it cleanly. */
function randomDemoMeta(today: string): { place: string; date: string } {
  const place = DEMO_RESTAURANTS[demoRandInt(0, DEMO_RESTAURANTS.length - 1)];
  const offsetDays = demoRandInt(0, 180);
  const ms = new Date(`${today}T00:00:00`).getTime() - offsetDays * 24 * 60 * 60 * 1000;
  const date = new Date(ms).toISOString().slice(0, 10);
  return { place, date };
}

/** Build a fresh randomised demo order. Items are picked at random
 *  from each pool, but each item's shared flag is fixed in the pool
 *  itself — the same dish always behaves the same way across reloads.
 *  Prices are in öre, rounded to whole kronor to match what a real
 *  receipt prints. */
function generateDemoOrder(): { d: string; o: number; c: string; s?: boolean }[] {
  const items: { d: string; o: number; c: string; s?: boolean }[] = [];
  const kronor = (k: number) => k * 100;
  for (const x of demoPickUnique(DEMO_POOL.starters, demoRandInt(2, 5))) {
    items.push({ d: x.d, o: kronor(demoRandInt(60, 195)), c: "starter", s: x.shared });
  }
  for (const x of demoPickAny(DEMO_POOL.mains, demoRandInt(6, 12))) {
    items.push({ d: x.d, o: kronor(demoRandInt(195, 425)), c: "food", s: x.shared });
  }
  for (const x of demoPickAny(DEMO_POOL.drinks, demoRandInt(8, 16))) {
    // Bottles + carafes come pre-flagged shared in the pool; that flag
    // also doubles as the price-band switch (bottles get the wine
    // pricing, individual glasses the cocktail pricing).
    const isBottle = !!x.shared;
    items.push({
      d: x.d,
      o: kronor(isBottle ? demoRandInt(495, 1495) : demoRandInt(35, 195)),
      c: "drink",
      s: x.shared,
    });
  }
  for (const x of demoPickAny(DEMO_POOL.desserts, demoRandInt(3, 7))) {
    items.push({ d: x.d, o: kronor(demoRandInt(65, 135)), c: "dessert", s: x.shared });
  }
  // Tricky items — leave category blank so the app has to derive it
  // from the description, which is where the bugs hide.
  for (const x of demoPickUnique(DEMO_POOL.tricky, demoRandInt(3, 7))) {
    items.push({ d: x.d, o: kronor(demoRandInt(45, 295)), c: "", s: x.shared });
  }
  return items;
}

/** Currencies the host can pick from when correcting a mis-detected receipt. */
const COMMON_CURRENCIES = [
  "SEK", "EUR", "USD", "GBP", "NOK", "DKK", "CHF", "ISK", "JPY", "THB",
  "AUD", "CAD", "PLN", "CZK", "HUF", "TRY", "SGD", "HKD", "AED", "INR",
  "MXN", "BRL", "ZAR", "NZD",
];

/** Friendly names for the OCR model that answered (from the X-Ocr-Model header). */
const OCR_MODEL_LABEL: Record<string, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  llama4: "Llama 4 Scout",
  mistral: "Mistral Small",
  llava: "LLaVA",
};

/** Pre-OCR clean-up for receipts shot in dim restaurant light. Three passes,
 *  all gentle so faint thermal print survives:
 *
 *   1. Grayscale + histogram-based auto-levels. The darkest ~0.5% of pixels
 *      become true black, the lightest ~0.5% true white. A fixed contrast
 *      multiplier (what was here before) can't pull up a photo that lives at
 *      40-160 luminance; stretching the actual range does, every time.
 *
 *   2. Adaptive gamma. After stretching we aim the mean luminance at ~140
 *      (slightly bright, where thermal print reads best). Dim photos get
 *      gamma < 1 to lift the midtones, blown-out ones get gamma > 1 to pull
 *      them back. Clamped to [0.5, 1.4] so we never invert detail.
 *
 *   3. Light unsharp mask via a separable 1-2-1 box blur. The mild edge
 *      enhancement crisps the digits without ringing. Skipped on huge
 *      images to keep capture-to-scan latency reasonable. */
function enhanceForScan(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const n = w * h;

    // Pass 1: grayscale + per-pixel luminance + 8-bit histogram.
    const lum = new Uint8ClampedArray(n);
    const hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
      lum[j] = g;
      hist[g]++;
    }

    // Percentile-based black/white points. Outliers (a few stray dark pixels
    // in a shadow, glints off cutlery) shouldn't be allowed to define "true
    // black" / "true white" — we skip the 0.5% tails.
    const tail = Math.max(1, Math.floor(n * 0.005));
    let acc = 0;
    let black = 0;
    let white = 255;
    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= tail) {
        black = i;
        break;
      }
    }
    acc = 0;
    for (let i = 255; i >= 0; i--) {
      acc += hist[i];
      if (acc >= tail) {
        white = i;
        break;
      }
    }
    // Guarantee some usable span; otherwise the LUT collapses to a binary.
    if (white - black < 40) {
      black = Math.max(0, black - 20);
      white = Math.min(255, white + 20);
    }

    // Pass 2: adaptive gamma to aim the stretched mean at ~140.
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    const meanIn = sum / n;
    const span = Math.max(1, white - black);
    const meanStretched = Math.max(1, Math.min(254, ((meanIn - black) * 255) / span));
    const targetMean = 140;
    const rawGamma = Math.log(targetMean / 255) / Math.log(meanStretched / 255);
    const gamma = Math.max(0.5, Math.min(1.4, isFinite(rawGamma) ? rawGamma : 1));

    // LUT: stretch then gamma in one table.
    const lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      const stretched = Math.max(0, Math.min(255, ((i - black) * 255) / span));
      lut[i] = (255 * Math.pow(stretched / 255, gamma)) | 0;
    }

    // Apply the LUT and produce the grayscale buffer we'll sharpen.
    const gray = new Uint8ClampedArray(n);
    for (let j = 0; j < n; j++) gray[j] = lut[lum[j]];

    // Pass 3: light unsharp mask. Skip if the image is huge — the sharpening
    // pass is the slowest part and ~6 MP * two passes can push the capture
    // delay past a second on mid-range phones. The level/gamma work is the
    // big win anyway; sharpening is icing.
    let out: Uint8ClampedArray = gray;
    if (n <= 4_500_000) {
      // Separable 1-2-1 box blur (horizontal then vertical), then combine.
      const tmp = new Uint8ClampedArray(n);
      const blurred = new Uint8ClampedArray(n);
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const l = gray[row + Math.max(0, x - 1)];
          const c = gray[row + x];
          const r = gray[row + Math.min(w - 1, x + 1)];
          tmp[row + x] = (l + 2 * c + r) >> 2;
        }
      }
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          const u = tmp[Math.max(0, y - 1) * w + x];
          const c = tmp[y * w + x];
          const d2 = tmp[Math.min(h - 1, y + 1) * w + x];
          blurred[y * w + x] = (u + 2 * c + d2) >> 2;
        }
      }
      const amount = 0.6;
      out = new Uint8ClampedArray(n);
      for (let j = 0; j < n; j++) {
        const v = gray[j] + amount * (gray[j] - blurred[j]);
        out[j] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }

    // Write the enhanced grayscale back into the RGB canvas.
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      d[i] = d[i + 1] = d[i + 2] = out[j];
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* getImageData can throw on tainted canvas — skip enhancement */
  }
}

/** Downscale a photo to keep the OCR upload small and fast. */
function fileToCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // URL.createObjectURL sidesteps the FileReader permission quirks that
    // trigger "unknown filereader" errors on Android gallery picks and on
    // iOS Safari when the file is served as a content URI or HEIC.
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not decode the image."));
    };
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      // Keep receipts detailed: faint thermal digits (e.g. 1180 vs 118) need
      // pixels, so cap the long side generously rather than at 1280.
      const maxDim = 2200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not available.")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      enhanceForScan(ctx, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = objectUrl;
  });
}

export default function Page() {
  const [lang, setLang] = useState<Lang>("sv");
  const t = translations[lang];

  const [step, setStep] = useState<Step>("capture");

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrModel, setOcrModel] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState<number | null>(null);
  // Text-row rectangles detected from the captured photo's pixels —
  // black ink on white paper makes a dark-row scan a good enough
  // approximation that we can paint REAL "found line" markers on the
  // photo while the OCR call runs in the background.
  const [detectedLines, setDetectedLines] = useState<DetectedLine[]>([]);
  // Pre-scan quality hint. Filled by analyzeImageQuality whenever a
  // new shot is committed to imageUrl, cleared when the host retakes
  // or commits to OCR. Surfaces as a non-blocking warning chip above
  // the "Read receipt" button.
  const [imageQuality, setImageQuality] = useState<ImageQuality | null>(null);
  // Set when OCR returns no items / no total, OR the API answered 502.
  // Triggers the full retake banner over the capture preview.
  const [ocrFailed, setOcrFailed] = useState(false);
  // Why we're showing the retake banner — drives different copy in
  // the failure card. "general" = couldn't read the photo at all;
  // "noPrices" = OCR found item lines but none had a price (e.g. an
  // online-order pickup slip lists the order but no money).
  const [ocrFailReason, setOcrFailReason] = useState<"general" | "noPrices">("general");
  const [scanPhase, setScanPhase] = useState(0);
  // True between OCR-complete and host-info-complete: the scan overlay keeps
  // its setup card up so the host can finish typing their name & phone
  // before the app advances to the items step.
  const [scanReady, setScanReady] = useState(false);
  // Explicit "Done" tap on the setup card. The handoff to the items step
  // waits for BOTH this and scanReady, so a host can review the scan card
  // briefly before being moved on — and so the receipt isn't half-validated
  // by the time the host is still typing their name.
  const [hostReady, setHostReady] = useState(false);
  // Setup-card dismissal: the host can tap "Klar" before the scan
  // finishes; we flash a checkmark on the button for ~250 ms, then
  // unmount the card via hostCardDismissed (the dismissal flag
  // gates the card's outer condition below). The scan keeps running
  // in the background; the existing scanReady + hostReady → "items"
  // effect handles the handoff to the verify step.
  const [hostDoneFlash, setHostDoneFlash] = useState(false);
  const [hostCardDismissed, setHostCardDismissed] = useState(false);

  // Contact Picker shortcut — Chromium on Android exposes
  // navigator.contacts.select() which pops a native sheet for the
  // host to pick their own contact card without typing. iOS Safari
  // has no equivalent (their AutoFill bar is the closest, and only
  // appears after the keyboard is open). Detect on mount and only
  // render the button when the API is actually usable so iOS hosts
  // don't see a dead button.
  type ContactsManager = { select(props: string[], opts?: { multiple?: boolean }): Promise<Array<{ name?: string[]; tel?: string[] }>> };
  const [contactsApi, setContactsApi] = useState<ContactsManager | null>(null);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & { contacts?: ContactsManager };
    if (nav.contacts && typeof nav.contacts.select === "function") {
      setContactsApi(nav.contacts);
    }
  }, []);
  async function pickContactInfo() {
    if (!contactsApi) return;
    try {
      const result = await contactsApi.select(["name", "tel"], { multiple: false });
      const pick = result[0];
      if (!pick) return;
      const name = pick.name?.find((n) => n.trim().length > 0)?.trim();
      const tel = pick.tel?.find((t) => t.trim().length > 0)?.trim();
      if (name && diners[0]?.id) updateDiner(diners[0].id, name);
      if (tel) setPayerPhone(tel);
    } catch {
      /* host cancelled or picker errored — ignore */
    }
  }
  // Tick "1 → 2 → 3 → 1" every 400 ms so the "Reading" label has a live
  // ellipsis while the host waits for OCR to catch up. Only ticks when
  // the button is in its "host committed, scan still working" state.
  const [readingDots, setReadingDots] = useState(1);
  useEffect(() => {
    if (!(hostReady && ocrLoading)) return;
    setReadingDots(1);
    const iv = setInterval(() => setReadingDots((d) => (d >= 3 ? 1 : d + 1)), 400);
    return () => clearInterval(iv);
  }, [hostReady, ocrLoading]);
  // Pan the validation step in from the right when it first mounts —
  // signals "we've moved you on to the next stage" without going back
  // to a CSS animation class that iOS Safari could try to replay. The
  // stable useCallback ref fires only on the section's mount, and the
  // imperative animation completes once and detaches itself.
  // Stash the items section's DOM node so the createRoom flow can
  // animate it out to the left when the host taps "Skapa rum" — the
  // wizard transition into the room is "old page slides left while
  // new page slides in from right", and this is the left half of
  // that pair.
  const itemsSectionRef = useRef<HTMLElement | null>(null);
  const playPanIn = useCallback((el: HTMLElement | null) => {
    itemsSectionRef.current = el;
    if (!el || typeof el.animate !== "function") return;
    el.animate(
      [
        { opacity: 0, transform: "translateX(36px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "backwards" },
    );
  }, []);
  // Defer the setup card's entrance by ~1 s so a fast scan doesn't yank a
  // form in front of the host before they've even seen the scan animation.
  const [scanCardVisible, setScanCardVisible] = useState(false);

  const [items, setItems] = useState<UiItem[]>([]);
  // True when the latest OCR pass found a tip on the receipt — either a
  // printed Dricks line or an implied tip from charged > total. Gates
  // the percentage chip strip in the totals card: if the receipt
  // already settled the tip, the host edits it directly in the row
  // above instead of being offered chips. Manual entry / fresh scans
  // start at false → chips show.
  const [ocrFoundTip, setOcrFoundTip] = useState(false);
  const [removedItems, setRemovedItems] = useState<UiItem[]>([]);
  const [undoItem, setUndoItem] = useState<UiItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // How the items list is ordered. Sort is applied at scan/toggle time so rows
  // don't reshuffle while you're editing a description.
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // "/?demo=1": load a sample order so the split flow can be tested end-to-end.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") == null) return;
    const demoItems: UiItem[] = generateDemoOrder().map((x) => ({
      id: uid(),
      description: x.d,
      priceInput: formatOre(x.o),
      sharers: [],
      shared: !!x.s,
      category: x.c,
      imgIndex: -1,
    }));
    setItems(sortByCategory(demoItems));
    const meta = randomDemoMeta(today);
    setMealLabel(meta.place);
    setEventDate(meta.date);
    setStep("items");
    // Pre-fill the host so the demo can run all the way through to room
    // creation without the user having to type a name + Swish number. Only
    // fills when the fields are still empty — won't clobber a real host
    // who happens to also append ?demo=1.
    setDiners((prev) => (prev[0]?.name?.trim() ? prev : [{ ...prev[0], name: "Demo Värd" }, ...prev.slice(1)]));
    setPayerPhone((prev) => (prev ? prev : "0701234567"));
  }, []);
  const [images, setImages] = useState<string[]>([]);
  // Foreign-currency context: amounts are always stored in SEK öre; these drive
  // the dual-currency display. null currency / rate=1 means a plain SEK receipt.
  const [currency, setCurrency] = useState<string>("SEK");
  const [fxRate, setFxRate] = useState<number | null>(1);
  const [rateApprox, setRateApprox] = useState(false);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [fxChanging, setFxChanging] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null); // öre
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  // Ring buffer of the last few language switches. When the trail ends
  // with sv → no → da → sv (the three Scandinavian sisters and back),
  // unhide the debug dialog. The button itself stays hidden — this
  // gesture is the only way in.
  const langTrailRef = useRef<Lang[]>([]);
  // Debug-only state. The buttons in the Dialogs section of the
  // debug panel flip these so we can preview each modal / banner
  // without having to walk through the live capture / scan / share
  // flow to trigger it.
  const [debugShareOpen, setDebugShareOpen] = useState(false);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const [diners, setDiners] = useState<Diner[]>([{ id: uid(), name: "" }]);
  const [payerPhone, setPayerPhone] = useState("");
  // Payout rail: defaults to Swish for Swedish users and SEPA / EPC for
  // everyone else (detected from navigator.language's region tag, with
  // a timezone fallback). The OCR currency-based override below still
  // wins once a receipt is parsed — this just keeps the setup card
  // showing the right input from the moment it pops up, since the host
  // starts typing their Swish number / IBAN before OCR finishes.
  const [payMethod, setPayMethod] = useState<"swish" | "sepa">(() => detectDefaultMethod());
  const [payeeIban, setPayeeIban] = useState("");
  const [splitId, setSplitId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [mealLabel, setMealLabel] = useState(translations.sv.mealDefault);
  const [eventDate, setEventDate] = useState(today);

  const [receiptChargedOre, setReceiptChargedOre] = useState(0);

  // Default to 6 — gives the round-table chip widget enough seats to
  // actually read as a circle from the first tap (4 chips form a
  // square, 6 round it out properly). Still a believable "small
  // dinner" size for most host cases. The +/− stepper is right
  // there, and the auto-estimate effect only fires when the value
  // is 0, so this default doesn't trigger any rebalancing.
  const [groupSize, setGroupSize] = useState(6);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  // Wizard exit animation: when createRoom flips creatingRoom true,
  // slide the items section out to the left while the RoomSkeleton
  // overlay slides in from the right. If the POST fails (creatingRoom
  // goes back to false), play the inverse so the section returns to
  // its resting position. The "have we ever fired" ref guards the
  // initial-mount run from playing a phantom reverse animation.
  const hasExitedRef = useRef(false);
  useEffect(() => {
    const el = itemsSectionRef.current;
    if (!el || typeof el.animate !== "function") return;
    if (creatingRoom) {
      hasExitedRef.current = true;
      el.animate(
        [
          { opacity: 1, transform: "translateX(0)" },
          { opacity: 0, transform: "translateX(-100%)" },
        ],
        { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "forwards" },
      );
    } else if (hasExitedRef.current) {
      el.animate(
        [
          { opacity: 0, transform: "translateX(-100%)" },
          { opacity: 1, transform: "translateX(0)" },
        ],
        { duration: 280, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)", fill: "forwards" },
      );
    }
  }, [creatingRoom]);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  // Some phones expose a `torch` constraint on the rear camera; we light it
  // up so the receipt stays legible in dim restaurants.
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  // Default is single-shot: take a photo, see a preview, commit. Only when
  // the host opts into another shot do we restart the camera with the
  // alignment overlay on top.
  const [wantMoreShots, setWantMoreShots] = useState(false);
  // Multi-shot capture: each new shot stacks onto pendingShots until the
  // host commits to OCR. For long receipts a strip of the previous shot's
  // bottom is overlaid at the top of the live viewfinder so they can line
  // up the next shot's top edge with where the previous one left off.
  const [pendingShots, setPendingShots] = useState<string[]>([]);
  const router = useRouter();

  // Switch language; carry over the meal label only if it is still the
  // untouched default, and remember the choice.
  const applyLang = useCallback((next: Lang, prev: Lang) => {
    setMealLabel((cur) => (cur === translations[prev].mealDefault ? translations[next].mealDefault : cur));
    setLang(next);
    if (typeof document !== "undefined") document.documentElement.lang = next;
    try {
      localStorage.setItem("swisher-lang", next);
    } catch {
      /* storage unavailable */
    }
    if (next !== prev) {
      const trail = langTrailRef.current;
      if (trail.length === 0) trail.push(prev);
      trail.push(next);
      if (trail.length > 4) trail.splice(0, trail.length - 4);
      if (
        trail.length === 4 &&
        trail[0] === "sv" && trail[1] === "no" &&
        trail[2] === "da" && trail[3] === "sv"
      ) {
        setDebugOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    // First load picks the language from storage if pinned, otherwise
    // matches the browser's preferred language to one of the locales
    // we support. Falls back to "sv" (the app's default) when neither
    // signal lands on a supported code.
    const detected = detectDefaultLang();
    if (detected !== "sv") applyLang(detected, "sv");
  }, [applyLang]);

  const message = useMemo(
    () => `${mealLabel} ${eventDate}`.trim().slice(0, 50),
    [mealLabel, eventDate],
  );

  const isForeign = currency !== "SEK";
  const fx: Fx = isForeign && fxRate ? { currency, rate: fxRate, approx: rateApprox } : null;
  const rateMissing = isForeign && !fxRate;
  // SEPA/EPC settles in euros, so it's only offered for euro receipts.
  const sepaAvailable = currency === "EUR" && !!fxRate;
  const phoneValid = isValidPhone(payerPhone);
  const ibanValid = isValidIban(payeeIban);
  const ibanCc = payeeIban.slice(0, 2);
  const ibanCountryLabel = /^[A-Z]{2}$/.test(ibanCc) ? `${flagEmoji(ibanCc)} ${regionName(ibanCc, lang)}` : "";
  // Pick the actual payment method from whatever the host has typed.
  // SEPA wins if (a) EUR receipt + IBAN on hand, and either the host
  // explicitly toggled to SEPA via payMethod or they haven't supplied
  // a Swish number. Otherwise Swish — which works for EUR receipts
  // too: every amount is stored in SEK öre under the hood (the FX
  // rate is captured from the receipt), so the per-person Swish
  // links pay the host in SEK at the rate the receipt was scanned at.
  const method: "swish" | "sepa" =
    sepaAvailable && ibanValid && (payMethod === "sepa" || !phoneValid)
      ? "sepa"
      : "swish";
  // The invite gate is "the host can be paid somehow" — either a
  // valid Swish number OR a valid IBAN (only counts on EUR receipts
  // where SEPA is actually usable). Old logic forced IBAN once the
  // receipt currency landed on EUR, which disabled the invite for
  // Swedish hosts who only have a phone.
  const payDestOk = phoneValid || (sepaAvailable && ibanValid);
  const eurCentsFor = (ore: number) => (fxRate ? Math.round(ore / fxRate) : 0);
  const currencyOptions = Array.from(new Set([currency, ...COMMON_CURRENCIES]));

  // Host corrects a mis-detected currency: re-fetch its rate for the receipt
  // date and re-scale every amount (recovering the printed figure, then
  // converting it at the new rate). All amounts stay stored as SEK öre.
  async function changeCurrency(next: string) {
    if (next === currency || fxChanging) return;
    const oldRate = fxRate ?? 1;
    let newRate: number | null = 1;
    let approx = false;
    let date = rateDate;
    if (next === "SEK") {
      newRate = 1;
      date = null;
    } else {
      setFxChanging(true);
      try {
        const r = await fetch(`/api/fx?currency=${next}&date=${encodeURIComponent(eventDate)}`).then((x) => x.json());
        if (r && typeof r.rate === "number" && r.rate > 0) {
          newRate = r.rate;
          approx = r.approx === true;
          if (typeof r.date === "string") date = r.date;
        } else {
          newRate = null;
        }
      } catch {
        newRate = null;
      } finally {
        setFxChanging(false);
      }
    }
    const factor = newRate && oldRate ? newRate / oldRate : null;
    if (factor && factor > 0 && Math.abs(factor - 1) > 1e-9) {
      const rescale = (s: string) => {
        const ore = parseAmountToOre(s);
        return ore == null ? s : formatOre(Math.round(ore * factor));
      };
      setItems((prev) => prev.map((it) => ({ ...it, priceInput: rescale(it.priceInput) })));
      setReceiptTotal((v) => (v == null ? v : Math.round(v * factor)));
      setReceiptChargedOre((v) => Math.round(v * factor));
    }
    setCurrency(next);
    setFxRate(newRate);
    setRateApprox(approx);
    setRateDate(date);
    setPayMethod(next === "EUR" ? "sepa" : "swish");
  }

  // Cycle the scanning status text while OCR runs.
  useEffect(() => {
    if (!ocrLoading) return;
    setScanPhase(0);
    const iv = setInterval(() => setScanPhase((p) => p + 1), 900);
    return () => clearInterval(iv);
  }, [ocrLoading]);

  // Detect text rows in the captured photo as soon as OCR kicks off —
  // shows up as a stream of pink rectangles laid down on the receipt
  // while the model is still working. Reset on each new scan / when
  // we leave the loading state so the next photo gets fresh markers.
  useEffect(() => {
    if (!ocrLoading || !imageUrl) {
      setDetectedLines([]);
      return;
    }
    let cancelled = false;
    detectTextLines(imageUrl).then((lines) => {
      if (!cancelled) setDetectedLines(lines);
    });
    return () => { cancelled = true; };
  }, [ocrLoading, imageUrl]);

  // Show the setup card 1 s into the scan (just long enough for the user to
  // register "okay it's scanning"). Cleared when the host actually leaves
  // the capture step.
  useEffect(() => {
    if (!ocrLoading) {
      setScanCardVisible(false);
      return;
    }
    // Reset the dismiss flag on every new scan so the setup card
    // can pop again for a fresh receipt — without this, the second
    // scan would silently skip showing the card because the host
    // dismissed it on the previous run.
    setHostCardDismissed(false);
    const id = setTimeout(() => setScanCardVisible(true), 1000);
    return () => clearTimeout(id);
  }, [ocrLoading]);

  // Once both halves are committed — OCR finished AND the host pressed Done
  // on the setup card — advance to the items step. We still re-validate the
  // form on the way out so a Done tap followed by edits to an invalid value
  // can't sneak through, but the wait-on-explicit-tap is the meaningful
  // gate now.
  useEffect(() => {
    if (!scanReady || !hostReady) return;
    const hasName = (diners[0]?.name?.trim().length ?? 0) > 0;
    const hasPhone = isValidPhone(payerPhone);
    const hasGroup = groupSize >= 2;
    if (hasName && hasPhone && hasGroup) {
      setScanReady(false);
      setHostReady(false);
      setStep("items");
    }
  }, [scanReady, hostReady, diners, payerPhone, groupSize]);

  // Remember the host across sessions so they don't retype their name/number.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("swisher-host") || "null");
      if (saved?.name) setDiners((prev) => prev.map((d, i) => (i === 0 ? { ...d, name: String(saved.name) } : d)));
      if (saved?.number) setPayerPhone(String(saved.number));
      if (saved?.iban) setPayeeIban(normalizeIban(String(saved.iban)));
    } catch {
      /* ignore */
    }
  }, []);

  // Remember the host's details (name, Swish number, IBAN) so they only ever
  // type them once. Merge so filling one field doesn't wipe a saved other.
  useEffect(() => {
    const name = diners[0]?.name?.trim();
    if (!name) return;
    try {
      const prev = JSON.parse(localStorage.getItem("swisher-host") || "{}");
      const next: Record<string, string> = { ...prev, name };
      if (isValidPhone(payerPhone)) next.number = payerPhone;
      if (isValidIban(payeeIban)) next.iban = normalizeIban(payeeIban);
      localStorage.setItem("swisher-host", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, [diners, payerPhone, payeeIban]);

  // --- capture ---------------------------------------------------------------
  // Live camera preview on the capture step. Falls back silently (cameraActive
  // stays false) when there's no camera or permission is denied.
  // We only stream when there's actually a viewfinder on screen: empty
  // pendingShots (first shot) or wantMoreShots (host opted into multi-shot).
  const wantsLiveCamera =
    step === "capture" && !imageUrl && (pendingShots.length === 0 || wantMoreShots);
  useEffect(() => {
    if (!wantsLiveCamera) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          // Ask for the smoothest preview the device will give us: an
          // ideal 60 fps with 30 as the floor, plus a 720 p target.
          // Both ends are `ideal`, so a device that can't match (or a
          // browser that caps at 30) falls back gracefully without
          // breaking the stream. Keeping the resolution at 720 p leaves
          // headroom for the higher frame rate on phones whose rear
          // cameras don't sustain 60 fps at full 1080 p.
          video: {
            facingMode: { ideal: "environment" },
            frameRate: { ideal: 60, min: 30 },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        setTorchAvailable(!!caps.torch);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch {
            /* autoplay may be deferred; the element still shows the stream */
          }
        }
        setCameraActive(true);
      } catch {
        setCameraActive(false);
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraActive(false);
      setTorchAvailable(false);
      setTorchOn(false);
    };
  }, [wantsLiveCamera]);

  // Belt-and-braces: as soon as we leave the capture step, kill any
  // residual MediaStream so iOS doesn't keep the camera indicator (or
  // re-prompt for permission) once the host has moved on to the items
  // step. wantsLiveCamera should already turn off in that case, but
  // this gives us a step-level guarantee that doesn't depend on the
  // sub-conditions.
  useEffect(() => {
    if (step === "capture") return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (cameraActive) setCameraActive(false);
    if (torchAvailable) setTorchAvailable(false);
    if (torchOn) setTorchOn(false);
  }, [step, cameraActive, torchAvailable, torchOn]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as unknown as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  function retakeShot() {
    setImageUrl(null);
    setOcrError(null);
    setOcrFailed(false);
    setImageQuality(null);
  }
  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    enhanceForScan(ctx, canvas.width, canvas.height);
    setOcrError(null);
    setOcrFailed(false);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    // Stack the new shot; the camera stays live so the user can either
    // take another (long receipt) or tap "Read receipt" to commit.
    setPendingShots((prev) => [...prev, dataUrl]);
    // Fast Laplacian-variance / std-dev check on a 200-px sample.
    // Non-blocking — fires after the shutter so the capture itself
    // stays snappy, then surfaces a hint chip above the bottom row
    // before the host taps "Read receipt".
    void analyzeImageQuality(dataUrl).then(setImageQuality);
  }
  async function finishCapture() {
    if (pendingShots.length === 0 || ocrLoading) return;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
    setTorchOn(false);
    setWantMoreShots(false);
    const shots = pendingShots;
    setPendingShots([]);
    // Cap at 8 to keep the Claude bill bounded even if someone takes lots
    // of shots; in practice 3-4 covers any real receipt.
    const MAX_FRAMES = 8;
    const sampled = shots.length <= MAX_FRAMES
      ? shots
      : Array.from({ length: MAX_FRAMES }, (_, i) =>
          shots[Math.round((i * (shots.length - 1)) / (MAX_FRAMES - 1))],
        );
    setImageUrl(sampled[0]);
    if (sampled.length === 1) await runOcr(sampled[0]);
    else await runOcr(sampled[0], { frames: sampled });
  }
  function discardPendingShots() {
    setPendingShots([]);
    setWantMoreShots(false);
  }

  const lastShot = pendingShots[pendingShots.length - 1];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setOcrError(null);
    setOcrFailed(false);
    try {
      // First file becomes the primary image; any extra files (host
      // picked multiple pages from the gallery in one go) get fed in
      // as appended frames so the OCR sees the whole multi-page
      // receipt at once.
      const [first, ...rest] = files;
      const primary = await fileToCompressedDataUrl(first);
      setImageUrl(primary);
      void analyzeImageQuality(primary).then(setImageQuality);
      if (rest.length === 0) {
        runOcr(primary);
        return;
      }
      const restUrls = await Promise.all(rest.map(fileToCompressedDataUrl));
      runOcr(primary, { frames: [primary, ...restUrls] });
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Could not read the image.");
    }
  }

  async function runOcr(
    img: string = imageUrl ?? "",
    opts: { append?: boolean; frames?: string[] } = {},
  ) {
    // Multi-frame (panorama) path: opts.frames carries the full ordered list;
    // we still set img as the "primary" so all the imageUrl-dependent UI
    // keeps working.
    const frames = opts.frames && opts.frames.length > 0 ? opts.frames : [img];
    const primary = frames[0];
    if (!primary || ocrLoading) return;
    const append = opts.append === true;
    const imgIndex = append ? images.length : 0;
    setOcrLoading(true);
    setOcrError(null);
    setOcrFailed(false);
    setScanCount(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frames.length > 1 ? { images: frames } : { image: primary }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed.");
      setOcrModel(res.headers.get("X-Ocr-Model"));
      const mapped: UiItem[] = (
        data.items as { description: string; price: number; shared?: boolean; category?: string; emoji?: string; y?: number }[]
      ).map((it) => ({
        id: uid(),
        description: it.description,
        priceInput: formatOre(Math.round(it.price * 100)),
        sharers: [],
        // Nothing is auto-marked as shared anymore — the host explicitly
        // toggles each row. The items step still surfaces a "maybe shared"
        // hint via sharedSuggestion for high-probability candidates.
        shared: false,
        category: it.category ?? "",
        emoji: it.emoji,
        imgIndex,
        y: typeof it.y === "number" && Number.isFinite(it.y) ? Math.max(0, Math.min(1, it.y / 100)) : undefined,
      }));
      // For the multi-frame path keep every captured frame so the receipt
      // viewer can show all of them; the single-frame paths behave as before.
      setImages((prev) => (append ? [...prev, primary] : frames));
      setOcrLoading(false);

      if (append) {
        // Long receipts get scanned in overlapping photos; drop items in this
        // batch that already appeared in earlier batches with the same name and
        // price (multiset, so a legitimate triple "3× Bryggkaffe" stays a triple).
        setItems((prev) => {
          const keyOf = (it: UiItem) => `${(it.description ?? "").trim().toLowerCase()}|${parseAmountToOre(it.priceInput) ?? 0}`;
          const budget = new Map<string, number>();
          for (const it of prev) budget.set(keyOf(it), (budget.get(keyOf(it)) ?? 0) + 1);
          const filtered = mapped.filter((it) => {
            const k = keyOf(it);
            const left = budget.get(k) ?? 0;
            if (left > 0) {
              budget.set(k, left - 1);
              return false;
            }
            return true;
          });
          return [...prev, ...filtered];
        });
        return;
      }

      const cur = typeof data.currency === "string" && /^[A-Z]{3}$/.test(data.currency) ? data.currency : "SEK";
      setCurrency(cur);
      setPayMethod(cur === "EUR" ? "sepa" : "swish");
      setFxRate(typeof data.rate === "number" && data.rate > 0 ? data.rate : cur === "SEK" ? 1 : null);
      setRateApprox(data.rateApprox === true);
      setRateDate(typeof data.rateDate === "string" ? data.rateDate : null);
      setCountry(typeof data.country === "string" && /^[A-Z]{2}$/.test(data.country) ? data.country : null);

      const totalOre = typeof data.total === "number" ? Math.round(data.total * 100) : null;
      const chargedOre = typeof data.charged === "number" && data.charged > 0 ? Math.round(data.charged * 100) : 0;
      const dricksOre = typeof data.dricks === "number" && data.dricks > 0 ? Math.round(data.dricks * 100) : 0;
      // Tip: a printed tip line if there is one, otherwise the excess of the
      // actual card charge over the bill (host rounded up / tipped at the terminal).
      const billOre = totalOre ?? mapped.reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
      const impliedTipOre = chargedOre - billOre >= 100 ? chargedOre - billOre : 0;
      const tipOre = dricksOre > 0 ? dricksOre : impliedTipOre;
      setOcrFoundTip(tipOre > 0);
      // Add the tip as a shared row so it shows in the list and splits evenly.
      if (tipOre > 0) {
        mapped.push({
          id: uid(),
          description: t.tip,
          priceInput: formatOre(tipOre),
          sharers: [],
          shared: true,
          category: "other",
          imgIndex: -1,
          isTip: true,
        });
      }
      // Keep receipt order — the OCR returns items in the order they
      // appear on the printed bill. sortByCategory used to group
      // them, but hosts wanted to verify against the physical receipt
      // top-to-bottom, so we stopped re-ordering.
      setItems(mapped);
      setRemovedItems([]);
      setUndoItem(null);
      // Reset to the default of 4 for the new receipt — same baseline as the
      // initial state.
      setGroupSize(6);
      setReceiptTotal(totalOre);
      setReceiptChargedOre(chargedOre);
      if (typeof data.place === "string" && data.place.trim()) setMealLabel(data.place.trim().slice(0, 40));
      // Only trust a plausible receipt date (a mis-read year shouldn't set 2107
      // or 1917); otherwise keep today's default.
      if (
        typeof data.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.date) &&
        data.date >= "2000-01-01" &&
        data.date <= today
      ) {
        setEventDate(data.date);
      }
      // Tick a counter through the found rows, then move on.
      const n = mapped.length;
      if (n === 0) {
        // OCR returned without line items — either the model genuinely
        // couldn't find any (poor photo) or the response was a partial
        // success (just a total). Treat both as "need to retake" so
        // the host doesn't land on a blank items list wondering what
        // happened.
        setOcrLoading(false);
        setOcrFailReason("general");
        setOcrFailed(true);
        return;
      }
      // Items came back but every line is priced at 0 — typical of an
      // online-order takeaway slip that lists "1 × Sharing combo / 2 ×
      // Flamed salmon" but no money. Splitting a free meal isn't a thing
      // we can do, so flip to the failure card and ask the host to
      // photograph something with prices on it.
      const hasAnyRealPrice = mapped.some(
        (it) => !it.isTip && (parseAmountToOre(it.priceInput) ?? 0) > 0,
      );
      if (!hasAnyRealPrice) {
        setOcrLoading(false);
        setOcrFailReason("noPrices");
        setOcrFailed(true);
        return;
      }
      setScanCount(0);
      // Run the count-up off requestAnimationFrame instead of
      // setInterval. iOS Safari throttles setInterval aggressively
      // when the camera is live and the device is mildly busy —
      // ticks can collapse into a single render and the host sees
      // "0 rätter tillagda" the whole way through. rAF runs on the
      // compositor's clock so we get one update per visible frame,
      // and the eased progress lands exactly on n at the duration
      // boundary.
      const targetCount = n;
      const duration = Math.max(450, Math.min(900, targetCount * 90));
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setScanCount(Math.round(eased * targetCount));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          setTimeout(() => {
            setScanCount(null);
            // Hand off to the useEffect below: it advances to "items"
            // only once the host has typed a name and a valid phone, so
            // a host mid-typing isn't yanked off this screen.
            setScanReady(true);
          }, 500);
        }
      };
      requestAnimationFrame(step);
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR failed.");
      setOcrFailReason("general");
      setOcrFailed(true);
      setOcrLoading(false);
    }
  }

  async function onAppendFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      // Multiple-page receipt picked from the gallery: append each
      // page in order so the OCR sees the whole thing.
      for (const file of files) {
        const dataUrl = await fileToCompressedDataUrl(file);
        await runOcr(dataUrl, { append: true });
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Could not read the image.");
    }
  }

  function skipToManual() {
    if (items.length === 0) {
      setItems([{ id: uid(), description: "", priceInput: "", sharers: [], shared: false, category: "", imgIndex: -1 }]);
    }
    setOcrFoundTip(false);
    setStep("items");
  }

  // --- items -----------------------------------------------------------------
  const updateItem = (id: string, patch: Partial<UiItem>) =>
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        // Editing the text invalidates the model's emoji guess for the old text,
        // so drop it and let the icon re-derive live from the new description.
        if ("description" in patch) next.emoji = undefined;
        return next;
      }),
    );
  // Identical OCR copies group into one card with an "×N" badge (mirrors the
  // diner view). Editing the card propagates to every copy via updateGroup so
  // they stay in lockstep; removing a copy still soft-deletes one at a time.
  const itemGroupKey = (it: UiItem) =>
    `${it.description.toLowerCase().trim()}|${it.priceInput}|${it.shared ? 1 : 0}|${it.shareCount ?? ""}|${it.category ?? ""}|${it.isTip ? 1 : 0}`;
  const updateGroup = (rep: UiItem, patch: Partial<UiItem>) => {
    const key = itemGroupKey(rep);
    setItems((prev) =>
      prev.map((it) => {
        if (itemGroupKey(it) !== key) return it;
        const next = { ...it, ...patch };
        if ("description" in patch) next.emoji = undefined;
        return next;
      }),
    );
  };
  const addItem = () =>
    setItems((prev) => [...prev, { id: uid(), description: "", priceInput: "", sharers: [], shared: false, category: "", imgIndex: -1 }]);
  /**
   * Set the dricks row to a percentage of the food subtotal, rounded to the
   * nearest krona. Useful when the tip was added at the card terminal so the
   * receipt itself never printed a Dricks line — the host taps "10 %" instead
   * of doing the maths. pct === 0 strips any tip row entirely. A new tip row
   * is created if one isn't already there; otherwise we update the existing
   * one in place so a hand-edited description is preserved.
   */
  const applyTipPercent = (pct: number) => {
    setItems((prev) => {
      const foodOre = prev
        .filter((it) => !it.isTip)
        .reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
      if (pct === 0) return prev.filter((it) => !it.isTip);
      const targetOre = Math.max(0, Math.round((foodOre * pct) / 100 / 100) * 100);
      if (targetOre === 0) return prev.filter((it) => !it.isTip);
      const existing = prev.find((it) => it.isTip);
      if (existing) {
        return prev.map((it) =>
          it.id === existing.id ? { ...it, priceInput: formatOre(targetOre) } : it,
        );
      }
      return [
        ...prev,
        {
          id: uid(),
          description: t.tip,
          priceInput: formatOre(targetOre),
          sharers: [],
          shared: true,
          category: "other",
          imgIndex: -1,
          isTip: true,
        },
      ];
    });
  };
  // When a row is shared we display the per-share price in its price
  // input (with the stepper sitting just below it), but priceInput
  // itself still stores the row TOTAL — every downstream calculation
  // (room POST, computeShares, billOre, …) keeps treating it as the
  // total. This draft buffers the user's keystrokes while they're
  // editing so partial / decimal-point inputs don't get re-formatted
  // mid-stroke; commit happens on blur, converting share → total via
  // the current divisor.
  const [priceDraft, setPriceDraft] = useState<{ id: string; value: string } | null>(null);
  function commitPriceDraft(rep: UiItem) {
    if (!priceDraft || priceDraft.id !== rep.id) return;
    const parsed = parseAmountToOre(priceDraft.value);
    if (parsed != null) {
      const divisor = itemDivisorFor(rep);
      const newTotal = rep.shared ? parsed * divisor : parsed;
      updateGroup(rep, { priceInput: formatOre(newTotal) });
    }
    setPriceDraft(null);
  }
  // Soft-delete: move to the removed list (kept out of the totals/shares), with
  // a transient undo and a persistent collapsed list to restore from.
  // Remember each removed row's original index in items[] so undo can
  // drop the row back where it came from instead of always at the
  // end. Kept as a ref so this state doesn't itself trigger renders.
  const removedIndicesRef = useRef<Map<string, number>>(new Map());
  // FLIP slot for the validation row list — rememberRowPositions()
  // captures every visible row's top BEFORE a state change, then the
  // useLayoutEffect below measures the new tops and slides each row
  // from its old position to its new one. Without this, deleting /
  // restoring a row would just snap the rest of the list into place.
  const rowFlipRef = useRef<Map<string, number> | null>(null);
  function rememberRowPositions(skipId?: string) {
    if (typeof document === "undefined") return;
    const positions = new Map<string, number>();
    for (const it of items) {
      if (skipId && it.id === skipId) continue;
      const el = document.querySelector(`[data-row-id="${it.id}"]`);
      if (el instanceof HTMLElement) positions.set(it.id, el.getBoundingClientRect().top);
    }
    rowFlipRef.current = positions;
  }
  useLayoutEffect(() => {
    const old = rowFlipRef.current;
    if (!old) return;
    rowFlipRef.current = null;
    for (const [id, oldTop] of old) {
      const el = document.querySelector(`[data-row-id="${id}"]`);
      if (!(el instanceof HTMLElement) || typeof el.animate !== "function") continue;
      const dy = oldTop - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) continue;
      el.animate(
        [
          { transform: `translateY(${dy}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 260, easing: "cubic-bezier(0.32, 0.72, 0.36, 1)" },
      );
    }
  }, [items]);

  const removeItem = async (id: string) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    // Slide-and-fade the row out before dropping it from state so the
    // delete feels like a deliberate motion instead of a pop. WAAPI
    // on the wrapper marked with data-row-id; if the node's missing
    // or the browser can't animate we just fall through to the
    // immediate setItems. 200 ms keeps it punchy.
    const el = typeof document !== "undefined"
      ? document.querySelector(`[data-row-id="${id}"]`)
      : null;
    if (el instanceof HTMLElement && typeof el.animate === "function") {
      try {
        await el.animate(
          [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: "translateX(-24px)" },
          ],
          { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" },
        ).finished;
      } catch {
        /* animation cancelled — fall through to the state update */
      }
    }
    // Capture sibling positions BEFORE the splice so the FLIP effect
    // above can slide them up to close the gap. Original index is
    // stashed so restore can put the row back in the same slot.
    const originalIndex = items.findIndex((x) => x.id === id);
    if (originalIndex >= 0) removedIndicesRef.current.set(id, originalIndex);
    rememberRowPositions(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    setRemovedItems((r) => [it, ...r.filter((x) => x.id !== id)]);
    setUndoItem(it);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), 6000);
  };
  const restoreItem = (id: string) => {
    const it = removedItems.find((x) => x.id === id);
    if (!it) return;
    const at = removedIndicesRef.current.get(id);
    removedIndicesRef.current.delete(id);
    rememberRowPositions();
    setRemovedItems((r) => r.filter((x) => x.id !== id));
    setItems((prev) => {
      const next = [...prev];
      const insertAt = at != null ? Math.min(Math.max(0, at), next.length) : next.length;
      next.splice(insertAt, 0, it);
      return next;
    });
    setUndoItem((u) => (u?.id === id ? null : u));
  };

  const updateDiner = (id: string, name: string) =>
    setDiners((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)));
  const addDiner = () => setDiners((prev) => [...prev, { id: uid(), name: "" }]);
  const removeDiner = (id: string) => {
    setDiners((prev) => prev.filter((d) => d.id !== id));
    setItems((prev) => prev.map((it) => ({ ...it, sharers: it.sharers.filter((s) => s !== id) })));
  };

  const namedDiners = diners.filter((d) => d.name.trim());
  const validItems = items.filter((it) => (parseAmountToOre(it.priceInput) ?? 0) > 0);
  // The tip is its own shared row; keep it out of the food total and the
  // bill reconciliation, and split it equally via tipOre instead.
  const foodItems = validItems.filter((it) => !it.isTip);
  const tipOre = validItems
    .filter((it) => it.isTip)
    .reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
  const itemsSumOre = foodItems.reduce((acc, it) => acc + (parseAmountToOre(it.priceInput) ?? 0), 0);
  // Resolve which preset chip (0/5/10/15 %) matches the current tip
  // amount, so we can highlight it. Returns -1 (no chip highlighted)
  // when the host typed a custom number that lands between presets.
  const currentTipPct = (() => {
    if (tipOre === 0) return 0;
    if (itemsSumOre <= 0) return -1;
    const pct = (tipOre * 100) / itemsSumOre;
    for (const preset of [5, 10, 15]) {
      // We round the tip to whole kronor, so a 1-krona drift on either
      // side of the exact percentage still counts as the same preset.
      const presetOre = Math.round((itemsSumOre * preset) / 100 / 100) * 100;
      if (Math.abs(presetOre - tipOre) < 100 && Math.abs(pct - preset) < 1) return preset;
    }
    return -1;
  })();
  // The scanned items should add up to the printed bill total (the tip is added
  // on top via the card charge, not part of the bill). Allow up to 1 kr of slack
  // for Swedish öre rounding (öresavrundning).
  const totalDiffOre = receiptTotal === null ? 0 : receiptTotal - itemsSumOre;
  const totalReconciles = receiptTotal === null || Math.abs(totalDiffOre) < 100;
  const hasSharedItems = foodItems.some((it) => it.shared);
  // Group size lives in useState (defaulting to 4) and is the only
  // seed we use. The old auto-estimate effect — which guessed a group
  // size from category counts the moment a shared row appeared — was
  // overwriting the host's explicit pick in edge cases, so it's gone.

  const itemsStepValid =
    validItems.length > 0 && namedDiners.length >= 2 && payDestOk;

  // --- assign ----------------------------------------------------------------
  function toggleSharer(itemId: string, dinerId: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const has = it.sharers.includes(dinerId);
        return { ...it, sharers: has ? it.sharers.filter((s) => s !== dinerId) : [...it.sharers, dinerId] };
      }),
    );
  }
  function assignAllTo(itemId: string) {
    const everyone = namedDiners.map((d) => d.id);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const allSet = everyone.every((id) => it.sharers.includes(id));
        return { ...it, sharers: allSet ? [] : everyone };
      }),
    );
  }
  function spreadEverything() {
    const everyone = namedDiners.map((d) => d.id);
    setItems((prev) => prev.map((it) => ({ ...it, shared: false, sharers: everyone })));
  }
  function toggleShared(itemId: string) {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, shared: !it.shared, sharers: [], shareCount: undefined } : it)),
    );
  }
  // Ways a shared item splits: its own count (capped to groupSize when the
  // host has declared one), else the group size, else the number of diners —
  // never below 2. The cap prevents a stale shareCount (frozen when groupSize
  // was larger) from exceeding the current group size.
  const itemDivisorFor = (it: UiItem) => {
    const fallback = groupSize > 0 ? groupSize : namedDiners.length;
    const raw = it.shareCount && it.shareCount > 0 ? it.shareCount : fallback;
    return Math.max(2, groupSize > 0 ? Math.min(raw, groupSize) : raw);
  };
  const setShareCount = (id: string, n: number) => {
    const clamped = Math.max(2, Math.min(Math.max(2, groupSize || 50), n));
    // Save undefined (= "same as group, follow it") rather than freezing the
    // current groupSize as an explicit value — otherwise a later groupSize
    // change would leave the item stuck at the old count.
    updateItem(id, { shareCount: groupSize > 0 && clamped >= groupSize ? undefined : clamped });
  };

  // --- live room -------------------------------------------------------------
  // Empty name is fine — we fall back to the playful t.genericHostName
  // placeholder when creating the room, so the host doesn't have to
  // type anything if they don't want to.
  const roomReady = validItems.length > 0 && payDestOk;

  function createRoom() {
    if (!roomReady || creatingRoom) return;
    setCreatingRoom(true);
    setRoomError(null);
    try {
      // Items page has every field the DO needs — generate the room
      // code + host id + per-item ids client-side, build the matching
      // optimistic state, and stash both that AND the POST payload
      // for the room page to replay. The server respects the supplied
      // ids, so the bootstrap state lines up exactly with what
      // eventually lands in storage — no first-poll jiggle.
      const id = generateRoomCode();
      const hostId = crypto.randomUUID();
      const optimisticPayeeName = diners[0].name.trim() || t.genericHostName;
      const optimisticPayeeNumber = payerPhone;
      const optimisticPayeeIban = method === "sepa" ? normalizeIban(payeeIban) : "";
      const itemsPayload = foodItems.map((it) => ({
        id: crypto.randomUUID(),
        description: it.description.trim() || t.rowFallback,
        priceOre: parseAmountToOre(it.priceInput) ?? 0,
        category: categoryFor(it.description, it.category),
        emoji: it.emoji,
        shared: it.shared,
        // Freeze the group size onto each shared item so the room uses
        // it as the divisor — otherwise the room falls back to
        // "current people in the room", which is just the host (→ 2)
        // until others join.
        shareCount:
          it.shareCount && it.shareCount > 0
            ? it.shareCount
            : it.shared && groupSize > 0 ? groupSize : undefined,
      }));
      const optimistic = buildOptimisticRoomState({
        id,
        hostId,
        payeeName: optimisticPayeeName,
        payeeNumber: optimisticPayeeNumber,
        method,
        payeeIban: optimisticPayeeIban,
        message,
        place: mealLabel.trim(),
        date: eventDate,
        tipOre,
        currency,
        rate: fxRate ?? 1,
        country: country ?? "",
        imageCount: images.slice(0, 5).length,
        groupSize: groupSize >= 2 ? groupSize : undefined,
        items: itemsPayload,
      });
      const pending: PendingCreatePayload = {
        id,
        hostId,
        payeeName: optimisticPayeeName,
        payeeNumber: optimisticPayeeNumber,
        message,
        method,
        payeeIban: optimisticPayeeIban,
        place: mealLabel.trim(),
        date: eventDate,
        tipOre,
        currency,
        rate: fxRate ?? 1,
        country: country ?? "",
        images: images.slice(0, 5),
        groupSize: groupSize >= 2 ? groupSize : undefined,
        items: itemsPayload,
      };
      try {
        localStorage.setItem(`swisher-room:${id}`, hostId);
        sessionStorage.setItem(`kvitt-room-bootstrap:${id}`, JSON.stringify(optimistic));
        sessionStorage.setItem(pendingCreateKey(id), JSON.stringify(pending));
      } catch {
        /* storage unavailable */
      }
      addHistory({ id, place: mealLabel.trim(), date: eventDate, role: "host" });
      // Replace, not push: the items/setup step shouldn't be reachable
      // via the back button once a room exists. ?invite=1 pops the
      // QR/share dialog straight away; ?prewarmed=1 tells the room
      // page to skip its slide-in.
      router.replace(`/room/${id}?invite=1&prewarmed=1`);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : "Could not create the room.");
      setCreatingRoom(false);
    }
  }

  // --- compute ---------------------------------------------------------------
  const lineItems: LineItem[] = useMemo(
    () =>
      foodItems.map((it) => ({
        id: it.id,
        description: it.description,
        priceOre: parseAmountToOre(it.priceInput) ?? 0,
        sharers: it.sharers,
        shared: it.shared,
        shareCount: it.shareCount,
      })),
    [foodItems],
  );

  const { shares, unassignedOre } = useMemo(
    () => computeShares(lineItems, namedDiners, tipOre, groupSize),
    [lineItems, namedDiners, tipOre, groupSize],
  );

  // Collapse identical OCR copies into display groups. The display order is the
  // first appearance of each group, so editing doesn't make rows jump around.
  const itemGroups = useMemo(() => {
    const groups: UiItem[][] = [];
    const indexOf = new Map<string, number>();
    for (const it of items) {
      const key = itemGroupKey(it);
      const i = indexOf.get(key);
      if (i === undefined) {
        indexOf.set(key, groups.length);
        groups.push([it]);
      } else {
        groups[i].push(it);
      }
    }
    return groups;
    // itemGroupKey is referentially stable (function expression captured above);
    // the only input that matters is `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const payer = namedDiners[0];
  const normalizedPayer = normalizePhone(payerPhone) ?? "";
  const assignedTotalOre = shares.reduce((acc, s) => acc + s.totalOre, 0);

  // Persist a local (no-room) split so it lands in history and the host can
  // reopen it to show the QR codes again and track who's paid.
  function persistLocalSplit() {
    const payees = shares
      .filter((s) => s.dinerId !== payer?.id && s.totalOre > 0)
      .map((s) => ({ id: s.dinerId, name: s.name, totalOre: s.totalOre }));
    if (payees.length === 0) return;
    let id = splitId;
    if (!id) {
      id = uid();
      setSplitId(id);
    }
    const prev = readLocalSplit(id);
    saveLocalSplit({
      id,
      createdAt: prev?.createdAt ?? Date.now(),
      place: mealLabel.trim(),
      date: eventDate,
      message,
      currency,
      rate: fxRate ?? 1,
      country: country ?? "",
      method,
      payeeName: payer?.name ?? "",
      payeeNumber: normalizedPayer,
      payeeIban: method === "sepa" ? normalizeIban(payeeIban) : "",
      shares: payees,
      paidBy: prev?.paidBy ?? [],
    });
    addHistory({ id, place: mealLabel.trim(), date: eventDate, role: "host", kind: "local" });
  }

  // --- render ----------------------------------------------------------------
  return (
    <FxProvider value={fx}>
    {/* Host's createRoom path now builds an optimistic room state from
        the items page's local data and hands it to the room page via
        sessionStorage, so the host navigates directly to a fully-
        rendered room without ever waiting on the create-room POST.
        That made the skeleton overlay we used to mount here purely
        decorative — gone now. */}
    <main className={`mx-auto flex max-w-md flex-col px-4 ${step === "capture" ? "h-[100svh] overflow-hidden pb-4" : "min-h-dvh pb-28"}`}>
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-gray-300/80 bg-white/95 px-4 py-3 shadow-[0_2px_8px_-2px_rgba(15,15,30,0.08)] backdrop-blur">
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex items-center gap-2 justify-self-start">
            {step === "capture" ? (
              <a
                href="/history"
                aria-label={t.history}
                title={t.history}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl text-swish-dark active:bg-gray-200"
              >
                🕘
              </a>
            ) : null}
            {/* Debug panel is hidden — open it by switching language
                sv → no → da → sv in that order (see applyLang). */}
          </div>
          <KvittLogo className="justify-self-center" />
          <div className="justify-self-end">
            <LangToggle lang={lang} onChange={(l) => applyLang(l, lang)} />
          </div>
        </div>
      </header>

      <StepHeader
        step={step === "capture" ? "scan" : step === "items" ? "verify" : "share"}
        t={t}
      />

      {step === "capture" && (
        <section key="capture" className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-contain" />
            ) : null}
            {/* OCR couldn't pull anything out of this shot. Cover the
                preview with a clear banner explaining what happened
                and offering the host an actionable next step — retake
                (clears the photo, goes back to live camera) or fall
                back to manual entry. */}
            {ocrFailed && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
                <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <h2 className="mt-3 text-base font-bold text-ink">{ocrFailReason === "noPrices" ? t.ocrNoPricesTitle : t.ocrFailedTitle}</h2>
                  <p className="mt-1 text-sm leading-snug text-gray-600">{ocrFailReason === "noPrices" ? t.ocrNoPricesBody : t.ocrFailedBody}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={skipToManual}
                      className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-ink active:bg-gray-200"
                    >
                      {t.enterManually}
                    </button>
                    <button
                      type="button"
                      onClick={retakeShot}
                      className="rounded-xl bg-swish px-4 py-2.5 text-sm font-semibold text-white shadow-sm active:bg-swish-dark"
                    >
                      {t.retakePhoto}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {ocrLoading && (
              <div className="absolute inset-0 overflow-hidden">
                {/* Lighter dim so the captured photo stays the hero —
                    user needs to SEE the receipt being scanned, not a
                    pink grid. */}
                <div className="absolute inset-0 bg-black/20" />
                <div className="scan-grid absolute inset-0 opacity-20" />
                {/* Real "found-line" markers — rectangles computed by
                    detectTextLines from the captured photo's actual
                    pixels (dark rows ≈ text rows). Each fades in with
                    a staggered delay so the markers visibly cascade
                    down the receipt while the OCR call is in flight.
                    Cap the per-marker delay at 1.5 s total so long
                    receipts don't take forever to light up. */}
                <div className="pointer-events-none absolute inset-0">
                  {detectedLines.map((line, i) => (
                    <span
                      key={i}
                      className="ocr-line absolute rounded-[2px] bg-swish/45 shadow-[0_0_6px_2px_rgba(238,92,154,0.45)]"
                      style={{
                        top: `${line.y}%`,
                        left: `${line.x}%`,
                        width: `${line.w}%`,
                        height: `${Math.max(0.6, Math.min(2.5, line.h))}%`,
                        animationDelay: `${Math.min(1.5, i * 0.05)}s`,
                      }}
                    />
                  ))}
                </div>
                {/* sweeping band + bright glowing beam */}
                <div className="scanline absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-transparent via-swish/45 to-transparent" />
                <div className="scanline absolute inset-x-0 top-0 h-[3px] bg-swish shadow-[0_0_18px_5px_rgba(238,92,154,0.85)]" />
                {/* glowing corner brackets */}
                <div className="scan-glow pointer-events-none absolute inset-4">
                  <span className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-swish" />
                  <span className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-swish" />
                  <span className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-swish" />
                  <span className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-swish" />
                </div>
              </div>
            )}
            {imageUrl ? null : (
              <>
                {/* Single-shot review: after the very first photo, show the
                    captured frame full-bleed so the host can sanity-check
                    before committing — no live camera, no overlay. */}
                {pendingShots.length > 0 && !wantMoreShots ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pendingShots[pendingShots.length - 1]}
                    alt=""
                    className="h-full w-full bg-black object-contain"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full bg-black object-cover ${cameraActive ? "" : "invisible"}`}
                  />
                )}
                {/* Scanner sweep stack: three independently-timed beams
                    (loud horizontal top→bottom, softer return bottom→
                    top, faint vertical left→right). Each .vf-scan-*
                    wrapper is full-viewfinder so its transform actually
                    travels — putting the animation on the beam itself
                    would only shift it 2 px. */}
                {cameraActive && !ocrLoading && (
                  <>
                    <div className="vf-scan-y pointer-events-none absolute inset-0">
                      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-swish/80 to-transparent shadow-[0_0_22px_5px_rgba(238,92,154,0.4)]" />
                    </div>
                    <div className="vf-scan-y-back pointer-events-none absolute inset-0">
                      <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-swish/55 to-transparent" />
                    </div>
                    <div className="vf-scan-x pointer-events-none absolute inset-0">
                      <div className="absolute inset-y-0 left-0 w-[1.5px] bg-gradient-to-b from-transparent via-swish/50 to-transparent" />
                    </div>
                  </>
                )}
                {cameraActive && !ocrLoading && (
                  <div className="pointer-events-none absolute inset-5">
                    {/* Instruction card — translucent dark panel hanging
                        at the top of the viewfinder. Two lines: headline
                        + a tip that explains long-receipt multi-shot.
                        Swaps to the alignment hint once the host has
                        opted into another shot. */}
                    <div className="absolute inset-x-0 top-0 mx-auto max-w-[20rem] rounded-2xl bg-black/55 px-3.5 py-2.5 text-center text-white shadow-lg backdrop-blur">
                      {lastShot && wantMoreShots ? (
                        <>
                          <p className="text-sm font-semibold leading-tight">{t.lineUpOverlayTitle}</p>
                          <p className="mt-1 text-[11px] leading-snug text-white/80">{t.lineUpOverlay}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold leading-tight">{t.scanGuideTitle}</p>
                          <p className="mt-1 text-[11px] leading-snug text-white/80">{t.scanGuideLong}</p>
                        </>
                      )}
                    </div>
                    {pendingShots.length > 0 && (
                      <span className="absolute left-1/2 bottom-2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-swish px-3 py-1 text-[11px] font-semibold text-white shadow-lg">
                        📷 {pendingShots.length}
                      </span>
                    )}
                  </div>
                )}
                {/* Flashlight: only surfaced when the browser exposes the
                    torch constraint on this track. Matches the choose-
                    photo button visually: same h-14 w-14 footprint, a
                    monochrome stroked SVG that inherits currentColor,
                    same ring-1 / backdrop-blur surface. The chip
                    colour swaps amber when on; the bolt glyph itself
                    doesn't change. z-40 keeps it on top of the action
                    row in case the right slot lands at the same
                    corner. */}
                {cameraActive && torchAvailable && !ocrLoading && !scanReady && scanCount === null && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    aria-label={torchOn ? t.torchOff : t.torchOn}
                    aria-pressed={torchOn}
                    className={`pointer-events-auto absolute right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg ring-1 transition-colors ${torchOn ? "bg-amber-300 text-black ring-amber-200" : "bg-black/55 text-white ring-white/30 backdrop-blur"}`}
                  >
                    <FlashIcon />
                  </button>
                )}
                {/* Overlay: bottom 45 % of the last captured shot, anchored
                    to the TOP of the viewfinder so the user can line up
                    where the previous shot ended with what they're about
                    to capture. Only shown once the host has opted into
                    another shot. */}
                {cameraActive && lastShot && wantMoreShots && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={lastShot}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[45%] w-full object-cover object-bottom opacity-50 mix-blend-multiply"
                  />
                )}
                {!cameraActive && pendingShots.length === 0 && (
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-gray-500"
                  >
                    <span className="text-4xl">📷</span>
                    <span className="font-medium">{t.tapToPhoto}</span>
                  </button>
                )}
              </>
            )}

            {/* Setup card is pinned to the bottom edge of the SCREEN,
                not to the viewfinder rectangle, so it reads as a
                global "while you wait" sheet rather than something
                glued onto the photo. After a 1 s warm-up it rises
                from below; it then stays up while OCR runs AND
                while we're holding for the host's name + valid
                phone (scanReady), so a host still mid-typing
                isn't kicked off the screen. Outer wrapper is
                position:fixed with a flex-centre so the inner
                card sits in the same max-w-md column as the
                rest of the app on tablet-width viewports. */}
            {((scanCardVisible && ocrLoading) || scanCount !== null || scanReady) && !hostCardDismissed && (
            <div className="pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3">
              <div className="scan-card-rise pointer-events-auto w-full max-w-md space-y-3 rounded-2xl bg-white/95 p-4 shadow-xl ring-1 ring-black/10 backdrop-blur">
                {/* Section header. "Under tiden…" is the loud bold
                    headline; "Vem la ut för notan?" returns as the
                    subhead under it (was removed last pass — turns
                    out the placeholders alone weren't enough
                    context). Contact Picker icon button on the
                    far right, only mounts on Android Chromium. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* Small status caption shown ABOVE the
                        "Under tiden…" headline while OCR is still
                        running or the count is animating up — gives
                        the host a clear scan-in-progress signal
                        without disturbing the "Vem la ut för notan?"
                        subheader below. Hides itself when there's
                        nothing to report. */}
                    {(ocrLoading || scanCount !== null) && (
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-swish-dark">
                        {ocrLoading ? t.readingReceipt : t.linesFound(scanCount ?? 0)}
                      </p>
                    )}
                    <p className="text-xl font-bold leading-tight text-ink">{t.inTheMeantime}</p>
                    <p className="mt-3 text-sm text-gray-500">{t.payerTitle}</p>
                  </div>
                  {contactsApi && (
                    <button
                      type="button"
                      onClick={pickContactInfo}
                      aria-label={t.useMyContact}
                      title={t.useMyContact}
                      className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-500 active:bg-gray-100 active:text-ink"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="12" cy="10" r="2.5" />
                        <path d="M8 17a4 4 0 0 1 8 0" />
                        <line x1="3" y1="8" x2="6" y2="8" />
                        <line x1="3" y1="12" x2="6" y2="12" />
                        <line x1="3" y1="16" x2="6" y2="16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M5 21v-1a7 7 0 0 1 14 0v1" />
                      </svg>
                    </span>
                    <input
                      value={diners[0]?.name ?? ""}
                      onChange={(e) => updateDiner(diners[0].id, e.target.value)}
                      placeholder={t.genericHostName}
                      autoComplete="name"
                      className="w-full rounded-xl bg-white py-3.5 pl-11 pr-3 text-base shadow-sm ring-1 ring-black/5 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-gray-400">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="2" width="12" height="20" rx="2.5" />
                        <path d="M12 18h.01" />
                      </svg>
                    </span>
                    <input
                      value={payerPhone}
                      onChange={(e) => {
                        setPayerPhone(e.target.value);
                        if (isValidPhone(e.target.value)) e.target.blur();
                      }}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder={t.swishNumber}
                      className="w-full rounded-xl bg-white py-3.5 pl-11 pr-10 text-base shadow-sm ring-1 ring-black/5 outline-none"
                    />
                    {isValidPhone(payerPhone) && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-base font-bold text-emerald-600"
                      >
                        ✓
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="mt-6 text-sm text-gray-500">{t.groupSizeLabel}</p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      aria-label="−"
                      onClick={() => setGroupSize(Math.max(2, (groupSize || 2) - 1))}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-3xl font-bold leading-none text-gray-600 active:bg-gray-300"
                    >
                      −
                    </button>
                    <GroupVisual count={groupSize} />
                    <button
                      type="button"
                      aria-label="+"
                      onClick={() => setGroupSize(Math.min(50, Math.max(2, (groupSize || 1) + 1)))}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-3xl font-bold leading-none text-gray-600 active:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* "Why do we need this?" disclosure — the three per-
                    field captions used to live directly under each
                    input but bloated the card vertically; folding
                    them behind a one-line summary keeps the form
                    compact while the explanations stay one tap
                    away. The earlier "Everything stays on your
                    phone" line was removed: it wasn't accurate
                    anymore — we do spin up an online room. */}
                <details className="group border-t border-gray-100 pt-2.5 text-[11px] leading-snug text-gray-500 [&[open]>summary>svg]:rotate-90">
                  <summary className="flex cursor-pointer items-center gap-1.5 text-gray-600 marker:hidden [&::-webkit-details-marker]:hidden">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="transition-transform" aria-hidden>
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                    {t.whyTooltipTitle}
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-1">
                    <li><span className="font-medium text-ink">{t.yourName}.</span> {t.whyName}</li>
                    <li><span className="font-medium text-ink">{t.swishNumber}.</span> {t.whyNumber}</li>
                    <li><span className="font-medium text-ink">{t.groupSizeLabel}.</span> {t.whyGroup}</li>
                  </ul>
                </details>
                {(() => {
                  const hasPhone = isValidPhone(payerPhone);
                  const hasGroup = groupSize >= 2;
                  // Name is no longer required — empty falls back to
                  // t.genericHostName (the "Notans hjälte" placeholder).
                  const canCommit = hasPhone && hasGroup;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (hostReady) return;
                        setHostReady(true);
                        setHostDoneFlash(true);
                        // Hold the checkmark for ~450 ms, then dismiss
                        // the whole setup card — even if the scan is
                        // still in flight. Scan continues in the
                        // background; scanReady + hostReady advances
                        // to the verify step when it completes.
                        window.setTimeout(() => {
                          setHostDoneFlash(false);
                          setHostCardDismissed(true);
                        }, 450);
                      }}
                      disabled={!canCommit || hostReady}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-swish px-4 py-3 text-base font-semibold text-white active:bg-swish-dark disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {hostDoneFlash ? (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="5 12 10 17 19 7" />
                        </svg>
                      ) : (
                        t.setupDone
                      )}
                    </button>
                  );
                })()}
              </div>
            </div>
            )}
            {/* Capture-step CTAs ride along the bottom of the viewfinder
                so they're always visible regardless of viewport height.
                Same gate as the setup card uses inverted — both are
                mutually exclusive, so they never fight for the same
                slot. shadow-lg on every button so they read against the
                live video underneath. */}
            {!(ocrLoading || scanCount !== null || scanReady || hostReady || ocrFailed) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 px-6">
                {ocrError && (
                  <p className="pointer-events-auto mx-auto mb-3 max-w-xs rounded-lg bg-red-600 px-3 py-1.5 text-center text-xs font-medium text-white shadow-lg">
                    {ocrError}
                  </p>
                )}
                {/* Pre-scan quality hint. analyzeImageQuality runs after
                    every capture / upload; if the Laplacian variance
                    or contrast metrics fall below the human-readable
                    thresholds we surface a single most-actionable
                    warning above the "Read receipt" button. Non-
                    blocking — the host can still tap to commit. */}
                {imageUrl && imageQuality?.warning && !ocrError && (
                  <p className="pointer-events-auto mx-auto mb-3 flex max-w-xs items-center justify-center gap-1.5 rounded-lg bg-amber-50/95 px-3 py-1.5 text-center text-xs font-medium text-amber-900 shadow-lg ring-1 ring-amber-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {imageQuality.warning === "blur"
                      ? t.qualityBlur
                      : imageQuality.warning === "contrast"
                      ? t.qualityContrast
                      : imageQuality.warning === "dark"
                      ? t.qualityDark
                      : t.qualityBright}
                  </p>
                )}
                {/* Tooltip above the left slot, only shown right after
                    the first shot. Explains that long receipts can be
                    captured across multiple photos and get stitched
                    server-side. */}
                {!imageUrl && pendingShots.length > 0 && !wantMoreShots && (
                  <div className="pointer-events-none absolute -top-2 left-2 right-2 -translate-y-full">
                    <div className="mx-auto max-w-[260px] rounded-2xl bg-black/75 px-3.5 py-2 text-xs leading-snug text-white shadow-xl backdrop-blur">
                      {t.multiShotTip}
                      <span aria-hidden className="absolute -bottom-1 left-7 h-3 w-3 rotate-45 bg-black/75" />
                    </div>
                  </div>
                )}
                {/* iOS-camera style action row: a big shutter / commit
                    circle in the centre, with state-specific secondaries
                    to either side. pointer-events on the wrapper are
                    off; each individual button opts back in. */}
                <div className="grid grid-cols-3 items-center">
                  {/* LEFT slot ---------------------------------------- */}
                  <div className="justify-self-start">
                    {imageUrl ? (
                      <CaptureIconButton onClick={retakeShot} label={t.takePhoto}>📷</CaptureIconButton>
                    ) : pendingShots.length === 0 ? (
                      <CaptureIconButton size="lg" onClick={() => fileRef.current?.click()} label={t.chooseLibrary}>
                        <PhotoIcon />
                      </CaptureIconButton>
                    ) : !wantMoreShots ? (
                      <CaptureIconButton size="lg" onClick={() => setWantMoreShots(true)} label={t.takeAnotherShot}>
                        <span className="text-3xl leading-none">+</span>
                      </CaptureIconButton>
                    ) : (
                      <CaptureIconButton onClick={discardPendingShots} label={t.discardShots}>✕</CaptureIconButton>
                    )}
                  </div>
                  {/* CENTER (primary) --------------------------------- */}
                  <div className="justify-self-center">
                    {imageUrl ? (
                      <CaptureCommitButton onClick={() => runOcr()} label={t.readReceipt} />
                    ) : pendingShots.length === 0 ? (
                      <CaptureShutterButton onClick={capturePhoto} label={t.scanCta} disabled={!cameraActive} />
                    ) : !wantMoreShots ? (
                      <CaptureCommitButton onClick={finishCapture} label={t.readReceipt} />
                    ) : (
                      <CaptureShutterButton onClick={capturePhoto} label={t.scanCta} disabled={!cameraActive} count={pendingShots.length} />
                    )}
                  </div>
                  {/* RIGHT slot --------------------------------------- */}
                  <div className="justify-self-end">
                    {imageUrl ? (
                      <CaptureIconButton size="lg" onClick={() => fileRef.current?.click()} label={t.chooseLibrary}>
                        <PhotoIcon />
                      </CaptureIconButton>
                    ) : pendingShots.length === 0 ? null : !wantMoreShots ? (
                      <CaptureIconButton onClick={discardPendingShots} label={t.discardShots}>✕</CaptureIconButton>
                    ) : (
                      <CaptureCommitButton onClick={finishCapture} label={t.readReceiptN(pendingShots.length)} compact count={pendingShots.length} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
          {/* `multiple` lets the host grab several pages of a long
              receipt from their gallery in one go; on iOS it also
              nudges Safari toward opening the Photos picker directly
              instead of the generic Photo Library / Take Photo /
              Choose File action sheet for the library button. */}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} className="hidden" />
        </section>
      )}

      {step === "items" && (
        <section ref={playPanIn} key="items" className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            {/* Title comes first now so the host lands on the "is this
                right?" verification prompt before the receipt metadata.
                The 🧾 receipt button hangs in the corner for quick
                cross-checking against the original photo. */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{t.itemsTitle}</h2>
                <p className="mt-1 text-sm leading-snug text-gray-600">{t.itemsHint}</p>
              </div>
              {images.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReceiptOpen(true)}
                  aria-label={t.showReceipt}
                  className="shrink-0 rounded-xl bg-white px-3 py-2 text-base shadow-sm ring-1 ring-gray-200 active:bg-gray-100"
                  title={t.showReceipt}
                >
                  🧾
                </button>
              )}
            </div>
            {/* Restaurant name and currency sit side by side — the
                currency selector picks up a flag emoji ahead of the
                code for quicker scanning. The date no longer gets its
                own input; it lives as a small tappable subtitle below,
                with the native picker hidden underneath the label. */}
            <div className="mt-4 flex items-stretch gap-2">
              <input
                value={mealLabel}
                onChange={(e) => setMealLabel(e.target.value)}
                placeholder={t.placePlaceholder}
                aria-label={t.placePlaceholder}
                className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-base font-semibold text-ink shadow-sm ring-1 ring-black/5 outline-none"
              />
              <div className="relative shrink-0">
                <select
                  value={currency}
                  onChange={(e) => changeCurrency(e.target.value)}
                  disabled={fxChanging}
                  aria-label={t.currencyLabel}
                  className="h-full appearance-none rounded-xl bg-white py-2 pl-3 pr-8 text-base font-semibold text-ink shadow-sm ring-1 ring-black/5 outline-none disabled:opacity-50"
                >
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>
                      {currencyFlag(c)} {c}
                    </option>
                  ))}
                </select>
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">▾</span>
              </div>
            </div>
            <label className="mt-1.5 relative inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-sm text-gray-500 active:bg-gray-100">
              <span aria-hidden>📅</span>
              <span>{formatReceiptDate(eventDate, lang)}</span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value || today)}
                aria-label={t.messageAria}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            {ocrModel && (
              <p className="mt-1.5 text-xs text-gray-400">{t.readBy(OCR_MODEL_LABEL[ocrModel] ?? ocrModel)}</p>
            )}
            {ocrModel && !ocrModel.startsWith("claude") && (
              <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
                {t.ocrFallback}
              </p>
            )}
            {fxChanging && <p className="mt-1 text-xs text-gray-400">…</p>}
            {isForeign && (fx ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
                {t.fxLine(
                  country ? `${flagEmoji(country)} ${regionName(country, lang)}` : "🌍",
                  currency,
                  `${formatOre(Math.round((fxRate ?? 0) * 100))} SEK${rateDate ? `, ${rateDate}` : ""}`,
                )}
                {rateApprox && ` · ${t.fxApprox}`}
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700 ring-1 ring-red-200">
                {t.fxMissing(currency)}
              </p>
            ))}
            <div className="mt-3 space-y-2">
              {itemGroups.map((copies, gIdx) => {
                const rep = copies[0];
                const rowOre = parseAmountToOre(rep.priceInput) ?? 0;
                // A shared row's per-person split has to use every copy's
                // value — toggling "shared" on a "Pizza ×3" row means the
                // group is splitting all three pizzas, not just one.
                const sharedOre = rowOre * copies.length;
                const divisor = groupSize > 0 ? groupSize : namedDiners.length;
                const d = itemDivisorFor(rep);
                // "Low confidence" = the keyword layer couldn't categorise this
                // line and the description is mostly non-alphabetic. Subtle tint
                // so the host's eyes go to the rows that might need checking.
                const letters = (rep.description.match(/[A-Za-zÀ-ÿ]/g)?.length ?? 0);
                const lowConfidence = !rep.isTip && !rep.shared && (
                  categoryFor(rep.description, rep.category) === "other" || letters < 2
                );
                return (
                <div key={rep.id} data-row-id={rep.id} className="flex items-start gap-2">
                  <div
                    className={`min-w-0 flex-1 rounded-xl p-2 shadow-sm ring-1 transition-colors duration-220 ease-out ${lowConfidence ? "bg-amber-50/70 ring-amber-200" : "bg-white ring-black/5"}`}
                  >
                    {/* Top row uses items-start (not items-center) so a
                        multi-line description, the emoji and the price
                        input all top-align — the description never
                        drifts to the middle of the card as the row
                        grows in height. */}
                    <div className="flex items-start gap-2">
                      <span aria-hidden className="pl-1 pt-1.5 text-3xl leading-none">
                        {rep.isTip ? "💝" : <ItemEmoji description={rep.description} hint={rep.category} modelEmoji={rep.emoji} />}
                      </span>
                      <input
                        value={rep.description}
                        onChange={(e) => updateGroup(rep, { description: e.target.value })}
                        placeholder={t.descPlaceholder}
                        className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none"
                      />
                      {copies.length > 1 && (
                        <span className="shrink-0 pt-2 text-sm font-semibold text-gray-400">×{copies.length}</span>
                      )}
                      <div className="flex w-20 shrink-0 flex-col items-stretch gap-1">
                        <input
                          value={
                            priceDraft?.id === rep.id
                              ? priceDraft.value
                              : rep.shared
                              ? formatOre(Math.floor(rowOre / Math.max(1, d)))
                              : rep.priceInput
                          }
                          onChange={(e) => setPriceDraft({ id: rep.id, value: e.target.value })}
                          onBlur={() => commitPriceDraft(rep)}
                          inputMode="decimal"
                          placeholder={t.pricePlaceholder}
                          className="w-full rounded-lg bg-gray-50 px-2 py-2 text-right outline-none"
                        />
                        {fx && rowOre > 0 && (
                          <span className="mt-0.5 pr-1 text-right text-[10px] text-gray-400">{formatNative(rowOre, fx)}</span>
                        )}
                      </div>
                      {!rep.isTip && (
                        <span
                          aria-hidden={!rep.shared}
                          className={`shrink-0 self-start overflow-hidden whitespace-nowrap pt-2 text-base text-gray-400 transition-[max-width,opacity,padding] duration-220 ease-out ${
                            rep.shared ? "max-w-[80px] pl-1 opacity-100" : "max-w-0 pl-0 opacity-0"
                          }`}
                        >
                          {t.perShareUnit}
                        </span>
                      )}
                    </div>
                    {!rep.isTip && (
                      <div className="mt-2 text-sm text-gray-500">
                        {/* DELAT toggle on the left, share stepper on
                            the right of the SAME row. The stepper is
                            wrapped in a max-w + opacity reveal so it
                            slides in from the right when DELAT flips
                            on and folds away cleanly when it flips
                            off — no row-height jump from the old
                            grid-rows reveal under the price input. */}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            role="switch"
                            onClick={() => updateGroup(rep, { shared: !rep.shared, sharers: [], shareCount: rep.shared ? undefined : rep.shareCount })}
                            aria-checked={rep.shared}
                            aria-label={t.sharedToggle}
                            className="-m-2 inline-flex items-center gap-2.5 p-2"
                          >
                            <span
                              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                rep.shared ? "bg-swish" : "bg-gray-300"
                              }`}
                            >
                              <span
                                aria-hidden
                                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                  rep.shared ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </span>
                            <span className={`text-sm font-semibold uppercase tracking-wide ${rep.shared ? "text-swish-dark" : "text-gray-500"}`}>
                              {t.sharedLabel}
                            </span>
                          </button>
                          <div
                            aria-hidden={!rep.shared}
                            className={`overflow-hidden transition-all duration-220 ease-out ${
                              rep.shared ? "max-w-[180px] opacity-100" : "pointer-events-none max-w-0 opacity-0"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 pl-1">
                              <button
                                type="button"
                                aria-label="−"
                                tabIndex={rep.shared ? 0 : -1}
                                onClick={() => updateGroup(rep, { shareCount: Math.max(2, d - 1) })}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-base font-bold leading-none text-gray-600 active:bg-gray-200"
                              >
                                −
                              </button>
                              <span className="w-12 text-center text-lg font-normal tabular-nums text-ink">{d}/{groupSize}</span>
                              <button
                                type="button"
                                aria-label="+"
                                tabIndex={rep.shared ? 0 : -1}
                                disabled={d >= groupSize}
                                onClick={() => updateGroup(rep, { shareCount: d + 1 >= groupSize ? undefined : d + 1 })}
                                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-base font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`grid transition-[grid-template-rows] duration-220 ease-out ${
                            !rep.shared && sharedSuggestion(rep.description) ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateGroup(rep, { shared: true, sharers: [], shareCount: undefined })}
                              className="ml-3 mt-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200 active:bg-amber-100"
                            >
                              {t.maybeShared}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {rep.isTip && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-1 text-sm">
                        <span className="rounded-full bg-swish/15 px-2 py-0.5 font-semibold text-swish-dark">{t.sharedToggle}</span>
                        {divisor >= 2 && (
                          <span className="text-gray-500">{t.sharedSplit(divisor, formatOre(Math.floor(sharedOre / divisor)))}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Trash button sits outside the card on the right.
                      Keeps the destructive action visually separate
                      from the row's editable content — same pattern
                      Files-/Notes-style list rows use. */}
                  <button
                    type="button"
                    onClick={() => removeItem(rep.id)}
                    aria-label={t.removeRow}
                    className="mt-1.5 flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 active:bg-gray-100 active:text-red-500"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button type="button" onClick={addItem} className="text-sm font-medium text-swish-dark">
                {t.addRow}
              </button>
              <button
                type="button"
                onClick={() => addMoreRef.current?.click()}
                disabled={ocrLoading}
                className="text-sm font-medium text-swish-dark disabled:opacity-50"
              >
                {ocrLoading ? t.addingPhoto : t.addPhoto}
              </button>
            </div>
            <input ref={addMoreRef} type="file" accept="image/*" multiple onChange={onAppendFile} className="hidden" />

            <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.rowsSum}</span>
                <Money ore={itemsSumOre} className="font-semibold" />
              </div>
              {receiptTotal !== null && (
                <div className="mt-1 flex justify-between">
                  <span className="text-gray-600">{t.receiptTotalLabel}</span>
                  <Money ore={receiptTotal} className={`font-semibold ${totalReconciles ? "text-green-600" : "text-amber-600"}`} />
                </div>
              )}
              {tipOre > 0 && (
                <div className="mt-1 flex justify-between">
                  <span className="text-gray-600">{t.tip}</span>
                  <span className="font-semibold">+<Money ore={tipOre} /></span>
                </div>
              )}
              {receiptChargedOre > 0 && receiptChargedOre !== receiptTotal && (
                <div className="mt-1 flex justify-between border-t border-gray-100 pt-1">
                  <span className="text-gray-600">{t.chargedLabel}</span>
                  <Money ore={receiptChargedOre} className="font-semibold" />
                </div>
              )}
              {/* Quick-set chips for when the tip was added at the
                  card terminal (no printed Dricks line for OCR to
                  read). Tapping a percentage rounds to the nearest
                  krona and rewrites the dricks row in place. Hidden
                  when the OCR already pulled a tip off the receipt
                  (printed Dricks line or implied tip from charged >
                  total) — the host edits the row directly in the list
                  above in that case. */}
              {itemsSumOre > 0 && !ocrFoundTip && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
                  <span className="mr-1 text-xs text-gray-500">{t.tip}</span>
                  {[0, 5, 10, 15].map((pct) => {
                    const active = currentTipPct === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => applyTipPercent(pct)}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          active
                            ? "bg-swish text-white"
                            : "bg-gray-100 text-gray-700 active:bg-gray-200"
                        }`}
                      >
                        {pct === 0 ? t.none : `${pct} %`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {!totalReconciles && (
              <p className="mt-1 text-xs text-amber-600">{t.totalDiff(formatOre(Math.abs(totalDiffOre)))}</p>
            )}
            {removedItems.length > 0 && (
              <details className="mt-3 rounded-xl bg-white/60 px-4 py-2 ring-1 ring-black/5">
                <summary className="cursor-pointer text-sm font-medium text-gray-500">{t.removedTitle(removedItems.length)}</summary>
                <div className="mt-2 space-y-1.5">
                  {removedItems.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-gray-400 line-through">{it.description || t.rowFallback}</span>
                      <span className="shrink-0 text-gray-400">{it.priceInput}</span>
                      <button type="button" onClick={() => restoreItem(it.id)} className="shrink-0 font-medium text-swish-dark active:opacity-70">
                        {t.restore}
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div>
            <p className="px-1 text-xs text-gray-400">”{message}”</p>
            {roomError && <p className="mt-2 text-sm text-red-600">{roomError}</p>}
          </div>

          <details className="rounded-xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
            <summary className="cursor-pointer text-sm font-medium text-gray-600">{t.splitYourself}</summary>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-gray-500">{t.whoElse}</h3>
              <div className="mt-2 space-y-2">
                {diners.slice(1).map((d) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <input
                      value={d.name}
                      onChange={(e) => updateDiner(d.id, e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="flex-1 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeDiner(d.id)}
                      aria-label={t.removePerson}
                      className="px-3 text-gray-400 active:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addDiner} className="mt-2 text-sm font-medium text-swish-dark">
                {t.addPerson}
              </button>
              <button
                type="button"
                onClick={() => itemsStepValid && setStep("assign")}
                disabled={!itemsStepValid}
                className="mt-3 w-full rounded-xl bg-gray-100 px-4 py-3 font-medium active:bg-gray-200 disabled:opacity-40"
              >
                {t.assignManually}
              </button>
            </div>
          </details>
          {undoItem && (
            <div className="fixed inset-x-0 bottom-24 z-50 mx-auto max-w-md px-4">
              {/* key on the id so the countdown bar restarts whenever a NEW
                  item is removed while a previous toast is still up. */}
              <div key={undoItem.id} className="relative overflow-hidden rounded-xl bg-red-600 px-3 py-2.5 text-sm text-white shadow-lg ring-1 ring-red-700/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">🗑 {t.removedItem(undoItem.description || t.rowFallback)}</span>
                  <button
                    type="button"
                    onClick={() => restoreItem(undoItem.id)}
                    className="shrink-0 rounded-lg bg-white px-3 py-1 font-semibold text-red-700 active:bg-red-50"
                  >
                    {t.undo}
                  </button>
                </div>
                <span aria-hidden className="undo-countdown absolute inset-x-0 bottom-0 h-0.5 bg-white/80" />
              </div>
            </div>
          )}
        </section>
      )}

      {step === "assign" && (
        <section key="assign" className="mt-6 flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t.assignTitle}</h2>
            <button type="button" onClick={spreadEverything} className="text-sm font-medium text-swish-dark">
              {t.splitAll}
            </button>
          </div>
          <p className="-mt-2 text-sm text-gray-600">{t.assignHint}</p>

          <label className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-black/5">
            <span className="text-gray-600">{t.groupSizeLabel}</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={groupSize || ""}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setGroupSize(v <= 0 ? 0 : Math.max(2, Math.min(50, v)));
              }}
              placeholder={String(namedDiners.length)}
              className="w-16 rounded-lg bg-gray-50 px-2 py-1 text-right outline-none"
            />
          </label>

          {CATEGORY_ORDER.map((cat) => {
            const groupItems = foodItems.filter((it) => categoryFor(it.description, it.category) === cat);
            if (groupItems.length === 0) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-gray-500">
                  <span aria-hidden>{CATEGORY_EMOJI[cat]}</span>
                  <span>{CATEGORY_LABEL[lang][cat]}</span>
                </div>
                {groupItems.map((it) => {
            const priceOre = parseAmountToOre(it.priceInput) ?? 0;
            const d = itemDivisorFor(it);
            const per = it.shared
              ? Math.floor(priceOre / d)
              : it.sharers.length > 0
                ? Math.floor(priceOre / it.sharers.length)
                : 0;
            const allSet = namedDiners.length > 0 && namedDiners.every((d) => it.sharers.includes(d.id));
            return (
              <div
                key={it.id}
                className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">
                    <span aria-hidden className="mr-1.5 inline-block align-[-0.1em] text-3xl leading-none"><ItemEmoji description={it.description} hint={it.category} modelEmoji={it.emoji} /></span>
                    {it.description || t.rowFallback}
                  </span>
                  <Money ore={priceOre} className="shrink-0 text-sm text-gray-600" />
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={it.shared}
                      onChange={() => toggleShared(it.id)}
                      className="h-6 w-6 rounded border-gray-300 accent-swish"
                    />
                    {t.sharedToggle}
                  </label>
                  {it.shared && (
                    <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                      <span>{t.splitWays}</span>
                      <button
                        type="button"
                        aria-label="−"
                        onClick={() => setShareCount(it.id, d - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="min-w-[3.5rem] text-center text-2xl font-normal tabular-nums text-ink">{d}/{groupSize}</span>
                      <button
                        type="button"
                        aria-label="+"
                        disabled={d >= groupSize}
                        onClick={() => setShareCount(it.id, d + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-2xl font-bold leading-none text-gray-600 active:bg-gray-200 disabled:opacity-40"
                      >
                        +
                      </button>
                      <span className="text-gray-400">≈ {formatOre(per)} SEK</span>
                    </span>
                  )}
                </div>

                {!it.shared && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {namedDiners.map((d) => {
                        const on = it.sharers.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleSharer(it.id, d.id)}
                            className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
                              on ? "bg-swish text-white ring-swish" : "bg-white text-gray-600 ring-gray-200"
                            }`}
                          >
                            {d.name}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => assignAllTo(it.id)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-swish-dark ring-1 ring-gray-200"
                      >
                        {allSet ? t.clear : t.all}
                      </button>
                    </div>
                    {it.sharers.length > 1 && <p className="mt-2 text-xs text-gray-500">{t.perPerson(formatOre(per))}</p>}
                    {it.sharers.length === 0 && <p className="mt-2 text-xs text-amber-600">{t.notAssignedYet}</p>}
                  </>
                )}
              </div>
            );
          })}
              </div>
            );
          })}

          {unassignedOre > 0 && (
            <p className="text-sm text-amber-600">{t.unassignedNote(formatOre(unassignedOre))}</p>
          )}
        </section>
      )}

      {step === "result" && (
        <section key="result" className="mt-6 flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-bold">{t.payTitle}</h2>

          {tipOre > 0 && (
            <div className="rounded-2xl bg-white p-3 text-sm text-gray-600 shadow-sm ring-1 ring-black/5">
              {t.tipSplitNote(formatOre(tipOre))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
            <span className="text-sm text-white/70">{t.toDistribute}</span>
            <Money ore={assignedTotalOre} className="font-semibold" nativeClassName="ml-1 text-xs font-normal text-white/60" />
          </div>
          {unassignedOre > 0 && (
            <p className="-mt-2 text-sm text-amber-600">{t.unassignedWarn(formatOre(unassignedOre))}</p>
          )}

          <div className="space-y-3">
            {shares.map((s) =>
              s.dinerId === payer?.id ? (
                <div
                  key={s.dinerId}
                  className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-4"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{t.payerCard(s.name)}</span>
                    <Money ore={s.totalOre} className="text-gray-600" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{t.payerCardHint}</p>
                </div>
              ) : s.totalOre > 0 ? (
                <QrCard
                  key={s.dinerId}
                  name={s.name}
                  method={method}
                  amountOre={s.totalOre}
                  swishPayee={normalizedPayer || undefined}
                  iban={method === "sepa" ? normalizeIban(payeeIban) : undefined}
                  payeeName={payer?.name}
                  eurCents={method === "sepa" ? eurCentsFor(s.totalOre) : undefined}
                  message={`${s.name} - ${message}`.slice(0, 50)}
                  t={t}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Debug dialog: small modal triggered by the (i) icon in the
          header. Surfaces app + build version, deep links into the
          icon explorer / demo mode, and the "wipe all local Kvitt
          data" reset that used to live in the capture-step debug
          strip. Hidden behind a tap so it doesn't crowd the live
          camera view. */}
      {debugOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setDebugOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">Debug</h2>
              <button
                type="button"
                onClick={() => setDebugOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 active:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              {process.env.NEXT_PUBLIC_APP_VERSION && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Version</dt>
                  <dd className="font-mono text-ink">v{process.env.NEXT_PUBLIC_APP_VERSION}</dd>
                </div>
              )}
              {process.env.NEXT_PUBLIC_BUILD_ID && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Build</dt>
                  <dd className="break-all font-mono text-xs text-ink">{process.env.NEXT_PUBLIC_BUILD_ID}</dd>
                </div>
              )}
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/debug/icons"
                className="rounded-xl bg-gray-100 px-3 py-2.5 text-center text-sm font-semibold text-ink active:bg-gray-200"
              >
                Icons
              </a>
              <a
                href="/?demo=1"
                className="rounded-xl bg-gray-100 px-3 py-2.5 text-center text-sm font-semibold text-ink active:bg-gray-200"
              >
                Demo
              </a>
            </div>
            {/* Theme override. Writes to localStorage via the
                __kvittSetTheme global the boot script installed in
                <head>, which also flips the .dark class on <html>
                and swaps the manifest link href so the system
                stays consistent. "Auto" wipes the pin and falls
                back to prefers-color-scheme. */}
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "dark", "auto"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      type SetTheme = (theme: "light" | "dark" | "auto") => void;
                      const w = window as Window & { __kvittSetTheme?: SetTheme };
                      w.__kvittSetTheme?.(t);
                    }}
                    className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold capitalize text-ink active:bg-gray-200"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {/* Dialog / overlay shortcuts. Each button flips the state
                that triggers the modal or banner, with a quick
                step+placeholder setup so the preview actually has
                something behind it (the OCR-failed banner and the
                quality chip only render in the capture step against
                a captured photo). Useful for iterating on visual
                tweaks without scanning a real receipt every time. */}
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Dialogs</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setReceiptOpen(true); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Receipt viewer
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setDebugShareOpen(true); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Share QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Drop into the capture step with the setup card up
                    // and waiting for input — same state the host sees
                    // mid-scan while OCR is still chewing on the photo.
                    setDebugOpen(false);
                    setStep("capture");
                    setOcrFailed(false);
                    setHostReady(false);
                    setScanCardVisible(true);
                    setScanReady(true);
                  }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Host input
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setStep("capture"); setOcrFailed(true); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  OCR failed
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setStep("capture"); setImageQuality({ blur: 50, contrast: 60, brightness: 140, warning: "blur" }); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Quality: blur
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setStep("capture"); setImageQuality({ blur: 200, contrast: 18, brightness: 140, warning: "contrast" }); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Quality: contrast
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setStep("capture"); setImageQuality({ blur: 200, contrast: 40, brightness: 40, warning: "dark" }); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Quality: dark
                </button>
                <button
                  type="button"
                  onClick={() => { setDebugOpen(false); setStep("capture"); setImageQuality({ blur: 200, contrast: 40, brightness: 240, warning: "bright" }); }}
                  className="rounded-xl bg-gray-100 px-3 py-2 text-center text-xs font-semibold text-ink active:bg-gray-200"
                >
                  Quality: bright
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window === "undefined") return;
                if (!window.confirm("Reset all local Kvitt data?")) return;
                // Every key we write is "swisher-" prefixed (host name/phone,
                // language, room memberships, local splits, history) — sweep
                // them all and reload so the app rehydrates first-run.
                for (const k of Object.keys(window.localStorage)) {
                  if (k.startsWith("swisher-")) window.localStorage.removeItem(k);
                }
                window.location.href = "/";
              }}
              className="w-full rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 active:bg-red-100"
            >
              Reset all local data
            </button>
          </div>
        </div>
      )}
      {/* Debug-only share dialog preview. Renders QrDialog the same
          way the room page does, but with a static sample QR and
          hardcoded labels so we can iterate on its visual without
          having to actually create a room. Not user-reachable —
          only the debug panel flips debugShareOpen. */}
      <QrDialog
        open={debugShareOpen}
        onClose={() => setDebugShareOpen(false)}
        origin={null}
        qrSrc="/api/qr?payee=0701234567&amountOre=10000&message=test"
        title="Sample restaurant"
        subtitle="Scan to join · TEST01"
        shareUrl="https://kvitt.eu/TEST01"
        shareTitle="Kvitt — Sample restaurant"
        shareText="Join my Kvitt: https://kvitt.eu/TEST01"
        download="kvitt-test01.png"
        labels={
          lang === "sv"
            ? { share: "Dela länk", copied: "Kopierat!", copyLink: "Kopiera länk", close: "Stäng", save: "Spara" }
            : { share: "Share link", copied: "Copied!", copyLink: "Copy link", close: "Close", save: "Save" }
        }
      />
      {receiptOpen && images.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setReceiptOpen(false)}
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 text-white">
            <span className="text-sm font-medium">{t.showReceipt}</span>
            <button
              type="button"
              onClick={() => setReceiptOpen(false)}
              className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium active:bg-white/25"
            >
              ✕
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto px-3 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-3">
              {images.map((src, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={i}
                  src={src}
                  alt={`${t.showReceipt} ${i + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <Footer
        step={step}
        t={t}
        message={message}
        canForward={step === "assign"}
        onCreateRoom={createRoom}
        creatingRoom={creatingRoom}
        roomReady={roomReady}
        onBack={() => {
          const order: Step[] = ["capture", "items", "assign", "result"];
          const i = order.indexOf(step);
          if (i > 0) setStep(order[i - 1]);
        }}
        onForward={() => {
          if (step === "assign") {
            persistLocalSplit();
            setStep("result");
          }
        }}
      />
    </main>
    </FxProvider>
  );
}


function Footer({
  step,
  t,
  message,
  canForward,
  onBack,
  onForward,
  onCreateRoom,
  creatingRoom,
  roomReady,
}: {
  step: Step;
  t: Strings;
  message: string;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onCreateRoom: () => void;
  creatingRoom: boolean;
  roomReady: boolean;
}) {
  if (step === "capture") return null;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl bg-gray-100 px-5 py-3 font-medium active:bg-gray-200"
        >
          {t.back}
        </button>
        {step === "items" && (
          <button
            type="button"
            onClick={onCreateRoom}
            disabled={!roomReady || creatingRoom}
            className="flex-1 rounded-xl bg-swish px-5 py-3 font-semibold text-white active:bg-swish-dark disabled:opacity-40"
          >
            {creatingRoom ? t.creatingRoom : t.createRoom}
          </button>
        )}
        {step === "assign" && (
          <button
            type="button"
            onClick={onForward}
            disabled={!canForward}
            className="flex-1 rounded-xl bg-swish px-5 py-3 font-semibold text-white active:bg-swish-dark disabled:opacity-40"
          >
            {t.createQr}
          </button>
        )}
        {step === "result" && (
          <div className="flex-1 truncate text-right text-xs text-gray-500">”{message}”</div>
        )}
      </div>
    </div>
  );
}
