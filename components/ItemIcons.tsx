import type { ReactNode, ReactElement } from "react";

/** Hand-drawn icons for items that lack a good Unicode emoji. The same flat
 *  shapes render two ways: bare for the Android/Noto look, and wrapped in a
 *  soft specular gloss filter for the Apple look. 24×24, rendered at 1em. */
function Svg({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1.2em" height="1.2em" role="img" aria-label={label} className="inline-block align-[-0.18em]">
      {children}
    </svg>
  );
}

/** Subtle dimensional sheen that follows each icon's silhouette (Apple style). */
function GlossDefs() {
  return (
    <defs>
      <filter id="apple-gloss" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="b" />
        <feSpecularLighting in="b" surfaceScale="1.4" specularConstant="0.55" specularExponent="28" lightingColor="#ffffff" result="s">
          <feDistantLight azimuth="235" elevation="60" />
        </feSpecularLighting>
        <feComponentTransfer in="s" result="s2">
          <feFuncA type="linear" slope="0.35" />
        </feComponentTransfer>
        <feComposite in="s2" in2="SourceAlpha" operator="in" result="sc" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="sc" />
        </feMerge>
      </filter>
    </defs>
  );
}

function CinnamonBun() {
  return (
    <>
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
    </>
  );
}

function Semla() {
  return (
    <>
      <ellipse cx="12" cy="16.5" rx="9.5" ry="5.5" fill="#E0944A" />
      <path d="M2.5 16.5c0 3 4.3 5 9.5 5s9.5-2 9.5-5c0 .6 0 4.5-9.5 4.5S2.5 17.1 2.5 16.5Z" fill="#C2772E" />
      <ellipse cx="12" cy="13" rx="8" ry="3.2" fill="#FFFDF7" />
      <ellipse cx="12" cy="9.6" rx="7.4" ry="3.7" fill="#EAA85A" />
      <ellipse cx="10" cy="8.4" rx="4" ry="1.8" fill="#F4BE76" />
      <g fill="#fff">
        <circle cx="8.6" cy="9.4" r="0.8" />
        <circle cx="12" cy="8.4" r="0.8" />
        <circle cx="15.2" cy="9.6" r="0.8" />
      </g>
    </>
  );
}

function Snaps() {
  return (
    <>
      <path d="M8 4h8l-1.6 7.2c-.3 1.3-4.5 1.3-4.8 0Z" fill="#D7E8F5" />
      <path d="M9 7.8h6l-.6 3.4c-.3 1.3-4.5 1.3-4.8 0Z" fill="#BBDDF2" />
      <ellipse cx="11" cy="5" rx="2.2" ry="0.8" fill="#fff" fillOpacity="0.5" />
      <rect x="11.2" y="11.6" width="1.6" height="6" rx="0.8" fill="#AFC4D6" />
      <rect x="7.5" y="17.4" width="9" height="1.8" rx="0.9" fill="#AFC4D6" />
    </>
  );
}

function Kottbullar() {
  return (
    <>
      <ellipse cx="12" cy="17" rx="10.5" ry="4" fill="#E9E9E9" />
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
    </>
  );
}

function Skagen() {
  return (
    <>
      <rect x="3" y="11" width="18" height="8" rx="2.5" fill="#E6A94F" />
      <path d="M3 16.5c0 1.4 1.1 2.5 2.5 2.5h13c1.4 0 2.5-1.1 2.5-2.5v-1c0 1.4-1.1 2-2.5 2h-13c-1.4 0-2.5-.6-2.5-2Z" fill="#C98A35" />
      <path d="M4.5 11.5C8 6 16 6 19.5 11.5 16 14 8 14 4.5 11.5Z" fill="#F5A8A0" />
      <path d="M5.5 10.2C9 6.5 15 6.5 18.5 10.2 15 8.4 9 8.4 5.5 10.2Z" fill="#F9BEB7" />
      <circle cx="9" cy="9.8" r="0.85" fill="#F07A2E" />
      <circle cx="12" cy="9" r="0.85" fill="#F07A2E" />
      <circle cx="15" cy="9.8" r="0.85" fill="#F07A2E" />
      <path d="M12 8.6v-2.4M12 8.6l-1.4-1.6M12 8.6l1.4-1.6" stroke="#4E9A4E" strokeWidth="1" strokeLinecap="round" fill="none" />
    </>
  );
}

function Prinsesstarta() {
  return (
    <>
      <path d="M2.5 18 A9.5 9 0 0 1 21.5 18 Z" fill="#6FC07C" />
      <path d="M3.6 14C6 9.5 18 9.5 20.4 14 16.5 12 7.5 12 3.6 14Z" fill="#88D293" />
      <ellipse cx="12" cy="18" rx="9.5" ry="1.6" fill="#E6E6E6" />
      <path d="M4 16.5c1.4 1.2 14.6 1.2 16 0-1 1.6-15 1.6-16 0Z" fill="#FFF6E6" />
      <circle cx="12" cy="8" r="2.6" fill="#E879A8" />
      <circle cx="12" cy="8" r="1.1" fill="#D45C92" />
      <path d="M10 10c1.3 1 2.7 1 4 0" stroke="#4A9050" strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  );
}

