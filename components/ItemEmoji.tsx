import { emojiFor } from "@/lib/categories";
import { CUSTOM_ICONS } from "./ItemIcons";

/** Item glyph: a matched emoji, or a custom hand-drawn icon (sentinel "ci:<id>"). */
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
  if (glyph.startsWith("ci:")) {
    const entry = CUSTOM_ICONS[glyph.slice(3)];
    if (entry) {
      const Icon = entry.Icon;
      return <Icon />;
    }
  }
  return <>{glyph}</>;
}
