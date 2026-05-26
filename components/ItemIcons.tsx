import type { ReactNode } from "react";

/** Hand-drawn icons for common items that lack a good Unicode emoji, drawn to
 *  match the platform (Noto/Android) emoji look: bold, rounded, saturated, flat
 *  two-tone shading, no hairline outlines. 24×24, rendered at 1em like an emoji. */
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
      <circle cx="12" cy="12" r="10.5" fill="#E0944A" />
      <path d="M12 22.5a10.5 10.5 0 0 0 10.4-9c-1 5-5.4 7.5-10.4 7.5S2.6 18.5 1.6 13.5a10.5 10.5 0 0 0 10.4 9Z" fill="#C2772E" />
      <ellipse cx="9.5" cy="8.8" rx="6.2" ry="4.6" fill="#EFB069" />
      <path
        d="M12 3.6 A8.4 8.4 0 0 1 12 20.4 A7 7 0 0 1 12 6.4 A5.6 5.6 0 0 1 12 17.6 A4.2 4.2 0 0 1 12 9.2 A2.8 2.8 0 0 1 12 14.8 A1.4 1.4 0 0 1 12 12"
        fill="none"
        stroke="#7A4521"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g fill="#fff">
        <circle cx="9" cy="7.4" r="0.95" />
        <circle cx="14.4" cy="7.1" r="0.95" />
        <circle cx="16.8" cy="11" r="0.95" />
        <circle cx="7.1" cy="12.4" r="0.95" />
        <circle cx="11.2" cy="5.9" r="0.95" />
        <circle cx="13.6" cy="16.6" r="0.95" />
        <circle cx="8.2" cy="15.8" r="0.95" />
      </g>
    </Svg>
  );
}

function Semla() {
  return (
    <Svg label="Semla">
      <ellipse cx="12" cy="16.5" rx="9.5" ry="5.5" fill="#E0944A" />
      <ellipse cx="12" cy="16.5" rx="9.5" ry="5.5" fill="#C2772E" fillOpacity="0" />
      <path d="M2.5 16.5c0 3 4.3 5 9.5 5s9.5-2 9.5-5c0 .6 0 4.5-9.5 4.5S2.5 17.1 2.5 16.5Z" fill="#C2772E" />
      <ellipse cx="12" cy="13" rx="8" ry="3.2" fill="#FFFDF7" />
      <ellipse cx="12" cy="9.6" rx="7.4" ry="3.7" fill="#EAA85A" />
      <ellipse cx="10" cy="8.4" rx="4" ry="1.8" fill="#F4BE76" />
      <g fill="#fff">
        <circle cx="8.6" cy="9.4" r="0.8" />
        <circle cx="12" cy="8.4" r="0.8" />
        <circle cx="15.2" cy="9.6" r="0.8" />
      </g>
    </Svg>
  );
}

function Snaps() {
  return (
    <Svg label="Snaps">
      <path d="M8 4h8l-1.6 7.2c-.3 1.3-4.5 1.3-4.8 0Z" fill="#D7E8F5" />
      <path d="M9 7.8h6l-.6 3.4c-.3 1.3-4.5 1.3-4.8 0Z" fill="#BBDDF2" />
      <ellipse cx="11" cy="5" rx="2.2" ry="0.8" fill="#fff" fillOpacity="0.5" />
      <rect x="11.2" y="11.6" width="1.6" height="6" rx="0.8" fill="#AFC4D6" />
      <rect x="7.5" y="17.4" width="9" height="1.8" rx="0.9" fill="#AFC4D6" />
    </Svg>
  );
}

