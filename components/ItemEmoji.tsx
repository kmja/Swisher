import { emojiFor, CINNAMON_BUN } from "@/lib/categories";

// A top-down kanelbulle: golden dough with a cinnamon spiral. Sweden runs on
// these, but Unicode has no cinnamon-bun emoji, so we draw our own.
function CinnamonBun() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      role="img"
      aria-hidden
      className="inline-block align-[-0.125em]"
    >
      <circle cx="12" cy="12" r="10.5" fill="#E3A65A" stroke="#B26B2E" strokeWidth="1" />
      <path
        d="M12 3 A8.25 8.25 0 0 1 12 19.5 A6.75 6.75 0 0 1 12 6 A5.25 5.25 0 0 1 12 16.5 A3.75 3.75 0 0 1 12 9 A2.25 2.25 0 0 1 12 13.5 A0.75 0.75 0 0 1 12 12"
        fill="none"
        stroke="#7A4A24"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Item glyph: the matched emoji, or our custom cinnamon bun when matched. */
export default function ItemEmoji({
  description,
  hint,
  modelEmoji,
}: {
  description: string;
  hint?: string;
  modelEmoji?: string;
}) {
  const glyph = emojiFor(description, hint, modelEmoji);
  return glyph === CINNAMON_BUN ? <CinnamonBun /> : <>{glyph}</>;
}
