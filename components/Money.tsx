"use client";

import { createContext, useContext, type ReactNode } from "react";
import { formatOreTrim } from "@/lib/money";
import { formatNative, type Fx } from "@/lib/currency";

const FxContext = createContext<Fx>(null);

/** Wrap a subtree so every <Money> inside knows the receipt's currency. */
export function FxProvider({ value, children }: { value: Fx; children: ReactNode }) {
  return <FxContext.Provider value={value}>{children}</FxContext.Provider>;
}

export const useFx = () => useContext(FxContext);

/**
 * Render an SEK amount, and — when the receipt was in a foreign currency — the
 * original-currency value alongside it. `stack` puts the native value on a
 * second line (for big right-aligned headers); otherwise it trails inline.
 */
export function Money({
  ore,
  className = "",
  nativeClassName,
  stack = false,
}: {
  ore: number;
  className?: string;
  nativeClassName?: string;
  stack?: boolean;
}) {
  const fx = useFx();
  const native = formatNative(ore, fx);
  const amount = formatOreTrim(ore);
  // "SEK" is context, not data — scale it down relative to whatever font
  // size the parent picked and drop the weight so the eye lands on the
  // number first.
  const main = (
    <>
      {amount}
      <span className="ml-1 text-[0.72em] font-normal tracking-wide text-gray-400">SEK</span>
    </>
  );
  if (!native) return <span className={className}>{main}</span>;
  if (stack) {
    return (
      <span className={`inline-flex flex-col items-end leading-tight ${className}`}>
        <span>{main}</span>
        <span className={nativeClassName ?? "text-xs font-normal text-gray-400"}>{native}</span>
      </span>
    );
  }
  return (
    <span className={className}>
      {main}
      <span className={nativeClassName ?? "ml-1 text-xs font-normal text-gray-400"}>· {native}</span>
    </span>
  );
}
