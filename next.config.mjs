/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// Lets `next dev` talk to Cloudflare bindings/secrets via OpenNext. No-op in
// production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
