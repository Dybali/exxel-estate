# Listing workflow and account controls

Implemented for the Sites Worker and the prepared NestJS / Next.js deployment.

## Private, portable draft

`GET /api/listing-draft` returns `{draft:null}` or
`{draft:{payload:{fields,images,amenities},version,updatedAt}}` for the signed-in
account only. One working draft is retained per account in Neon. It is not a
published listing and does not use the listing quota or appear in search.

`POST /api/listing-draft` accepts `{action:"save",version,payload}` or
`{action:"delete",version}`. The first save uses version 0. Insert-on-conflict
and conditional update/delete enforce atomic version checks. A stale tab gets
409 and cannot overwrite newer work. The form stops saving after a failed
request and offers an explicit retry. Unsaved work triggers a navigation warning.
Drafts load on `/ilan-ver` and are linked from the account overview and listings.

Partial text is allowed. Field names, lengths, photo count, supported currency,
and owner-scoped image keys are checked on save. Publishing still performs full
location, required-field, role, quota and R2 existence checks through
`POST /api/listings`. Draft save does not assert that each referenced R2 object
exists. Public listings continue to require approval for individual owners;
approved agents can publish directly.

Autosave waits one second after editing. The page remains usable while saving;
publishing waits for the current save to finish. A native modal provides a
private preview. Photo order is persisted; index zero is the cover. Drag/drop,
arrow buttons and a star cover button work in both creation and editing. New
uploads check JPEG/PNG/WebP and the 8 MB limit before the existing backend checks.
Clearing a draft does not delete R2 objects, including objects that may already
be referenced elsewhere. Unreferenced-media retention/cleanup is not automated.

## Consistent prices

Supported search currencies: TRY, EUR, USD, GBP. With no currency and no price
criteria, all currencies remain visible. Price bounds or price sorting without
a currency explicitly default to TRY, including older query links and saved
searches. No exchange-rate conversion is performed. Saved filters, map results,
and alerts use the same currency semantics. Unsupported currencies return 400.

Price/area sorting merges the real and demo sorted streams before pagination.
Only a bounded real-record window is fetched (one page plus at most the number
of demo records), so sorting does not fetch all customer listings. Price per
square metre retains up to two decimals; rent comparisons include a monthly unit.
Search errors show a retry action. First-page loading uses responsive skeletons
with reduced-motion support.

## Session controls

`GET /api/account-security` returns an active-session count, without exposing
session tokens or hashes. `POST` accepts `logout_others` or `logout_all`.
Every operation scopes deletion to the authenticated account. Other-session
revocation retains the verified current session. All-session revocation also
clears the current cookie. Nest checks session validity for JWT access as well,
so a deleted session cannot continue through an otherwise valid access JWT.
The profile panel exposes these controls. Device names, IP history and session
creation times are not collected by this feature.

## Administrator audit

Listing moderation, agent approval and country-setting changes write an audit
record in the same database transaction as their mutation. Records include
actor UUID/name, target, action, resulting status or settings summary, and time.
Rejected or unauthorized requests do not create success records. Country legal
text and credentials are not copied into the audit summary. No retrospective
records are invented. Administrators can load the latest 100 records through
`GET /api/admin?audit=1`. The interface has no edit/delete action for audit rows.
This is an application audit trail, not tamper-proof external log storage.

## Persistence and migration

- PostgreSQL: `008_listing_drafts.sql`, `009_admin_audit.sql`.
- Prisma: `20261019010000_listing_drafts`, `20261019020000_admin_audit`.
- D1 compatibility: Drizzle 0015 (also includes seller_profiles), 0016.
- The existing administrator export includes drafts and audit rows. This export
  is not an automated backup; R2 objects require a separate copy/restore workflow.
- Newly added user-facing controls have TR/DE/FR/EN/AR/RU translations. The
  administrator audit interface follows the existing Turkish admin UI.

## Verification

`apps/api/test/listing-tools.test.mjs` checks private draft round trips, tenant
isolation, concurrent-save conflicts, stale delete, forged fields/photos,
currency filters, map currency, sorted pagination and saved-search currency.
`apps/api/test/security.test.mjs` checks authorization, moderation audit,
rejected-action logging, other-session revocation and all-session revocation.
Both suites use disposable users/listings and clean them up in `finally`.
Local Wrangler can return a known `503 worker restarted` response after an
authorization rejection. Test helpers allow one bounded retry for that specific
local restart; account creation is never retried automatically.

These checks do not establish 1,000 concurrent-user capacity, a penetration-test
result, live Google OAuth availability or automatic backup restoration.

### Latest run — 19 October 2026

- NestJS full API run: 23/23 passed (45.7 seconds), including existing public,
  profile, discovery, and the new workflow/security suites.
- Local production Worker with configured Neon: 15/15 passed for the new
  workflow/security suites (14.9 seconds).
- Vinext production build, Next.js production build/TypeScript and NestJS/Prisma
  build passed. Generated Next.js frontend matches the root source.
- CUA browser checks: currency selection, persistent draft load, changing the
  cover and retaining it after reload, native modal preview at mobile and
  1440px desktop widths, and profile session count. The desktop profile measured
  1425px document width inside a 1440px viewport (no horizontal overflow).
- Two actual R2 WebP objects were uploaded for a private disposable draft used
  in browser QA. They are removed with the fixture after verification.
