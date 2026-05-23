/** @type {import('next').NextConfig} */
const nextConfig = {
  // Receipt photos can be a few MB; allow generous request bodies for the OCR route.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;

// Lets `next dev` talk to Cloudflare bindings/secrets via OpenNext. No-op in
// production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
