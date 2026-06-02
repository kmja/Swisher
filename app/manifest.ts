import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kvitt – dela kvittot",
    short_name: "Kvitt",
    description: "Split a restaurant receipt and generate a locked Swish QR per person.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#ee5c9a",
    icons: [
      // Wordmark SVG is the splash hero — vector, scales infinitely,
      // shows the Kvitt. logo with the swish dot. The PNGs below
      // remain for home-screen / maskable contexts that need raster
      // and / or an adaptive shape.
      { src: "/wordmark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