function Glogg() {
  return (
    <>
      <path d="M6 8.5h9.5v4.5c0 3-2 5-4.75 5S6 16 6 13Z" fill="#fff" />
      <path d="M7.2 9.5h7.1V13c0 2.4-1.5 4-3.55 4S7.2 15.4 7.2 13Z" fill="#A4192C" />
      <path d="M7.2 9.5h7.1v1.4c-1.5.7-5.6.7-7.1 0Z" fill="#C13344" />
      <path d="M15.5 9.8c2.8.3 2.8 4.7 0 5" fill="none" stroke="#cfd6df" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9.3 6.8c1-1.4 0-2.4 0-3.6" stroke="#D7DEE6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M12.4 6.8c1-1.4 0-2.4 0-3.6" stroke="#D7DEE6" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="9.5" cy="10.8" r="0.8" fill="#E8C9A0" />
      <circle cx="12.4" cy="11.4" r="0.8" fill="#E8C9A0" />
    </>
  );
}

function Lojrom() {
  return (
    <>
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
    </>
  );
}

function EnergyCan() {
  return (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.6" fill="#2E6BE6" />
      <rect x="7" y="3" width="3.2" height="18" rx="1.6" fill="#5A8CEF" />
      <ellipse cx="12" cy="3.4" rx="4.8" ry="1.3" fill="#AFC7F3" />
      <rect x="7" y="9" width="10" height="6" fill="#13347d" fillOpacity="0.3" />
      <path d="M13 5.6 9 12.8h2.5L10.4 18.4 15.4 10.6h-2.7Z" fill="#FFD23F" />
    </>
  );
}

function Macaron() {
  return (
    <>
      <path d="M3.5 10.2C3.5 7.6 7.3 6 12 6s8.5 1.6 8.5 4.2-3.8 3-8.5 3-8.5-.4-8.5-3Z" fill="#F2A8C4" />
      <path d="M3.6 9.2C5 7.4 8.3 6.6 12 6.6s7 .8 8.4 2.6C18.7 7.8 15.5 7.2 12 7.2s-6.7.6-8.4 2Z" fill="#F8C3D8" />
      <rect x="3.5" y="10" width="17" height="3.4" rx="1.5" fill="#FBE3C4" />
      <path d="M3.5 13.6c0 2.6 3.8 4.2 8.5 4.2s8.5-1.6 8.5-4.2c0 2.6-3.8 3.4-8.5 3.4s-8.5-.8-8.5-3.4Z" fill="#F2A8C4" />
      <path d="M3.5 13.4c.6 1.3 2.4 1.6 4.2 1.7-1.8.3-3.6-.1-4.2-1.7Zm12.8 1.7c1.8-.1 3.6-.4 4.2-1.7-.6 1.6-2.4 2-4.2 1.7Z" fill="#E58FB1" />
    </>
  );
}

function Paella() {
  return (
    <>
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
    </>
  );
}

function Poke() {
  return (
    <>
      <path d="M3.5 11.5h17C20.5 17 16.5 21 12 21S3.5 17 3.5 11.5Z" fill="#fff" />
      <path d="M3.5 11.5h17c0 1-.1 2-.4 2.9C18 15 6 15 3.9 14.4 3.6 13.5 3.5 12.5 3.5 11.5Z" fill="#E4E9EE" />
      <ellipse cx="12" cy="11.5" rx="8.3" ry="2.5" fill="#F4ECD8" />
      <rect x="6.2" y="9" width="3.2" height="3.2" rx="0.6" fill="#F2918A" transform="rotate(10 8 11)" />
      <rect x="13" y="9.3" width="3.2" height="3.2" rx="0.6" fill="#F2918A" transform="rotate(-8 14.5 11)" />
      <path d="M9.4 9.2c1.6-1 3.2-1 4.8 0-1.6 1.1-3.2 1.1-4.8 0Z" fill="#8FBF5B" />
      <circle cx="16.7" cy="11" r="0.85" fill="#5BA34F" />
      <circle cx="7.3" cy="11.4" r="0.75" fill="#5BA34F" />
    </>
  );
}

