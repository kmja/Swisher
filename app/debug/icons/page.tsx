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
    </main>
  );
}
