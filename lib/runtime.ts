// The only module that knows the hosting runtime. Today the site runs on Cloudflare Workers;
// when it moves to Mittwald (Node.js), env becomes process.env and waitUntil a detached
// promise here, and the rest of the code stays as it is. See docs/mittwald-migration.md.
export { env, waitUntil } from "cloudflare:workers";