function Tartare() {
  return (
    <>
      <ellipse cx="12" cy="16.5" rx="9.5" ry="3" fill="#E9E9E9" />
      <path d="M2.5 16.5c0 1.7 4.3 3 9.5 3s9.5-1.3 9.5-3c0 .4 0 2.6-9.5 2.6S2.5 16.9 2.5 16.5Z" fill="#CBCBCB" />
      <path d="M4.5 15.4C8 8.4 16 8.4 19.5 15.4 16 17.4 8 17.4 4.5 15.4Z" fill="#CE4A41" />
      <path d="M5.6 13.8C9 9.4 15 9.4 18.4 13.8 15 12.2 9 12.2 5.6 13.8Z" fill="#D96259" />
      <circle cx="12" cy="12.6" r="2.6" fill="#F6B61E" />
      <ellipse cx="11.2" cy="11.8" rx="1" ry="0.6" fill="#FAD06A" />
      <circle cx="8" cy="14.6" r="0.7" fill="#4E9A4E" />
      <circle cx="16" cy="14.6" r="0.7" fill="#7a4a8a" />
    </>
  );
}

function FishAndChips() {
  return (
    <>
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
    </>
  );
}

function Charcuterie() {
  return (
    <>
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
    </>
  );
}

function Nachos() {
  return (
    <>
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
    </>
  );
}

function Tiramisu() {
  return (
    <>
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
    </>
  );
}

function Spritz() {
  return (
    <>
      <path d="M5.5 5h13l-2.3 8.2c-.4 1.4-8 1.4-8.4 0Z" fill="#F2902B" />
      <path d="M6.4 6.2h11.2l-.5 1.8c-1.6.8-8.6.8-10.2 0Z" fill="#F8AE50" />
      <rect x="11.2" y="13.4" width="1.6" height="5.6" rx="0.8" fill="#C9CDD2" />
      <rect x="8" y="18.8" width="8" height="1.8" rx="0.9" fill="#C9CDD2" />
      <circle cx="16.4" cy="5.6" r="2.5" fill="#F7B733" />
      <circle cx="16.4" cy="5.6" r="2.5" fill="none" stroke="#E0922B" strokeWidth="0.5" />
      <path d="M16.4 3.1v5M13.9 5.6h5" stroke="#E0922B" strokeWidth="0.5" />
      <rect x="8.6" y="2.4" width="1.3" height="11" rx="0.6" fill="#D6483B" transform="rotate(10 9 8)" />
    </>
  );
}

function GinTonic() {
  return (
    <>
      <rect x="6.5" y="4.5" width="11" height="15.5" rx="2" fill="#DCEDF8" />
      <rect x="6.5" y="4.5" width="3.4" height="15.5" rx="1.8" fill="#EAF5FC" />
      <path d="M8.5 5.5a3.5 3 0 0 1 7 0Z" fill="#7DBE3C" />
      <path d="M8.5 5.5a3.5 3 0 0 1 7 0c-1.2-1-5.8-1-7 0Z" fill="#97D156" />
      <rect x="12.6" y="2.6" width="1.3" height="16.5" rx="0.6" fill="#3a55c0" transform="rotate(7 13 10)" />
      <circle cx="9.5" cy="12" r="0.7" fill="#fff" />
      <circle cx="13" cy="14.5" r="0.6" fill="#fff" />
      <circle cx="11" cy="9.5" r="0.6" fill="#fff" />
      <circle cx="12.5" cy="16.8" r="0.6" fill="#fff" />
    </>
  );
}

function Burrata() {
  return (
    <>
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
    </>
  );
}

function Churros() {
  return (
    <>
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
    </>
  );
}

function Bao() {
  return (
    <>
      <path d="M3 13c0-4 4-6 9-6s9 2 9 6-4 5-9 5-9-1-9-5Z" fill="#EFE5D1" />
      <path d="M4 12c1.6-3 4.4-4.4 8-4.4S18.4 9 20 12c-1.6 1-4 1.4-8 1.4S5.6 13 4 12Z" fill="#FBF5E9" />
      <path d="M6 12.4c2 .7 4 1 6 1s4-.3 6-1c-.3 1.1-1 1.8-2.2 2H8.2C7 14.2 6.3 13.5 6 12.4Z" fill="#A35E36" />
      <circle cx="9" cy="13" r="0.5" fill="#5BA34F" />
      <circle cx="15" cy="13" r="0.5" fill="#E07A50" />
    </>
  );
}

function SpringRoll() {
  return (
    <>
      <g transform="rotate(33 12 12)">
        <rect x="9" y="2.5" width="6" height="16" rx="3" fill="#DFA24C" />
        <rect x="9.6" y="3" width="1.7" height="15" rx="0.85" fill="#ECBE72" />
        <ellipse cx="12" cy="2.7" rx="3" ry="1.1" fill="#F2E8D0" />
        <circle cx="11" cy="2.7" r="0.5" fill="#5BA34F" />
        <circle cx="13" cy="2.9" r="0.5" fill="#E0A0A0" />
      </g>
      <path d="M15.5 16H21.5V17.5Q21.5 20 18.5 20 15.5 20 15.5 17.5Z" fill="#7A4A2A" />
    </>
  );
}

