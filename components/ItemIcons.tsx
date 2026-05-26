import type { ReactNode } from "react";

/** Hand-drawn icons for common Swedish items that lack a good Unicode emoji.
 *  Each is a 24×24 SVG rendered at 1em so it sits inline like an emoji. */
function Svg({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" role="img" aria-label={label} className="inline-block align-[-0.125em]">
      {children}
    </svg>
  );
}

function CinnamonBun() {
  return (
    <Svg label="Kanelbulle">
      <circle cx="12" cy="12" r="10.5" fill="#E3A65A" stroke="#B26B2E" strokeWidth="1" />
      <path
        d="M12 3 A8.25 8.25 0 0 1 12 19.5 A6.75 6.75 0 0 1 12 6 A5.25 5.25 0 0 1 12 16.5 A3.75 3.75 0 0 1 12 9 A2.25 2.25 0 0 1 12 13.5 A0.75 0.75 0 0 1 12 12"
        fill="none"
        stroke="#7A4A24"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <g fill="#fff">
        <circle cx="9" cy="7.6" r="0.85" />
        <circle cx="14.2" cy="7.2" r="0.85" />
        <circle cx="16.6" cy="11" r="0.85" />
        <circle cx="7.2" cy="12.2" r="0.85" />
        <circle cx="11.2" cy="6.2" r="0.85" />
        <circle cx="13.4" cy="16.4" r="0.85" />
        <circle cx="8.4" cy="15.6" r="0.85" />
      </g>
    </Svg>
  );
}

function Semla() {
  return (
    <Svg label="Semla">
      <ellipse cx="12" cy="16" rx="9" ry="5" fill="#E3A65A" stroke="#B26B2E" strokeWidth="0.6" />
      <ellipse cx="12" cy="13" rx="7.6" ry="3" fill="#fffdf7" />
      <ellipse cx="12" cy="10.2" rx="7" ry="3.4" fill="#E8AE62" stroke="#B26B2E" strokeWidth="0.6" />
      <circle cx="9" cy="9.9" r="0.7" fill="#fff" />
      <circle cx="12" cy="9" r="0.7" fill="#fff" />
      <circle cx="15" cy="9.9" r="0.7" fill="#fff" />
    </Svg>
  );
}

