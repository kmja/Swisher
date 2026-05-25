import { execSync } from "node:child_process";

/** A build marker so a deploy is visibly identifiable: "YYYY-MM-DD·<sha>". */
function buildVersion() {
  const sha =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    (() => {
      try {
        return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
          .toString()
          .trim();
      } catch {
        return "";
      }
    })();
  const date = new Date().toISOString().slice(0, 10);
  return sha ? `${date}·${sha.slice(0, 7)}` : date;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_ID: buildVersion(),
  },
};

export default nextConfig;
