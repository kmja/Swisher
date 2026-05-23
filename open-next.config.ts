import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config: no incremental cache / queue / tag cache configured, which is
// fine for this app — it has no ISR or on-demand revalidation, just two dynamic
// API routes and a static page.
export default defineCloudflareConfig();
