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
        {/* Two manifests, one per system theme. Chromium-based PWAs
            respect media on link[rel=manifest] when picking the
            install splash + background_color; the dark variant
            paints the launch screen in the same near-black surface
            family the page itself uses, so dark-mode hosts don't
            see a white flash before the body backdrop kicks in. */}
        <link rel="manifest" href="/manifest.webmanifest" media="(prefers-color-scheme: light)" />
        <link rel="manifest" href="/manifest-dark.webmanifest" media="(prefers-color-scheme: dark)" />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
