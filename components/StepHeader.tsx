"use client";

import type { Strings } from "@/lib/i18n";

export type WizardStep = "scan" | "verify" | "share";

/**
 * The wizard's progress strip — three pills the host walks through:
 * Scan → Verify → Share. Rendered on every step's page (items page
 * stages + the room page) so the table can always see where they
 * are in the flow. Done steps fade so the eye lands on the active
 * pill while the checked-off ones stay visible behind.
 */
export default function StepHeader({ step, t }: { step: WizardStep; t: Strings }) {
  const labels = [t.steps.scan, t.steps.verify, t.steps.share];
  const activeIndex = step === "scan" ? 0 : step === "verify" ? 1 : 2;
  return (
    <header className="flex items-center gap-2">
      {labels.map((label, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        const barClass = isActive ? "bg-swish" : isDone ? "bg-swish/35" : "bg-gray-200";
        const labelClass = isActive
          ? "font-semibold text-swish-dark"
          : isDone
          ? "text-swish-dark/45"
          : "text-gray-400";
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full ${barClass}`} />
            <span className={`text-[11px] ${labelClass}`}>{label}</span>
          </div>
        );
      })}
    </header>
  );
}
