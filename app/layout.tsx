import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kvitt — dela kvittot",
  description: "Photograph a receipt, assign items, and generate a locked Swish QR for each person.",
  // No metadata.manifest — we hand-emit two <link rel="manifest">
  // tags below so the PWA splash colours track the system theme.
  // "black-translucent" lets the iOS PWA status bar overlay our
  // body colour instead of forcing a white strip at the top —
  // makes the page look right in both light and dark system modes.
  appleWebApp: { capable: true, title: "Kvitt", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Next renders this into two <meta name="theme-color"> tags with
  // media queries so the URL bar / Android system chrome tracks the
  // user's light / dark preference. Light mode keeps the swish brand
  // pink; dark mode flips to the same near-black we use for the
  // body backdrop so the chrome doesn't glare next to our content.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ee5c9a" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        {/* A single <link rel="manifest"> tag whose href is rewritten
            inline if the device is in dark mode. The media-query
            multi-manifest pattern looks correct on paper but Android
            Chromium ignores it at install / launch time — the
            installed PWA always reaches for the first manifest. Doing
            the swap in JS at the top of <head> means the link's href
            already points to the dark variant by the time the
            "Install app" UI fires off its manifest fetch. The
            matchMedia change listener also keeps the active href in
            sync if the user toggles their OS theme after the page
            has loaded. */}
        <link rel="manifest" href="/manifest.webmanifest" id="kvitt-manifest" />
        {/* Boot script. Runs before the body renders so the .dark
            class lands on <html> before the first paint (no FOUC),
            and the manifest <link> is rewritten to its dark variant
            so the Install dialog / PWA splash uses the right colour
            family. Source of truth:
              1. localStorage "kvitt-theme" → "light" / "dark" pin
                 (set by the debug panel toggle)
              2. otherwise, prefers-color-scheme
            The matchMedia change listener keeps the page in sync if
            the OS theme flips, but defers to a localStorage pin so
            the debug override sticks. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var d=document.documentElement,l=document.getElementById('kvitt-manifest'),m=window.matchMedia('(prefers-color-scheme: dark)');function apply(dark){d.classList.toggle('dark',dark);if(l)l.href=dark?'/manifest-dark.webmanifest':'/manifest.webmanifest';}function pin(){try{return localStorage.getItem('kvitt-theme');}catch(e){return null;}}var p=pin();apply(p==='dark'||(p!=='light'&&m.matches));try{m.addEventListener('change',function(e){if(pin())return;apply(e.matches);});}catch(e){m.addListener(function(e){if(pin())return;apply(e.matches);});}window.__kvittSetTheme=function(t){try{if(t==='dark'||t==='light')localStorage.setItem('kvitt-theme',t);else localStorage.removeItem('kvitt-theme');}catch(e){}apply(t==='dark'||(t!=='light'&&m.matches));};window.__kvittGetTheme=function(){return pin();};})();",
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
