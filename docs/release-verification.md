# Release verification

Run `npm run verify` before saving and deploying a Site version. It runs behavioral tests, the deployed Site's TypeScript project, and a production build. The legacy `apps/` workspace has a separate dependency/runtime setup and is excluded from this Site check.

The GitHub workflow `.github/workflows/verify-site.yml` runs the same check when this source is pushed to GitHub. A Sites Git push alone does not run GitHub Actions.

## Isolated HTTP/browser check

Use a local Worker with **no production secrets**. The audit fixture uses `http://127.0.0.1:8787` and `.wrangler/audit-20261028`; it never sends mail or accesses production data.

1. Build the Site, then start `wrangler dev --config dist/server/wrangler.json --local --persist-to .wrangler/audit-20261028 --port 8787` through the installed Node runtime.
2. Apply the tracked SQLite migrations in order to that same local state. Preserve `BEGIN`/`CASE` spacing and LF line endings in trigger migrations; `.gitattributes` enforces LF.
3. Run `node scripts/local-flow-check.mjs`. This creates explicitly labelled local accounts and a private test certificate. It checks registration, session handling, document privacy, the review queue, one-time approval, public listings, search, favorites, messages, appointments, stale changes, and logout.
4. Open the local Site in a browser. Check a villa draft, reload persistence, preview and a narrow viewport. External image-upload service behavior is covered by mocked integration boundaries; the HTTP fixture represents an already uploaded listing image and uses actual local R2 for documents.
5. Stop the local Worker before rebuilding on Windows; open Worker processes may hold `dist/` files.

## Runtime configuration and deployment

E-mail verification and password-reset codes use our own system over the configured e-mail transport (docs/auth.md); Neon Auth is no longer used. The optional server-only `EMAIL_CODE_SECRET` (32+ random characters; otherwise a key derived from `DATABASE_URL`) must never be placed in source, client code, or hosting.json. A successful send response does not prove mailbox delivery; check with the admin test e-mail and a real code.

Server errors in `/api/` return JSON with a request reference and private caching. Logs contain method, route template, status and reference, without query strings, uploaded documents, passwords or message contents. Existing operation counters remain enabled.

After deployment, verify the literal live URL and read-only API checks. Keep the preceding saved version available for rollback with Sites version/deployment tools. No recurring monitor is created by this source change.
