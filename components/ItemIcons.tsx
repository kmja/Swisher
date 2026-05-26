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
};