function Kottbullar() {
  return (
    <Svg label="Köttbullar">
      <ellipse cx="12" cy="17" rx="10.5" ry="4" fill="#E9E9E9" />
      <ellipse cx="12" cy="16.2" rx="10.5" ry="4" fill="#D6D6D6" fillOpacity="0.0" />
      <path d="M1.5 17c0 2.2 4.7 4 10.5 4s10.5-1.8 10.5-4c0 .5 0 3.4-10.5 3.4S1.5 17.5 1.5 17Z" fill="#CBCBCB" />
      <ellipse cx="12" cy="15.2" rx="8.3" ry="2.8" fill="#EFE0C0" />
      <circle cx="5" cy="15" r="1.1" fill="#D62F2A" />
      <circle cx="19" cy="15" r="1.1" fill="#D62F2A" />
      <circle cx="7.6" cy="13.4" r="3.4" fill="#8A5230" />
      <circle cx="16.2" cy="13.2" r="3.2" fill="#8A5230" />
      <circle cx="12" cy="13.8" r="3.6" fill="#925836" />
      <ellipse cx="6.6" cy="12.1" rx="1.2" ry="0.8" fill="#AE7044" />
      <ellipse cx="15.2" cy="12" rx="1.1" ry="0.7" fill="#AE7044" />
      <ellipse cx="11" cy="12.5" rx="1.3" ry="0.8" fill="#B0764A" />
    </Svg>
  );
}

