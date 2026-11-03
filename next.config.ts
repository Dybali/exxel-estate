import type { NextConfig } from "next";

// EXXEL_NODE_BUILD=1 marks the standard Next.js build for the Mittwald container
// (docs/mittwald-migration.md). vinext reads this file too, so the Node-only settings must not
// apply to the Cloudflare build.
const nodeBuild = process.env.EXXEL_NODE_BUILD === "1";

const nextConfig: NextConfig = {
  // Type-check the site only; apps/ is an unused older workspace with its own setup.
  typescript: { tsconfigPath: "tsconfig.site.json" },
  ...(nodeBuild ? {
    // Self-contained server (.next/standalone) for the Docker image.
    output: "standalone" as const,
    // lib/runtime.ts re-exports "cloudflare:workers"; on Node that module is lib/runtime-node.ts.
    turbopack: { resolveAlias: { "cloudflare:workers": "./lib/runtime-node.ts" } },
  } : {}),
};

export default nextConfig;
