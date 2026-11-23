// Node.js runtime for lib/runtime.ts: settings are environment variables.
export const env = process.env as unknown as Record<string, unknown>;

// No request context to extend on Node: let the work finish in the background and never let a
// failure crash the process.
export function waitUntil(promise: Promise<unknown>) {
  promise.catch((cause) => console.error("waitUntil task failed", cause));
}
