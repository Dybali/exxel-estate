import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

// The browser bundle gets lib/i18n-runtime.ts instead of the 2.4 MB dictionary of every language: it loads one
// language from /i18n/<locale>.json. The server environments (rsc, ssr) keep the real dictionary.
const BROWSER_DICTIONARY = fileURLToPath(new URL("./lib/i18n-runtime.ts", import.meta.url));
function browserDictionary(): Plugin {
  return {
    name: "em24-browser-dictionary",
    enforce: "pre",
    resolveId(source) {
      if (this.environment?.name !== "client") return null;
      return /(^|\/)i18n-dictionary(\.ts)?$/.test(source) ? BROWSER_DICTIONARY : null;
    },
  };
}

export default defineConfig(async () => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      browserDictionary(),
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        configPath: "./wrangler.jsonc",
      }),
    ],
  };
});
