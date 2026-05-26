"use client";

import { useEffect, useState } from "react";
import { emojiFor } from "@/lib/categories";
import { APPLE_ICONS, NOTO_ICONS } from "./ItemIcons";

/** Apple devices (incl. macOS browsers) render Apple emoji; everything else
 *  gets Noto-style. We can't know on the server, so default to Noto and switch
 *  on the client after mount. */
function useApplePlatform() {
  const [apple, setApple] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setApple(/iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua));
  }, []);
  return apple;
}

/** Item glyph: a matched emoji, or a custom icon (sentinel "ci:<id>") drawn in
 *  the style of the viewer's platform. */
export default function ItemEmoji({
  description,
  hint,
  modelEmoji,
}: {
  description: string;
  hint?: string;
  modelEmoji?: string;
}) {
  const apple = useApplePlatform();
  const glyph = emojiFor(description, hint, modelEmoji);
  if (glyph.startsWith("ci:")) {
    const entry = (apple ? APPLE_ICONS : NOTO_ICONS)[glyph.slice(3)];
    if (entry) {
      const Icon = entry.Icon;
      return <Icon />;
    }
  }
  return <>{glyph}</>;
}
