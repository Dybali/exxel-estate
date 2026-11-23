// The only module that knows the hosting runtime: the Mittwald container (Node.js). Settings come from
// environment variables. The Cloudflare Workers build was removed on 2026-11-23 (owner's decision).
export { env, waitUntil } from "./runtime-node";
