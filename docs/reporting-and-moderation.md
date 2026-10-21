# Listing reporting and moderation

The live root Sites Worker implements this feature. No email is sent and no
listing is automatically removed because of report volume.

## Visitor and account flow

Listing detail → three-dot actions → **İlanı bildir**. A verified application
account is required to submit. Reasons are fraud, incorrect details, unavailable
property, duplicate listing, inappropriate content, and other. Details must be
10–2000 characters. No evidence uploads are accepted in this version.

One immutable submission per reporter/listing pair; retries, simultaneous
submissions and repeat clicks return the existing reference. A reporter can
submit at most ten new reports per one-hour counter window. Closed
reports remain in account history; administrators can reopen them. Reporters
cannot edit an existing submission or submit a second report for the same listing.

The account navigation adds **İlan bildirimlerim**, separate from existing
saved-search notifications. Reporters see their own reason, description,
reference, state and public outcome. They never receive internal notes,
reviewer identity, another reporter's details or administrative event history.

## Administrator flow

Verified administrators only. `/yonetim#admin-reports` provides state filters,
counts, 20-item pagination, reporter identity, related listing/owner information,
internal notes and action history. Actions: start review, resolve, dismiss,
reopen, or hold a published real listing. Resolution/hold/dismissal require a
reason of at least ten characters. The hold action also requires UI confirmation.

Version checks and conditional transaction statements prevent stale concurrent
reviews from overwriting another administrator. Every successful report action
adds a separate event. The hold and report resolution are in the same transaction.

Holding sets a real listing to `pending` and records an active moderation hold.
Edits to any non-published listing retain `pending` until explicit review. This target-row status guard also protects a concurrent edit waiting on a moderation update. Owner edits and price changes retain `pending` and the review metadata while
the hold remains active, including a concurrent edit that started before the
hold. Explicit publication through the verified administrator review endpoint
releases the hold in the same transaction. Editing as an administrator does not
implicitly release it. Owner deletion is still permitted. New listings are not
automatically matched against previously held listings.

The hold prevents publication of that record, not evasion through a different
account/new record. Copy detection, identity checks and appeal conversations are
separate future work. Existing CDN listing caches can retain a previously public
record briefly; this is not an immediate global cache purge. Direct detail/media
access follows the current listing state. No production listing was held for tests.

## API, schema and backup

- `GET /api/reports[?listingId=...&page=...]`: own reports only.
- `POST /api/reports`: verified reporter, validated listing and bounded input;
  own-listing and unpublished/missing-listing reports are rejected.
- `GET /api/admin/reports?state=...&page=...`: private admin queue and totals.
- `GET /api/admin/reports?id=...`: private admin event history.
- `POST /api/admin/reports`: private, versioned review action.
- Admin export now includes report, event and hold tables, and requires verified
  administrator access. Generic administrator reads/writes also require verified
  email. Existing audit table bootstrapping is idempotent.

Tables: `listing_reports`, `listing_report_events`, `listing_report_limits`,
`listing_moderation_holds`. They use text IDs so deleted listing/account history
and demo identifiers can be retained without foreign-key cascades. Account-data
retention/deletion policy must be defined before broad release; this feature does
not claim regulatory compliance. Fields are parameterized, rendered as text,
and protected by server authorization and same-origin mutation checks.

The root Worker creates tables idempotently on first authorized use. Matching
Prisma models and SQL migration are under `apps/api/prisma`. Migration generation
does not apply a production migration. The independent Nest API does not yet
implement report routes or the publication hold guard. Its generated frontend
must use the root API until equivalent endpoints and guards are ported. Do not
switch production to the standalone API assuming feature parity.

## Additional launch preparation

The sitemap now reads up to 10,000 currently published real listings and their
update dates; draft/rejected/deleted listings and demo listings are excluded.
`/api/sitemap` exposes only public listing IDs/update dates for the generated
standalone frontend adapter. The canonical base remains the existing Site URL.
Larger catalogs need a sitemap index/chunks. A custom domain still needs its own
configuration. Custom 404 and retryable error pages avoid exposing server errors.

The shared JSON request reader enforces a 100,000-byte streaming limit even when
Content-Length is absent. File-upload routes keep their separate existing limits.

## Verification

36 unit tests passed, including reason/length/transition validation, atomic quota,
and bounded chunked JSON. Real local D1 API tests covered authentication,
verification, CSRF, owner rejection, concurrent duplicate submission, private
fields, stale review conflicts, hold transaction, approved-owner edit bypass
prevention, administrator release, published-only sitemap, reopening/history,
and admin export access. Browser tests used dedicated local test users and a
local cloned listing: guest gate, actual report submission, account tracking,
admin review/hold/history, privacy, public 404 and 320/390px layouts with no JS
errors. Only fixture photo transport was mocked; report requests were real.
Fixture accounts, sessions, listing and report records were cleaned up.

Production email delivery, disaster recovery, external monitoring, a permanent
360 worker and a full independent security assessment remain separate launch
requirements. No paid service, messaging campaign or external notifications were
enabled by this change.
