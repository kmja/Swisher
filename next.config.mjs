import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** App release line ("1.0", "1.0.1", "1.2"…) sourced from package.json so we
 *  have a single place to bump and it travels with the build. Drops trailing
 *  ".0"s so "1.0.0" reads as "1.0". */
function appVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
    const parts = String(pkg.version || "0.0.0").split(".");
    while (parts.length > 2 && parts[parts.length - 1] === "0") parts.pop();
    return parts.join(".");
  } catch {
    return "";
  }
}

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
    NEXT_PUBLIC_APP_VERSION: appVersion(),
    NEXT_PUBLIC_BUILD_ID: buildVersion(),
  },
};

export default nextConfig;
