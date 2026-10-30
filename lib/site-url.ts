import { env } from "./runtime";

// Public base URL (wrangler.jsonc SITE_URL) for canonical links, sitemap and emails.
export function siteUrl() {
  return ((env as { SITE_URL?: string }).SITE_URL || "https://exxel-estate.estatemarket24.workers.dev").replace(/\/$/, "");
}