function Edamame() {
  return (
    <>
      <path d="M3.5 14c0-2.8 2.2-4.5 5-4.5h7c2.8 0 5 1.7 5 4.5S18.3 17 15.5 17h-7C5.7 17 3.5 16.8 3.5 14Z" fill="#83C247" />
      <path d="M3.5 14c0-1 .3-1.8.8-2.5 1.2.9 3.5 1.3 7.7 1.3s6.5-.4 7.7-1.3c.5.7.8 1.5.8 2.5 0 2.8-2.2 3-5 3h-7C5.7 17 3.5 16.8 3.5 14Z" fill="#6FB13A" />
      <circle cx="8" cy="13.4" r="1.6" fill="#9AD15E" />
      <circle cx="12" cy="13.6" r="1.6" fill="#9AD15E" />
      <circle cx="16" cy="13.4" r="1.6" fill="#9AD15E" />
      <path d="M19.5 12 21 10.5" stroke="#6FB13A" strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

function PadThai() {
  return (
    <>
      <ellipse cx="12" cy="14" rx="9.5" ry="4.3" fill="#F0F0F0" />
      <path d="M2.5 14c0 2 4.3 3.4 9.5 3.4s9.5-1.4 9.5-3.4c0 .3 0 2.5-9.5 2.5S2.5 14.3 2.5 14Z" fill="#DCDCDC" />
      <path d="M5 13c3-3.2 11-3.2 14 0-1.2 2-3.2 2.4-5.2 1.3-2 1.9-5 1.4-6-.6-1.2 1-2.4.9-2.8-.7Z" fill="#E0B36A" />
      <path d="M6 12.6q3-1.4 12 0M6.6 13.7q3-1.1 11 0" stroke="#CF9A4A" strokeWidth="0.5" fill="none" />
      <path d="M13 11q1.4-1.5 2.8 0" stroke="#E0532B" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="12.6" r="0.7" fill="#5BA34F" />
      <path d="M16.5 15.2 18 14" stroke="#7DBE3C" strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

function Samosa() {
  return (
    <>
      <path d="M12 4.5 20.5 17c-2.5 1.6-14.5 1.6-17 0Z" fill="#E0A14C" />
      <path d="M12 4.5C9 8.5 7.4 12.5 6.4 16.2" stroke="#EBC078" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M12 4.5 12 16.6" stroke="#C98233" strokeWidth="0.6" />
      <path d="M5 16.4c4 1.1 10 1.1 14 0" stroke="#C98233" strokeWidth="0.7" fill="none" />
      <circle cx="18.5" cy="19" r="1.4" fill="#5BA34F" />
    </>
  );
}

function Curry() {
  return (
    <>
      <path d="M3.5 12h17C20.5 17 16.5 20.5 12 20.5S3.5 17 3.5 12Z" fill="#fff" />
      <path d="M3.5 12h17c0 1-.1 1.8-.4 2.6C18 15.2 6 15.2 3.9 14.6 3.6 13.8 3.5 13 3.5 12Z" fill="#E4E4E4" />
      <ellipse cx="12" cy="12" rx="8.3" ry="2.4" fill="#D8732A" />
      <path d="M9 11.4q3 1.3 6 0" stroke="#F2D9C0" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="14.5" cy="11" r="0.8" fill="#E89A3C" />
      <circle cx="9.5" cy="11.7" r="0.6" fill="#5BA34F" />
      <path d="M15.5 8.2c3-1.1 5.2 0 4.6 2.1-2.2.6-4.2.2-4.6-2.1Z" fill="#E8C271" />
    </>
  );
}

function Empanada() {
  return (
    <>
      <path d="M3.8 15.5a8.2 7 0 0 1 16.4 0Z" fill="#E2A24E" />
      <path d="M4.6 13.4C7 9 17 9 19.4 13.4 17 11.7 7 11.7 4.6 13.4Z" fill="#EFBE74" />
      <path d="M5 15.4q1-1 2 0t2 0 2 0 2 0 2 0 2 0" stroke="#C98233" strokeWidth="0.6" fill="none" />
    </>
  );
}

function Tagine() {
  return (
    <>
      <ellipse cx="12" cy="18.6" rx="9" ry="2" fill="#E0E0E0" />
      <path d="M4.5 16.5h15v1c0 1-3 1.7-7.5 1.7s-7.5-.7-7.5-1.7Z" fill="#CE6B45" />
      <path d="M5 17.4c1.4.8 4 1.1 7 1.1s5.6-.3 7-1.1c0 1-3 1.6-7 1.6s-7-.6-7-1.6Z" fill="#B85A3A" />
      <path d="M6 16.6 12 4.2l6 12.4Z" fill="#C25E3C" />
      <path d="M6.7 15.5C8.1 9.2 12 5.4 12 5.4s3.9 3.8 5.3 10.1c-2 .8-9.6.8-10.6 0Z" fill="#D6764F" />
      <circle cx="12" cy="3.7" r="1" fill="#A84E30" />
    </>
  );
}

function Hummus() {
  return (
    <>
      <ellipse cx="11" cy="14" rx="8.5" ry="3.2" fill="#fff" />
      <path d="M2.5 14c0 1.8 3.8 3.2 8.5 3.2s8.5-1.4 8.5-3.2c0 .3 0 2.4-8.5 2.4S2.5 14.3 2.5 14Z" fill="#E4E4E4" />
      <ellipse cx="11" cy="13.4" rx="6.8" ry="2.4" fill="#E8DCB0" />
      <ellipse cx="11" cy="13.2" rx="2.2" ry="0.9" fill="#C99A3A" />
      <circle cx="8.5" cy="12.9" r="0.5" fill="#C0504A" />
      <circle cx="13.5" cy="13" r="0.6" fill="#D7C58A" />
      <path d="M17.5 9.2c3 0 4 2 2.4 3.6C17.7 13.2 16.4 11 17.5 9.2Z" fill="#E8C271" />
    </>
  );
}

function Shakshuka() {
  return (
    <>
      <rect x="18" y="11.8" width="5.8" height="2.4" rx="1.2" fill="#3A3340" />
      <circle cx="11" cy="13" r="7.6" fill="#3A3340" />
      <circle cx="11" cy="13" r="6.3" fill="#D23B2A" />
      <ellipse cx="9" cy="12" rx="2.3" ry="1.9" fill="#FBF6EC" />
      <circle cx="9" cy="12" r="0.95" fill="#F6B61E" />
      <ellipse cx="13.4" cy="14.2" rx="2.3" ry="1.9" fill="#FBF6EC" />
      <circle cx="13.4" cy="14.2" r="0.95" fill="#F6B61E" />
      <circle cx="12.5" cy="9.4" r="0.5" fill="#5BA34F" />
    </>
  );
}

function Baklava() {
  return (
    <>
      <path d="M12 5 20 13 12 21 4 13Z" fill="#E0A84E" />
      <path d="M7 10 17 10M6 13 18 13M7 16 17 16" stroke="#C98233" strokeWidth="0.5" />
      <path d="M12 5 4 13" stroke="#EFC179" strokeWidth="0.8" />
      <g fill="#6FAE3A">
        <circle cx="12" cy="13" r="0.95" />
        <circle cx="10" cy="11.8" r="0.55" />
        <circle cx="14" cy="14.2" r="0.55" />
      </g>
    </>
  );
}

function Risotto() {
  return (
    <>
      <ellipse cx="12" cy="14.5" rx="10" ry="4" fill="#F0F0F0" />
      <path d="M2 14.5c0 2.2 4.5 3.6 10 3.6s10-1.4 10-3.6c0 .4 0 2.5-10 2.5S2 14.9 2 14.5Z" fill="#DCDCDC" />
      <ellipse cx="12" cy="13.2" rx="7" ry="2.9" fill="#EFDDA0" />
      <ellipse cx="12" cy="12.6" rx="5.6" ry="2" fill="#F4E7BA" />
      <g fill="#D8C277">
        <circle cx="8.6" cy="13.2" r="0.55" />
        <circle cx="10.4" cy="13.9" r="0.55" />
        <circle cx="12" cy="13.4" r="0.55" />
        <circle cx="13.7" cy="13.8" r="0.55" />
        <circle cx="15.2" cy="13" r="0.55" />
        <circle cx="11" cy="12.4" r="0.5" />
        <circle cx="13.4" cy="12.5" r="0.5" />
      </g>
      <path d="M10.4 11.6 13.8 10.6l-1.4 2.4Z" fill="#F2C94C" />
      <circle cx="9.4" cy="12.2" r="0.5" fill="#5BA34F" />
    </>
  );
}

function Cannoli() {
  return (
    <g transform="rotate(35 12 12)">
      <rect x="9" y="4" width="6" height="14" rx="1.5" fill="#D9974A" />
      <line x1="10.6" y1="4" x2="10.6" y2="18" stroke="#C98233" strokeWidth="0.4" />
      <line x1="13.4" y1="4" x2="13.4" y2="18" stroke="#C98233" strokeWidth="0.4" />
      <ellipse cx="12" cy="4" rx="3" ry="1.3" fill="#FBF4E6" />
      <ellipse cx="12" cy="18" rx="3" ry="1.3" fill="#FBF4E6" />
      <circle cx="11" cy="4" r="0.6" fill="#6FAE3A" />
      <circle cx="13" cy="18" r="0.6" fill="#5A3A22" />
    </g>
  );
}

function WaterBottle() {
  return (
    <>
      {/* cap */}
      <rect x="9.6" y="2.6" width="4.8" height="2.4" rx="0.6" fill="#3F8EE8" />
      <rect x="9.6" y="2.6" width="4.8" height="0.6" rx="0.3" fill="#5DA2EE" />
      {/* neck */}
      <rect x="10.2" y="5" width="3.6" height="2.2" fill="#E8F4FF" />
      {/* body outline */}
      <path d="M7 9 q 0 -1.8 1.5 -2 q 0.5 -0.5 0.5 -1 h 6 q 0 0.5 0.5 1 q 1.5 0.2 1.5 2 v 11.5 a 1.4 1.4 0 0 1 -1.4 1.4 h -7.2 a 1.4 1.4 0 0 1 -1.4 -1.4 z" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.45" />
      {/* water fill */}
      <path d="M7 11.5 v 9 a 1.4 1.4 0 0 0 1.4 1.4 h 7.2 a 1.4 1.4 0 0 0 1.4 -1.4 v -9 z" fill="#7FB8F0" />
      {/* highlight */}
      <rect x="8.4" y="9.5" width="0.8" height="11" rx="0.4" fill="#FFFFFF" opacity="0.55" />
      {/* label band */}
      <rect x="7" y="14" width="10" height="3" fill="#FFFFFF" opacity="0.7" />
    </>
  );
}

function WaterGlass() {
  return (
    <>
      {/* glass body — tumbler shape */}
      <path d="M6.4 4.6 h 11.2 l -1 16.4 a 1.1 1.1 0 0 1 -1.1 1 h -7 a 1.1 1.1 0 0 1 -1.1 -1 z" fill="#F1F8FF" stroke="#B7D6F2" strokeWidth="0.5" />
      {/* water */}
      <path d="M7.4 8.5 h 9.2 l -0.85 12.5 a 1.1 1.1 0 0 1 -1.1 1 h -5.3 a 1.1 1.1 0 0 1 -1.1 -1 z" fill="#7FB8F0" />
      {/* rim highlight */}
      <ellipse cx="12" cy="5" rx="5.4" ry="0.7" fill="#FFFFFF" opacity="0.7" />
      {/* side highlight */}
      <rect x="8.2" y="6.4" width="0.9" height="13" rx="0.45" fill="#FFFFFF" opacity="0.55" />
      {/* ice cube */}
      <rect x="11" y="9.6" width="3.2" height="3" rx="0.5" transform="rotate(-8 12.6 11)" fill="#FFFFFF" opacity="0.6" />
    </>
  );
}

function WaterCarafe() {
  return (
    <>
      {/* spout neck */}
      <path d="M9.5 2.8 h 5 v 1 a 0.6 0.6 0 0 1 -0.6 0.6 h -3.8 a 0.6 0.6 0 0 1 -0.6 -0.6 z" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.4" />
      <rect x="10.2" y="4.4" width="3.6" height="3.2" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.4" />
      {/* bulbous body */}
      <path d="M10.2 7.6 q -4.2 1.6 -4.2 7 v 6 a 1.5 1.5 0 0 0 1.5 1.5 h 9 a 1.5 1.5 0 0 0 1.5 -1.5 v -6 q 0 -5.4 -4.2 -7 z" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.45" />
      {/* water */}
      <path d="M6 12 v 8.6 a 1.5 1.5 0 0 0 1.5 1.5 h 9 a 1.5 1.5 0 0 0 1.5 -1.5 v -8.6 z" fill="#7FB8F0" />
      {/* highlight */}
      <rect x="7.5" y="10" width="0.9" height="11" rx="0.45" fill="#FFFFFF" opacity="0.55" />
      {/* surface ripple */}
      <ellipse cx="12" cy="12" rx="5.4" ry="0.55" fill="#FFFFFF" opacity="0.45" />
    </>
  );
}

function WineCarafe() {
  return (
    <>
      {/* opening */}
      <path d="M10 2.6 h 4 v 1.1 a 0.5 0.5 0 0 1 -0.5 0.5 h -3 a 0.5 0.5 0 0 1 -0.5 -0.5 z" fill="#7A2330" />
      {/* neck */}
      <rect x="10.5" y="4.2" width="3" height="3.6" fill="#7A2330" />
      {/* decanter body — wide bulb */}
      <path d="M10.5 7.6 q -5 2.5 -5 8 a 5.5 5.5 0 0 0 5.5 5.5 h 2 a 5.5 5.5 0 0 0 5.5 -5.5 q 0 -5.5 -5 -8 z" fill="#5B141E" />
      {/* highlight on glass */}
      <ellipse cx="9.2" cy="15" rx="0.9" ry="3.4" fill="#A52C36" opacity="0.7" />
      {/* glass rim */}
      <path d="M10 2.6 h 4" stroke="#36080F" strokeWidth="0.4" />
      {/* surface */}
      <ellipse cx="12" cy="9.6" rx="2.6" ry="0.5" fill="#7A2330" />
    </>
  );
}

function BeerPitcher() {
  return (
    <>
      {/* handle */}
      <path d="M17.2 9 q 3.6 1.1 3.6 4.5 q 0 3.4 -3.6 4.5" fill="none" stroke="#D49934" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.2 10.4 q 2.4 0.9 2.4 3.1 q 0 2.2 -2.4 3.1" fill="none" stroke="#F5C868" strokeWidth="0.6" strokeLinecap="round" />
      {/* body */}
      <path d="M5.5 7.5 v 13 a 1.5 1.5 0 0 0 1.5 1.5 h 9 a 1.5 1.5 0 0 0 1.5 -1.5 v -13 z" fill="#F0B948" stroke="#C68A24" strokeWidth="0.4" />
      {/* glass highlight */}
      <rect x="7" y="9" width="0.9" height="11" rx="0.45" fill="#FFFFFF" opacity="0.5" />
      {/* spout lip */}
      <path d="M5.5 7.5 q -0.8 -0.6 -0.2 -1.6 q 1 0.4 1.2 1.6" fill="#F0B948" stroke="#C68A24" strokeWidth="0.35" />
      {/* foam */}
      <path d="M5.5 7.5 q 0.6 -1.5 2 -1.5 q 0.8 -1 2 -0.3 q 0.6 -1 2 -0.3 q 0.6 -1 2 -0.3 q 0.7 -1 2 0 q 1 -0.3 2 1 q 0 1.4 0 1.4 z" fill="#FCFCF7" stroke="#E2DDC9" strokeWidth="0.35" />
      <circle cx="7.4" cy="6.2" r="0.6" fill="#FFFFFF" />
      <circle cx="10.2" cy="5.6" r="0.6" fill="#FFFFFF" />
      <circle cx="13.6" cy="5.6" r="0.6" fill="#FFFFFF" />
      <circle cx="16" cy="6.2" r="0.6" fill="#FFFFFF" />
    </>
  );
}

function Sangria() {
  return (
    <>
      {/* neck/spout */}
      <path d="M10.2 2.6 h 3.6 v 1.6 q 0 0.8 -0.8 1 q 0 0.8 0.4 1.4 l -3 -0.2 q 0.4 -0.6 0.4 -1.2 q -0.6 -0.2 -0.6 -1 z" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.35" />
      {/* body */}
      <path d="M9 7 q -4 2 -4 7 v 6 a 1.5 1.5 0 0 0 1.5 1.5 h 11 a 1.5 1.5 0 0 0 1.5 -1.5 v -6 q 0 -5 -4 -7 z" fill="#E8F4FF" stroke="#B7D6F2" strokeWidth="0.45" />
      {/* sangria liquid */}
      <path d="M5 14.5 v 6 a 1.5 1.5 0 0 0 1.5 1.5 h 11 a 1.5 1.5 0 0 0 1.5 -1.5 v -6 z" fill="#A8334F" />
      {/* surface */}
      <ellipse cx="12" cy="14.5" rx="6.5" ry="0.6" fill="#7E1E36" />
      {/* glass highlight */}
      <rect x="6.4" y="12.5" width="0.9" height="8.5" rx="0.45" fill="#FFFFFF" opacity="0.45" />
      {/* orange slice (floating) */}
      <circle cx="9" cy="16.5" r="1.2" fill="#FF9740" />
      <circle cx="9" cy="16.5" r="0.85" fill="#FFC479" />
      <path d="M9 15.65 v 1.7 M 8.15 16.5 h 1.7" stroke="#FF9740" strokeWidth="0.25" />
      {/* lemon slice */}
      <circle cx="13.4" cy="18.2" r="1.1" fill="#FFE25C" />
      <circle cx="13.4" cy="18.2" r="0.8" fill="#FFEEA0" />
      <path d="M13.4 17.4 v 1.6 M 12.6 18.2 h 1.6" stroke="#E5C12F" strokeWidth="0.22" />
      {/* berry */}
      <circle cx="15.5" cy="16.5" r="0.6" fill="#5C0E27" />
    </>
  );
}

function Lasagne() {
  return (
    <>
      {/* plate */}
      <ellipse cx="12" cy="19.6" rx="10.5" ry="2.2" fill="#EFEEE8" />
      <path d="M1.5 19.6c0 1.6 4.7 3 10.5 3s10.5-1.4 10.5-3c0 .4 0 2.2-10.5 2.2S1.5 20 1.5 19.6Z" fill="#D7D5CC" />
      {/* body — alternating pasta + filling layers, top to bottom */}
      <rect x="3.5" y="8" width="17" height="11.6" rx="1.6" fill="#F1D38A" />
      <rect x="3.5" y="8" width="17" height="2.8" rx="1.6" fill="#F2C24A" />
      <rect x="3.5" y="10.8" width="17" height="2.2" fill="#C24D3A" />
      <rect x="3.5" y="13" width="17" height="1.3" fill="#F4D78F" />
      <rect x="3.5" y="14.3" width="17" height="1.6" fill="#FCEFCD" />
      <rect x="3.5" y="15.9" width="17" height="2.2" fill="#C24D3A" />
      <rect x="3.5" y="18.1" width="17" height="1.5" rx="1.6" fill="#F4D78F" />
      {/* browned cheese bits on top */}
      <g fill="#B97E1F">
        <circle cx="6.5" cy="9.2" r="0.4" />
        <circle cx="10.5" cy="8.8" r="0.4" />
        <circle cx="14" cy="9.4" r="0.4" />
        <circle cx="17.5" cy="9.1" r="0.4" />
      </g>
      {/* basil leaf */}
      <path d="M10.6 6.8 q 0.6 -1.6 1.8 -1.8 q -0.3 1.6 -1.8 1.8 z" fill="#3F9B53" />
    </>
  );
}

function Mochi() {
  return (
    <>
      <ellipse cx="12" cy="16.5" rx="9" ry="2.4" fill="#EAEAEA" />
      <circle cx="8" cy="13.5" r="3.4" fill="#F6C0D2" />
      <circle cx="16" cy="13.5" r="3.4" fill="#CDE8B8" />
      <circle cx="12" cy="12.5" r="3.6" fill="#FBFBF6" />
      <ellipse cx="7" cy="12.4" rx="1.3" ry="0.8" fill="#FBD7E2" />
      <ellipse cx="11" cy="11.3" rx="1.3" ry="0.8" fill="#fff" />
      <ellipse cx="15" cy="12.4" rx="1.3" ry="0.8" fill="#E0F0CF" />
    </>
  );
}

/** id (matches the "ci:<id>" sentinel) → label + shape body. */
const ICONS: Record<string, { label: string; Body: () => ReactElement }> = {
  bun: { label: "Kanelbulle", Body: CinnamonBun },
  semla: { label: "Semla", Body: Semla },
  snaps: { label: "Snaps / nubbe", Body: Snaps },
  kottbullar: { label: "Köttbullar", Body: Kottbullar },
  skagen: { label: "Toast Skagen", Body: Skagen },
  prinsesstarta: { label: "Prinsesstårta", Body: Prinsesstarta },
  glogg: { label: "Glögg", Body: Glogg },
  lojrom: { label: "Löjrom", Body: Lojrom },
  energidryck: { label: "Energidryck", Body: EnergyCan },
  macaron: { label: "Macaron", Body: Macaron },
  paella: { label: "Paella", Body: Paella },
  poke: { label: "Poke bowl", Body: Poke },
  tartare: { label: "Tartare / råbiff", Body: Tartare },
  fishandchips: { label: "Fish & chips", Body: FishAndChips },
  charcuterie: { label: "Charcuterie / ostbricka", Body: Charcuterie },
  nachos: { label: "Nachos", Body: Nachos },
  tiramisu: { label: "Tiramisu", Body: Tiramisu },
  spritz: { label: "Aperol Spritz", Body: Spritz },
  gintonic: { label: "Gin & Tonic", Body: GinTonic },
  burrata: { label: "Burrata / Caprese", Body: Burrata },
  churros: { label: "Churros", Body: Churros },
  bao: { label: "Bao bun", Body: Bao },
  springroll: { label: "Vårrulle / spring roll", Body: SpringRoll },
  edamame: { label: "Edamame", Body: Edamame },
  padthai: { label: "Pad thai / wok", Body: PadThai },
  samosa: { label: "Samosa", Body: Samosa },
  curry: { label: "Curry", Body: Curry },
  empanada: { label: "Empanada", Body: Empanada },
  tagine: { label: "Tagine", Body: Tagine },
  hummus: { label: "Hummus", Body: Hummus },
  shakshuka: { label: "Shakshuka", Body: Shakshuka },
  baklava: { label: "Baklava", Body: Baklava },
  risotto: { label: "Risotto", Body: Risotto },
  cannoli: { label: "Cannoli", Body: Cannoli },
  mochi: { label: "Mochi", Body: Mochi },
  lasagne: { label: "Lasagne", Body: Lasagne },
  waterbottle: { label: "Vattenflaska", Body: WaterBottle },
  waterglass: { label: "Glas vatten", Body: WaterGlass },
  watercarafe: { label: "Karaff vatten", Body: WaterCarafe },
  winecarafe: { label: "Karaff vin", Body: WineCarafe },
  beerpitcher: { label: "Tillbringare öl", Body: BeerPitcher },
  sangria: { label: "Sangria", Body: Sangria },
};

export type IconEntry = { label: string; Icon: () => ReactElement };

function buildRegistry(apple: boolean): Record<string, IconEntry> {
  const out: Record<string, IconEntry> = {};
  for (const id of Object.keys(ICONS)) {
    const { label, Body } = ICONS[id];
    out[id] = {
      label,
      Icon: apple
        ? () => (
            <Svg label={label}>
              <GlossDefs />
              <g filter="url(#apple-gloss)">
                <Body />
              </g>
            </Svg>
          )
        : () => (
            <Svg label={label}>
              <Body />
            </Svg>
          ),
    };
  }
  return out;
}

/** Flat Android/Noto look. */
export const NOTO_ICONS = buildRegistry(false);
/** Glossy Apple look (same shapes + specular sheen). */
export const APPLE_ICONS = buildRegistry(true);
