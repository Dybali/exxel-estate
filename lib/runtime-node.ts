// Node.js stand-in for "cloudflare:workers", used only by the standard Next.js build for the
// Mittwald container (next.config.ts aliases the module here). Settings come from environment
// variables; Cloudflare bindings (DB, BUCKET) are simply absent. lib/runtime.ts stays the single
// place the rest of the code imports from.
export const env = process.env as unknown as Record<string, unknown>;

// No request context to extend on Node: let the work finish in the background and never let a
// failure crash the process.
export function waitUntil(promise: Promise<unknown>) {
  promise.catch((cause) => console.error("waitUntil task failed", cause));
}