function Skagen() {
  return (
    <Svg label="Toast Skagen">
      <rect x="3" y="11" width="18" height="8" rx="2.5" fill="#E6A94F" />
      <path d="M3 16.5c0 1.4 1.1 2.5 2.5 2.5h13c1.4 0 2.5-1.1 2.5-2.5v-1c0 1.4-1.1 2-2.5 2h-13c-1.4 0-2.5-.6-2.5-2Z" fill="#C98A35" />
      <path d="M4.5 11.5C8 6 16 6 19.5 11.5 16 14 8 14 4.5 11.5Z" fill="#F5A8A0" />
      <path d="M5.5 10.2C9 6.5 15 6.5 18.5 10.2 15 8.4 9 8.4 5.5 10.2Z" fill="#F9BEB7" />
      <circle cx="9" cy="9.8" r="0.85" fill="#F07A2E" />
      <circle cx="12" cy="9" r="0.85" fill="#F07A2E" />
      <circle cx="15" cy="9.8" r="0.85" fill="#F07A2E" />
      <path d="M12 8.6v-2.4M12 8.6l-1.4-1.6M12 8.6l1.4-1.6" stroke="#4E9A4E" strokeWidth="1" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function Prinsesstarta() {
  return (
    <Svg label="Prinsesstårta">
      <path d="M2.5 18 A9.5 9 0 0 1 21.5 18 Z" fill="#6FC07C" />
      <path d="M3.6 14C6 9.5 18 9.5 20.4 14 16.5 12 7.5 12 3.6 14Z" fill="#88D293" />
      <ellipse cx="12" cy="18" rx="9.5" ry="1.6" fill="#E6E6E6" />
      <path d="M4 16.5c1.4 1.2 14.6 1.2 16 0-1 1.6-15 1.6-16 0Z" fill="#FFF6E6" />
      <circle cx="12" cy="8" r="2.6" fill="#E879A8" />
      <circle cx="12" cy="8" r="1.1" fill="#D45C92" />
      <path d="M10 10c1.3 1 2.7 1 4 0" stroke="#4A9050" strokeWidth="1" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function Glogg() {
  return (
    <Svg label="Glögg">
      <path d="M6 8.5h9.5v4.5c0 3-2 5-4.75 5S6 16 6 13Z" fill="#fff" />
      <path d="M7.2 9.5h7.1V13c0 2.4-1.5 4-3.55 4S7.2 15.4 7.2 13Z" fill="#A4192C" />
      <path d="M7.2 9.5h7.1v1.4c-1.5.7-5.6.7-7.1 0Z" fill="#C13344" />
      <path d="M15.5 9.8c2.8.3 2.8 4.7 0 5" fill="none" stroke="#cfd6df" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.3 6.8c1-1.4 0-2.4 0-3.6" stroke="#D7DEE6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M12.4 6.8c1-1.4 0-2.4 0-3.6" stroke="#D7DEE6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="9.5" cy="10.8" r="0.8" fill="#E8C9A0" />
      <circle cx="12.4" cy="11.4" r="0.8" fill="#E8C9A0" />
    </Svg>
  );
}

function Lojrom() {
  return (
    <Svg label="Löjrom">
      <circle cx="12" cy="15" r="6.5" fill="#E6A94F" />
      <path d="M12 21.5a6.5 6.5 0 0 0 6.4-5.5c-.8 3-3.5 4.2-6.4 4.2s-5.6-1.2-6.4-4.2a6.5 6.5 0 0 0 6.4 5.5Z" fill="#C98A35" />
      <ellipse cx="12" cy="13.4" rx="4.9" ry="2.8" fill="#FFFDF7" />
      <g fill="#F07A2E">
        <circle cx="10.4" cy="11.4" r="0.95" />
        <circle cx="12" cy="10.9" r="0.95" />
        <circle cx="13.6" cy="11.4" r="0.95" />
        <circle cx="11.1" cy="12.4" r="0.95" />
        <circle cx="12.9" cy="12.4" r="0.95" />
        <circle cx="12" cy="12.7" r="0.95" />
      </g>
      <g fill="#F9A45F">
        <circle cx="11.7" cy="11.2" r="0.32" />
        <circle cx="13.3" cy="11.2" r="0.32" />
      </g>
      <path d="M14.8 10.5l1-1.2" stroke="#4E9A4E" strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

function EnergyCan() {
  return (
    <Svg label="Energidryck">
      <rect x="7" y="3" width="10" height="18" rx="2.6" fill="#2E6BE6" />
      <rect x="7" y="3" width="3.2" height="18" rx="1.6" fill="#5A8CEF" />
      <ellipse cx="12" cy="3.4" rx="4.8" ry="1.3" fill="#AFC7F3" />
      <rect x="7" y="9" width="10" height="6" fill="#13347d" fillOpacity="0.3" />
      <path d="M13 5.6 9 12.8h2.5L10.4 18.4 15.4 10.6h-2.7Z" fill="#FFD23F" />
    </Svg>
  );
}

function Macaron() {
  return (
    <Svg label="Macaron">
      <path d="M3.5 10.2C3.5 7.6 7.3 6 12 6s8.5 1.6 8.5 4.2-3.8 3-8.5 3-8.5-.4-8.5-3Z" fill="#F2A8C4" />
      <path d="M3.6 9.2C5 7.4 8.3 6.6 12 6.6s7 .8 8.4 2.6C18.7 7.8 15.5 7.2 12 7.2s-6.7.6-8.4 2Z" fill="#F8C3D8" />
      <rect x="3.5" y="10" width="17" height="3.4" rx="1.5" fill="#FBE3C4" />
      <path d="M3.5 13.6c0 2.6 3.8 4.2 8.5 4.2s8.5-1.6 8.5-4.2c0 2.6-3.8 3.4-8.5 3.4s-8.5-.8-8.5-3.4Z" fill="#F2A8C4" />
      <path d="M3.5 13.4c.6 1.3 2.4 1.6 4.2 1.7-1.8.3-3.6-.1-4.2-1.7Zm12.8 1.7c1.8-.1 3.6-.4 4.2-1.7-.6 1.6-2.4 2-4.2 1.7Z" fill="#E58FB1" />
    </Svg>
  );
}

function Paella() {
  return (
    <Svg label="Paella">
      <rect x="0.5" y="12" width="5" height="2" rx="1" fill="#7a7a7a" />
      <rect x="18.5" y="12" width="5" height="2" rx="1" fill="#7a7a7a" />
      <circle cx="12" cy="13" r="8.3" fill="#E8C24A" />
      <path d="M12 21.3a8.3 8.3 0 0 0 8.2-7c-.9 3.8-4.5 5.5-8.2 5.5S4.7 18.1 3.8 14.3a8.3 8.3 0 0 0 8.2 7Z" fill="#CFA62F" />
      <ellipse cx="9.5" cy="10" rx="4.5" ry="2.6" fill="#F0D472" />
      <path d="M7.2 11c1.1-1.2 2.3-1.2 3.4 0" fill="none" stroke="#E0532B" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13.4 15c1.1-1.2 2.3-1.2 3.4 0" fill="none" stroke="#E0532B" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11" cy="15.3" r="1" fill="#5BA34F" />
      <circle cx="15" cy="10.3" r="1" fill="#5BA34F" />
      <circle cx="8.8" cy="13.9" r="1" fill="#5BA34F" />
      <path d="M11.5 11.4 14 12.5l-2.5 1.1Z" fill="#3a3340" />
    </Svg>
  );
}

function Poke() {
  return (
    <Svg label="Poke bowl">
      <path d="M3.5 11.5h17C20.5 17 16.5 21 12 21S3.5 17 3.5 11.5Z" fill="#fff" />
      <path d="M3.5 11.5h17c0 1-.1 2-.4 2.9C18 15 6 15 3.9 14.4 3.6 13.5 3.5 12.5 3.5 11.5Z" fill="#E4E9EE" />
      <ellipse cx="12" cy="11.5" rx="8.3" ry="2.5" fill="#F4ECD8" />
      <rect x="6.2" y="9" width="3.2" height="3.2" rx="0.6" fill="#F2918A" transform="rotate(10 8 11)" />
      <rect x="13" y="9.3" width="3.2" height="3.2" rx="0.6" fill="#F2918A" transform="rotate(-8 14.5 11)" />
      <path d="M9.4 9.2c1.6-1 3.2-1 4.8 0-1.6 1.1-3.2 1.1-4.8 0Z" fill="#8FBF5B" />
      <circle cx="16.7" cy="11" r="0.85" fill="#5BA34F" />
      <circle cx="7.3" cy="11.4" r="0.75" fill="#5BA34F" />
    </Svg>
  );
}

function Tartare() {
  return (
    <Svg label="Tartare / råbiff">
      <ellipse cx="12" cy="16.5" rx="9.5" ry="3" fill="#E9E9E9" />
      <path d="M2.5 16.5c0 1.7 4.3 3 9.5 3s9.5-1.3 9.5-3c0 .4 0 2.6-9.5 2.6S2.5 16.9 2.5 16.5Z" fill="#CBCBCB" />
      <path d="M4.5 15.4C8 8.4 16 8.4 19.5 15.4 16 17.4 8 17.4 4.5 15.4Z" fill="#CE4A41" />
      <path d="M5.6 13.8C9 9.4 15 9.4 18.4 13.8 15 12.2 9 12.2 5.6 13.8Z" fill="#D96259" />
      <circle cx="12" cy="12.6" r="2.6" fill="#F6B61E" />
      <ellipse cx="11.2" cy="11.8" rx="1" ry="0.6" fill="#FAD06A" />
      <circle cx="8" cy="14.6" r="0.7" fill="#4E9A4E" />
      <circle cx="16" cy="14.6" r="0.7" fill="#7a4a8a" />
    </Svg>
  );
}

function FishAndChips() {
  return (
    <Svg label="Fish & chips">
      <path d="M2 9.5C2 7 6.4 6 11 6c5.5 0 9 1.8 9 3.5S16.5 13 11 13C6.4 13 2 12 2 9.5Z" fill="#E2A84E" />
      <path d="M2.2 8.6C3.6 7 7 6.6 11 6.6c4.5 0 7.4 1 8.6 2.4C18 7.6 14.5 7.2 11 7.2c-4 0-7.4.4-8.8 1.4Z" fill="#EDBE6E" />
      <circle cx="7" cy="10" r="0.7" fill="#C68B3A" />
      <circle cx="11" cy="10.8" r="0.7" fill="#C68B3A" />
      <g fill="#F2C14E">
        <rect x="12.4" y="14.6" width="2" height="7" rx="1" transform="rotate(-14 13.4 18)" />
        <rect x="15.6" y="14" width="2" height="7.6" rx="1" />
        <rect x="18.8" y="14.6" width="2" height="7" rx="1" transform="rotate(14 19.8 18)" />
      </g>
      <g fill="#F7D27A">
        <rect x="12.7" y="14.8" width="0.7" height="6.4" rx="0.35" transform="rotate(-14 13 18)" />
        <rect x="15.9" y="14.2" width="0.7" height="7" rx="0.35" />
      </g>
    </Svg>
  );
}

function Charcuterie() {
  return (
    <Svg label="Charcuterie / ostbricka">
      <rect x="2" y="6.5" width="20" height="12" rx="2.5" fill="#B8763D" />
      <rect x="2" y="6.5" width="20" height="3" rx="2.5" fill="#C98E54" />
      <path d="M4 16.5 11 8.5 11 16.5Z" fill="#F3C53B" />
      <path d="M4 16.5 11 8.5 11 10Z" fill="#F8D970" />
      <circle cx="13.5" cy="10.5" r="2" fill="#C94A44" />
      <circle cx="17" cy="12.6" r="2" fill="#C94A44" />
      <circle cx="13.5" cy="10.5" r="0.7" fill="#E07a74" />
      <g fill="#7a4a8a">
        <circle cx="14.2" cy="15.3" r="0.95" />
        <circle cx="16" cy="15.6" r="0.95" />
        <circle cx="15.1" cy="16.4" r="0.95" />
      </g>
    </Svg>
  );
}

function Nachos() {
  return (
    <Svg label="Nachos">
      <g fill="#E8B84E">
        <path d="M3 17.5 6.5 10 10 17.5Z" />
        <path d="M6.5 17 11 7.5 15.5 17Z" />
        <path d="M11.5 18 16 8.5 20.5 18Z" />
      </g>
      <g fill="#F2CC6A">
        <path d="M5 16.5 6.5 13 8 16.5Z" />
        <path d="M9 16 11 11 13 16Z" />
        <path d="M14 17 16 12 18 17Z" />
      </g>
      <path d="M7.5 12c1.6 1 3.2 1 4.8 0" fill="none" stroke="#F3D26A" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="13.4" r="1" fill="#5BA34F" />
      <circle cx="9" cy="14.6" r="0.85" fill="#C0504A" />
    </Svg>
  );
}

function Tiramisu() {
  return (
    <Svg label="Tiramisu">
      <rect x="3.5" y="8.5" width="17" height="10" rx="1.6" fill="#F3E3C3" />
      <rect x="3.5" y="12.2" width="17" height="2.6" fill="#A9764B" />
      <rect x="3.5" y="8.5" width="17" height="2.6" rx="1.6" fill="#6B4423" />
      <rect x="3.5" y="15.6" width="17" height="2.9" rx="1.6" fill="#E7D4AC" />
      <g fill="#4a2f17">
        <circle cx="7.5" cy="9.7" r="0.45" />
        <circle cx="12" cy="9.4" r="0.45" />
        <circle cx="16.5" cy="9.8" r="0.45" />
        <circle cx="9.8" cy="10.4" r="0.4" />
        <circle cx="14.5" cy="10.2" r="0.4" />
      </g>
    </Svg>
  );
}

function Spritz() {
  return (
    <Svg label="Aperol Spritz">
      <path d="M5.5 5h13l-2.3 8.2c-.4 1.4-8 1.4-8.4 0Z" fill="#F2902B" />
      <path d="M6.4 6.2h11.2l-.5 1.8c-1.6.8-8.6.8-10.2 0Z" fill="#F8AE50" />
      <rect x="11.2" y="13.4" width="1.6" height="5.6" rx="0.8" fill="#C9CDD2" />
      <rect x="8" y="18.8" width="8" height="1.8" rx="0.9" fill="#C9CDD2" />
      <circle cx="16.4" cy="5.6" r="2.5" fill="#F7B733" />
      <circle cx="16.4" cy="5.6" r="2.5" fill="none" stroke="#E0922B" strokeWidth="0.5" />
      <path d="M16.4 3.1v5M13.9 5.6h5" stroke="#E0922B" strokeWidth="0.5" />
      <rect x="8.6" y="2.4" width="1.3" height="11" rx="0.6" fill="#D6483B" transform="rotate(10 9 8)" />
    </Svg>
  );
}

function GinTonic() {
  return (
    <Svg label="Gin & Tonic">
      <rect x="6.5" y="4.5" width="11" height="15.5" rx="2" fill="#DCEDF8" />
      <rect x="6.5" y="4.5" width="3.4" height="15.5" rx="1.8" fill="#EAF5FC" />
      <path d="M8.5 5.5a3.5 3 0 0 1 7 0Z" fill="#7DBE3C" />
      <path d="M8.5 5.5a3.5 3 0 0 1 7 0c-1.2-1-5.8-1-7 0Z" fill="#97D156" />
      <rect x="12.6" y="2.6" width="1.3" height="16.5" rx="0.6" fill="#3a55c0" transform="rotate(7 13 10)" />
      <circle cx="9.5" cy="12" r="0.7" fill="#fff" />
      <circle cx="13" cy="14.5" r="0.6" fill="#fff" />
      <circle cx="11" cy="9.5" r="0.6" fill="#fff" />
      <circle cx="12.5" cy="16.8" r="0.6" fill="#fff" />
    </Svg>
  );
}

function Burrata() {
  return (
    <Svg label="Burrata / Caprese">
      <ellipse cx="12" cy="16.5" rx="9.5" ry="2.8" fill="#E9E9E9" />
      <path d="M2.5 16.5c0 1.5 4.3 2.8 9.5 2.8s9.5-1.3 9.5-2.8c0 .4 0 2.4-9.5 2.4S2.5 16.9 2.5 16.5Z" fill="#CBCBCB" />
      <circle cx="6.8" cy="14" r="2.6" fill="#E0532B" />
      <circle cx="17.2" cy="14" r="2.6" fill="#E0532B" />
      <circle cx="6.8" cy="14" r="1.1" fill="#EE7250" />
      <circle cx="17.2" cy="14" r="1.1" fill="#EE7250" />
      <circle cx="12" cy="12.4" r="4" fill="#fff" />
      <ellipse cx="10.5" cy="11" rx="1.6" ry="1" fill="#FFFFFF" />
      <path d="M12 7.6c1.8.6 0 2.4 0 2.4s-1.8-1.8 0-2.4Z" fill="#4E9A4E" />
      <circle cx="9" cy="11" r="0.5" fill="#9BBF3C" />
      <circle cx="15" cy="11" r="0.5" fill="#9BBF3C" />
    </Svg>
  );
}

function Churros() {
  return (
    <Svg label="Churros">
      <g stroke="#D9952B" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <line x1="5" y1="4" x2="7.7" y2="18" />
        <line x1="9" y1="4" x2="10.7" y2="18" />
      </g>
      <g stroke="#EBB55A" strokeWidth="0.9" strokeLinecap="round" fill="none">
        <line x1="4.6" y1="4.2" x2="7.3" y2="18" />
        <line x1="8.6" y1="4.2" x2="10.3" y2="18" />
      </g>
      <g fill="#fff">
        <circle cx="6" cy="8" r="0.55" />
        <circle cx="7" cy="13" r="0.55" />
        <circle cx="9.5" cy="9" r="0.55" />
        <circle cx="10" cy="14" r="0.55" />
      </g>
      <path d="M13.5 12.5H21v2.5c0 2.8-1.7 4.5-3.75 4.5S13.5 17.8 13.5 15Z" fill="#6B4423" />
      <ellipse cx="17.25" cy="12.7" rx="3.75" ry="1" fill="#7a5230" />
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
