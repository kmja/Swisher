import { APPLE_ICONS, NOTO_ICONS } from "@/components/ItemIcons";
import { CUSTOM_ICON_NAMES } from "@/lib/categories";

export const metadata = { title: "Custom icons – debug" };

/** Debug gallery: each hand-drawn icon in both platform styles + its names. */
export default function IconDebugPage() {
  const ids = Object.keys(NOTO_ICONS);
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <a href="/" className="text-sm text-swish-dark underline">
        ← Back
      </a>
      <h1 className="mt-2 text-xl font-bold">Custom item icons</h1>
      <p className="mt-1 text-sm text-gray-500">
        {ids.length} icons, each in two styles. Left = <b>Apple</b> (glossy), right = <b>Android/Noto</b> (flat). The app
        picks one automatically based on the viewer&apos;s device.
      </p>
      <div className="mt-4 space-y-2">
        {ids.map((id) => {
          const Apple = APPLE_ICONS[id].Icon;
          const Noto = NOTO_ICONS[id].Icon;
          const names = CUSTOM_ICON_NAMES[id] ?? [];
          return (
            <div key={id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
              <span className="text-[40px] leading-none">
                <Apple />
              </span>
              <span className="text-[40px] leading-none">
                <Noto />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {NOTO_ICONS[id].label} <span className="text-xs font-normal text-gray-400">ci:{id}</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{names.join(" · ")}</p>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-bold">Default emoji (system font)</h2>
      <p className="mt-1 text-sm text-gray-500">
        How the platform renders real emoji — for comparison with the custom icons above.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {DEFAULT_EMOJI.map(([emoji, label]) => (
          <div key={label} className="flex w-[68px] flex-col items-center gap-1 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
            <span className="text-[34px] leading-none">{emoji}</span>
            <span className="text-[10px] text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

const DEFAULT_EMOJI: [string, string][] = [
  ["☕", "kaffe"],
  ["🍺", "öl"],
  ["🍷", "vin"],
  ["🍸", "cocktail"],
  ["🥃", "sprit"],
  ["🥤", "läsk"],
  ["🍕", "pizza"],
  ["🍔", "burgare"],
  ["🍟", "pommes"],
  ["🍣", "sushi"],
  ["🦪", "ostron"],
  ["🍤", "räkor"],
  ["🐟", "fisk"],
  ["🍗", "kyckling"],
  ["🥩", "kött"],
  ["🥗", "sallad"],
  ["🍲", "soppa"],
  ["🧀", "ost"],
  ["🥦", "grönsak"],
  ["🍄", "svamp"],
  ["🍨", "glass"],
  ["🥐", "wienerbröd"],
  ["🍰", "tårta"],
  ["🍽️", "övrigt"],
];