function Snaps() {
  return (
    <Svg label="Snaps">
      <path d="M8.4 4 L15.6 4 L14 11 Q12 12.2 10 11 Z" fill="#E6F0F7" stroke="#8FA4B8" strokeWidth="0.9" />
      <path d="M9.1 7.6 L14.9 7.6 L14 11 Q12 12.2 10 11 Z" fill="#CFE3F3" />
      <line x1="12" y1="11.6" x2="12" y2="17.4" stroke="#8FA4B8" strokeWidth="1.3" />
      <line x1="8" y1="18" x2="16" y2="18" stroke="#8FA4B8" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

function Kottbullar() {
  return (
    <Svg label="Köttbullar">
      <ellipse cx="12" cy="17" rx="10" ry="3.5" fill="#ededed" stroke="#cfcfcf" strokeWidth="0.5" />
      <ellipse cx="12" cy="15.4" rx="8" ry="2.6" fill="#F2E8D0" />
      <circle cx="5" cy="15.2" r="1" fill="#C62433" />
      <circle cx="19" cy="15.2" r="1" fill="#C62433" />
      <circle cx="8" cy="13.6" r="3.1" fill="#8A5A2F" />
      <circle cx="16" cy="13.4" r="3" fill="#8A5A2F" />
      <circle cx="12.3" cy="14" r="3.3" fill="#915F32" />
      <circle cx="7" cy="12.6" r="0.7" fill="#AE7A44" />
      <circle cx="15" cy="12.5" r="0.7" fill="#AE7A44" />
      <circle cx="11.4" cy="13" r="0.7" fill="#B07E48" />
    </Svg>
  );
}

function Skagen() {
  return (
    <Svg label="Toast Skagen">
      <rect x="3.5" y="11" width="17" height="7" rx="2" fill="#E3B36A" stroke="#C68B3A" strokeWidth="0.7" />
      <path d="M5 11.5 Q12 6.4 19 11.5 Q12 14 5 11.5 Z" fill="#F2A6A0" stroke="#E08A84" strokeWidth="0.4" />
      <circle cx="9" cy="10" r="0.7" fill="#E8732B" />
      <circle cx="12" cy="9.2" r="0.7" fill="#E8732B" />
      <circle cx="15" cy="10" r="0.7" fill="#E8732B" />
      <path d="M12 8.6 v-2 M12 8.6 l-1.2 -1.4 M12 8.6 l1.2 -1.4" stroke="#4E9A4E" strokeWidth="0.7" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Prinsesstarta() {
  return (
    <Svg label="Prinsesstårta">
      <path d="M3.5 17.5 A8.5 8.5 0 0 1 20.5 17.5 Z" fill="#8FCB9B" stroke="#5FA873" strokeWidth="0.7" />
      <path d="M4.2 16 Q12 18.2 19.8 16" fill="none" stroke="#fffdf7" strokeWidth="1.4" />
      <line x1="2.5" y1="17.6" x2="21.5" y2="17.6" stroke="#d4d4d4" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="8.4" r="2.2" fill="#E68BAE" />
      <circle cx="12" cy="8.4" r="0.9" fill="#D46B95" />
      <path d="M10.4 10.1 q1.6 1.1 3.2 0" fill="none" stroke="#5FA873" strokeWidth="0.7" />
    </Svg>
  );
}

function Glogg() {
  return (
    <Svg label="Glögg">
      <path d="M6.5 8 H15.5 V13 Q15.5 17.5 11 17.5 Q6.5 17.5 6.5 13 Z" fill="#fff" stroke="#9aa4b2" strokeWidth="0.9" />
      <path d="M7.4 9 H14.6 V13 Q14.6 16.6 11 16.6 Q7.4 16.6 7.4 13 Z" fill="#9E1B2F" />
      <path d="M15.5 9.4 q4 0.6 0 5" fill="none" stroke="#9aa4b2" strokeWidth="1.4" />
      <path d="M9.3 6.6 q1 -1.4 0 -3" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
      <path d="M12.6 6.6 q1 -1.4 0 -3" fill="none" stroke="#cbd5e1" strokeWidth="1" strokeLinecap="round" />
      <circle cx="9.6" cy="10.6" r="0.7" fill="#E8C9A0" />
      <circle cx="12.6" cy="11.2" r="0.7" fill="#E8C9A0" />
    </Svg>
  );
}

function Lojrom() {
  return (
    <Svg label="Löjrom">
      <circle cx="12" cy="15" r="6" fill="#E3B36A" stroke="#C68B3A" strokeWidth="0.7" />
      <ellipse cx="12" cy="13.6" rx="4.6" ry="2.6" fill="#fffdf7" />
      <g fill="#E8732B">
        <circle cx="10.5" cy="11.6" r="0.85" />
        <circle cx="12" cy="11.1" r="0.85" />
        <circle cx="13.5" cy="11.6" r="0.85" />
        <circle cx="11.2" cy="12.5" r="0.85" />
        <circle cx="12.8" cy="12.5" r="0.85" />
        <circle cx="12" cy="12.7" r="0.85" />
      </g>
      <path d="M14.6 10.6 l0.9 -1.1" stroke="#4E9A4E" strokeWidth="0.7" strokeLinecap="round" />
    </Svg>
  );
}

function EnergyCan() {
  return (
    <Svg label="Energidryck">
      <rect x="7" y="3" width="10" height="18" rx="2.5" fill="#2E6BE6" stroke="#1E4FB0" strokeWidth="0.7" />
      <ellipse cx="12" cy="3.6" rx="4.6" ry="1.2" fill="#A7C2F2" />
      <rect x="7" y="9.5" width="10" height="5" fill="#10337a" opacity="0.25" />
      <path d="M13 6 L9.2 12.6 L11.6 12.6 L10.6 18 L15 10.4 L12.4 10.4 Z" fill="#FFD23F" stroke="#E0A500" strokeWidth="0.3" />
    </Svg>
  );
}

function Macaron() {
  return (
    <Svg label="Macaron">
      <path d="M4 10 A8 4.5 0 0 1 20 10 Z" fill="#F2C2D6" stroke="#E197B6" strokeWidth="0.4" />
      <rect x="4" y="9.8" width="16" height="3.2" rx="0.6" fill="#FBE3C4" />
      <path d="M4 13 A8 4.5 0 0 0 20 13 Z" fill="#F2C2D6" stroke="#E197B6" strokeWidth="0.4" />
      <circle cx="7" cy="13" r="0.5" fill="#E197B6" />
      <circle cx="17" cy="13" r="0.5" fill="#E197B6" />
    </Svg>
  );
}

function Paella() {
  return (
    <Svg label="Paella">
      <line x1="1.5" y1="13" x2="5" y2="13" stroke="#7a7a7a" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="19" y1="13" x2="22.5" y2="13" stroke="#7a7a7a" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="13" r="8" fill="#E8C24A" stroke="#A9772A" strokeWidth="0.8" />
      <path d="M7.5 11 q1.6 -1.7 3.2 0" fill="none" stroke="#E0532B" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 15 q1.6 -1.7 3.2 0" fill="none" stroke="#E0532B" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="15.2" r="0.9" fill="#5BA34F" />
      <circle cx="15" cy="10.4" r="0.9" fill="#5BA34F" />
      <circle cx="8.8" cy="13.8" r="0.9" fill="#5BA34F" />
      <path d="M11.6 11.6 l2 1 -2 1 z" fill="#3a3340" />
    </Svg>
  );
}

function Poke() {
  return (
    <Svg label="Poke bowl">
      <path d="M4 11.5 Q12 22 20 11.5 Z" fill="#fff" stroke="#cbd5e1" strokeWidth="0.9" />
      <ellipse cx="12" cy="11.6" rx="8" ry="2.3" fill="#F4ECD8" />
      <rect x="6.5" y="9.3" width="2.8" height="2.8" rx="0.4" fill="#F2918A" transform="rotate(10 8 11)" />
      <rect x="13" y="9.6" width="2.8" height="2.8" rx="0.4" fill="#F2918A" transform="rotate(-8 14 11)" />
      <path d="M9.6 9.4 q2.2 -1.4 4.4 0 q-2.2 1.1 -4.4 0 Z" fill="#8FBF5B" />
      <circle cx="16.5" cy="11" r="0.7" fill="#5BA34F" />
      <circle cx="7.5" cy="11.3" r="0.6" fill="#5BA34F" />
    </Svg>
  );
}

function Tartare() {
  return (
    <Svg label="Tartare / råbiff">
      <ellipse cx="12" cy="16.5" rx="9" ry="2.8" fill="#eee" stroke="#cfcfcf" strokeWidth="0.5" />
      <path d="M5 15.5 Q12 8.5 19 15.5 Q12 17.4 5 15.5 Z" fill="#C6453C" />
      <circle cx="12" cy="12.8" r="2.4" fill="#F6B73C" stroke="#E09A20" strokeWidth="0.4" />
      <circle cx="8" cy="14.4" r="0.6" fill="#4E9A4E" />
      <circle cx="16" cy="14.4" r="0.6" fill="#7a4a8a" />
    </Svg>
  );
}

function FishAndChips() {
  return (
    <Svg label="Fish &amp; chips">
      <path d="M2.5 9 Q10 5.5 17.5 9 Q19.5 11 17.5 13 Q10 16.5 2.5 13 Q0.8 11 2.5 9 Z" fill="#E0A84E" stroke="#B8860B" strokeWidth="0.5" />
      <circle cx="7" cy="10.6" r="0.6" fill="#C68B3A" />
      <circle cx="11" cy="11.4" r="0.6" fill="#C68B3A" />
      <g fill="#F2C14E" stroke="#D9A441" strokeWidth="0.3">
        <rect x="13" y="15" width="1.7" height="6.5" rx="0.7" transform="rotate(-13 13.8 18)" />
        <rect x="16" y="14.5" width="1.7" height="7" rx="0.7" />
        <rect x="19" y="15" width="1.7" height="6.5" rx="0.7" transform="rotate(13 19.8 18)" />
      </g>
    </Svg>
  );
}

function Charcuterie() {
  return (
    <Svg label="Charcuterie / ostbricka">
      <rect x="2.5" y="7" width="19" height="11" rx="2" fill="#B07A43" stroke="#8A5A2F" strokeWidth="0.6" />
      <path d="M4.5 15.5 L10.5 9 L10.5 15.5 Z" fill="#F2D24B" stroke="#D9B400" strokeWidth="0.3" />
      <circle cx="13.5" cy="10.6" r="1.8" fill="#C0504A" stroke="#9c3f3a" strokeWidth="0.3" />
      <circle cx="17" cy="12.4" r="1.8" fill="#C0504A" stroke="#9c3f3a" strokeWidth="0.3" />
      <circle cx="14.2" cy="15.3" r="0.85" fill="#7a4a8a" />
      <circle cx="15.8" cy="15.6" r="0.85" fill="#7a4a8a" />
      <circle cx="15" cy="16.4" r="0.85" fill="#7a4a8a" />
    </Svg>
  );
}

function Nachos() {
  return (
    <Svg label="Nachos">
      <g fill="#E8B84E" stroke="#C68B3A" strokeWidth="0.4">
        <path d="M3.5 17 L6.5 11 L9.5 18 Z" />
        <path d="M6.5 16.5 L10.5 8.5 L13.5 16.5 Z" />
        <path d="M11.5 17.5 L15.5 9.5 L18.5 17.5 Z" />
      </g>
      <path d="M8 12 q2.2 1.2 4.4 0" fill="none" stroke="#F2D24B" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="13.2" r="0.8" fill="#5BA34F" />
      <circle cx="9" cy="14.4" r="0.7" fill="#C0504A" />
    </Svg>
  );
}

function Tiramisu() {
  return (
    <Svg label="Tiramisu">
      <rect x="4" y="9" width="16" height="9" rx="1" fill="#F3E3C3" />
      <rect x="4" y="12.4" width="16" height="2.2" fill="#A9764B" />
      <rect x="4" y="9" width="16" height="2.2" fill="#6B4423" />
      <rect x="4" y="9" width="16" height="9" rx="1" fill="none" stroke="#D9C49A" strokeWidth="0.6" />
      <circle cx="8" cy="10.1" r="0.4" fill="#3f2a15" />
      <circle cx="13.5" cy="9.8" r="0.4" fill="#3f2a15" />
      <circle cx="16.5" cy="10.2" r="0.4" fill="#3f2a15" />
    </Svg>
  );
}

function Spritz() {
  return (
    <Svg label="Aperol Spritz">
      <path d="M6 5 H18 L15.8 13 Q12 15 8.2 13 Z" fill="#F59A2E" fillOpacity="0.9" stroke="#D97A1A" strokeWidth="0.7" />
      <line x1="12" y1="14" x2="12" y2="19" stroke="#bbb" strokeWidth="1.1" />
      <line x1="8.5" y1="19.5" x2="15.5" y2="19.5" stroke="#bbb" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="16.5" cy="5.5" r="2.3" fill="#F7B733" stroke="#E0922B" strokeWidth="0.4" />
      <path d="M16.5 3.2 v4.6 M14.2 5.5 h4.6" stroke="#E0922B" strokeWidth="0.35" />
      <line x1="9" y1="2.5" x2="11" y2="13" stroke="#D6483B" strokeWidth="0.9" strokeLinecap="round" />
    </Svg>
  );
}

function GinTonic() {
  return (
    <Svg label="Gin &amp; Tonic">
      <rect x="7" y="4.5" width="10" height="15.5" rx="1.6" fill="#EAF4FB" fillOpacity="0.75" stroke="#9CB8CC" strokeWidth="0.8" />
      <path d="M9 5.5 a3 3 0 0 1 6 0 Z" fill="#7DBE3C" stroke="#5a9a2a" strokeWidth="0.4" />
      <line x1="13.6" y1="3" x2="12.4" y2="19" stroke="#3a55c0" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="10" cy="12" r="0.6" fill="#bcdcef" />
      <circle cx="13" cy="14.5" r="0.5" fill="#bcdcef" />
      <circle cx="11.5" cy="9.5" r="0.5" fill="#bcdcef" />
      <circle cx="12.5" cy="16.5" r="0.5" fill="#bcdcef" />
    </Svg>
  );
}

function Burrata() {
  return (
    <Svg label="Burrata / Caprese">
      <ellipse cx="12" cy="16.5" rx="9" ry="2.6" fill="#eee" stroke="#cfcfcf" strokeWidth="0.5" />
      <circle cx="7" cy="14" r="2.4" fill="#E0532B" stroke="#c4451f" strokeWidth="0.3" />
      <circle cx="17" cy="14" r="2.4" fill="#E0532B" stroke="#c4451f" strokeWidth="0.3" />
      <circle cx="12" cy="12.6" r="3.7" fill="#fff" stroke="#e6e6e6" strokeWidth="0.5" />
      <path d="M12 8 q1.7 0.6 0 2.2 q-1.7 -0.6 0 -2.2 Z" fill="#4E9A4E" />
      <circle cx="9" cy="11" r="0.5" fill="#9BBF3C" />
      <circle cx="15" cy="11" r="0.5" fill="#9BBF3C" />
    </Svg>
  );
}

function Churros() {
  return (
    <Svg label="Churros">
      <g stroke="#D9952B" strokeWidth="2.3" strokeLinecap="round" fill="none">
        <line x1="5" y1="4" x2="7.5" y2="18" />
        <line x1="9" y1="4" x2="10.5" y2="18" />
      </g>
      <g fill="#fff">
        <circle cx="6" cy="8" r="0.5" />
        <circle cx="7" cy="13" r="0.5" />
        <circle cx="9.5" cy="9" r="0.5" />
        <circle cx="10" cy="14" r="0.5" />
      </g>
      <path d="M14 13 H21 V15 Q21 19 17.5 19 Q14 19 14 15 Z" fill="#6B4423" stroke="#4a2f17" strokeWidth="0.4" />
      <ellipse cx="17.5" cy="13.2" rx="3.5" ry="0.9" fill="#7a5230" />
    </Svg>
  );
}

/** Registry: icon id (matches the "ci:<id>" sentinel) → label + component. */
export const CUSTOM_ICONS: Record<string, { label: string; Icon: () => React.ReactElement }> = {
  bun: { label: "Kanelbulle", Icon: CinnamonBun },
  semla: { label: "Semla", Icon: Semla },
  snaps: { label: "Snaps / nubbe", Icon: Snaps },
  kottbullar: { label: "Köttbullar", Icon: Kottbullar },
  skagen: { label: "Toast Skagen", Icon: Skagen },
  prinsesstarta: { label: "Prinsesstårta", Icon: Prinsesstarta },
  glogg: { label: "Glögg", Icon: Glogg },
  lojrom: { label: "Löjrom", Icon: Lojrom },
  energidryck: { label: "Energidryck", Icon: EnergyCan },
  macaron: { label: "Macaron", Icon: Macaron },
  paella: { label: "Paella", Icon: Paella },
  poke: { label: "Poke bowl", Icon: Poke },
  tartare: { label: "Tartare / råbiff", Icon: Tartare },
  fishandchips: { label: "Fish & chips", Icon: FishAndChips },
  charcuterie: { label: "Charcuterie / ostbricka", Icon: Charcuterie },
  nachos: { label: "Nachos", Icon: Nachos },
  tiramisu: { label: "Tiramisu", Icon: Tiramisu },
  spritz: { label: "Aperol Spritz", Icon: Spritz },
  gintonic: { label: "Gin & Tonic", Icon: GinTonic },
  burrata: { label: "Burrata / Caprese", Icon: Burrata },
  churros: { label: "Churros", Icon: Churros },
};
