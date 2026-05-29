import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kvitt — dela kvittot",
  description: "Photograph a receipt, assign items, and generate a locked Swish QR for each person.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kvitt", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ee5c9a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
