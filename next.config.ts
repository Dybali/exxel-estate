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
    // lib/postgres-driver.ts is an empty slot in the Cloudflare build; on Node it is the TCP
    // PostgreSQL driver (postgres.js), so Workers never bundle it. lib/video-worker.ts is the same kind
    // of slot for the ffmpeg video worker (docs/listing-videos.md); lib/db-backup.ts is the slot for
    // the pg_dump offsite backup (docs/backups-monitoring.md); lib/email-smtp.ts the slot for the SMTP
    // transport (nodemailer, docs/email-notifications.md).
    turbopack: { resolveAlias: {
      "cloudflare:workers": "./lib/runtime-node.ts",
      "@/lib/postgres-driver": "./lib/postgres-driver-node.ts",
      "@/lib/video-worker": "./lib/video-worker-node.ts",
      "@/lib/db-backup": "./lib/db-backup-node.ts",
      "@/lib/email-smtp": "./lib/email-smtp-node.ts",
    } },
  } : {}),
};

export default nextConfig;
