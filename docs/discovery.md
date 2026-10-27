# Search, comparison, map and alerts

The Sites Worker and Nest API expose the same authenticated `GET /api/discovery`
and same-origin `POST /api/discovery` contract. Data is stored in Neon, not browser
storage. PostgreSQL migration `006_discovery.sql` and Prisma migration
`20261018000000_discovery` are idempotent. D1 equivalents are migrations 0013–0014.

## Account searches and alerts

- Save: `{action:"save", name, query}`; up to ten filter sets per account.
  Canonical filters deduplicate searches. The UI intentionally does not silently
  upload older browser-only saved searches.
- Remove or pause: `{action:"delete", id}` / `{action:"toggle", id, enabled}`.
  Every mutation scopes the record to the authenticated account.
- Read all: `{action:"read", checkedAt}` uses the feed's server timestamp, so
  events arriving after the fetched feed remain unread.
- Price preference: `{action:"price_preference", enabled}`. Re-enabling starts
  from that moment instead of replaying paused notifications.

The feed returns saved searches, search match counts, up to 50 unread price
changes, the unread card count, price preference and `checkedAt`. Alerts are
derived from durable records. They refresh on sign-in/page load and every minute
in a visible browser. There is no email, push or WhatsApp delivery in this release.
There is no unattended job or separate messaging-service requirement.

`published_at` records first publication, including approved-agent submission and
admin approval of pending listings. Existing published listings are baselined at
migration time. Demo listings never trigger alerts. `price_history` is written in
the listing update transaction; decreases are eligible only after favoriting,
while the listing is published and currency/purpose still match. Currency or
purpose changes do not fabricate a price decrease. Historical events before
this migration are not invented. Read positions and preferences sync across
devices. Notifications disappear when the underlying listing is unpublished or
the favorite is removed. The administrative export includes all three tables.

## Comparison

Select up to four public listings on cards or detail pages. The floating tray
opens `/karsilastir?ids=…`. Selected IDs persist in browser storage; shareable
comparison URLs resolve current listing data through the API. Private/removed
listings are excluded. Values remain in their original currency and sale/rental
basis; they are not converted or ranked as equivalent prices.

## Map

Leaflet is loaded only when map view is opened. OpenStreetMap supplies the map
tiles, with attribution retained. `/api/listings?map=1` returns at most 500
matching listings; the map reports truncation and encourages narrower filters.
Markers cluster by screen grid, with drill-down and a selection list for
coincident locations. The map supports manual area search and optional searching
after movement. Bounds use west,south,east,north decimal degrees, validated on
both API implementations, and are retained in saved searches and URLs.

Listings without coordinates are explicitly grouped at province level using
bounding-box centers from the existing licensed Turkish province geometry
(`public/turkiye-iller.geojson`, matching `turkiye-map-shapes.json`). These are
not claimed to be exact locations or city centers. The generated
`data/province-centers.json` is also copied into the Nest shared data. Spatial
search applies the same fallback consistently on map, catalogue and alerts.
The map never asks visitors or sellers to enter latitude or longitude.

## Verification

`apps/api/test/discovery.test.mjs` creates disposable accounts and one temporary
listing against the configured integration database. It cleans up in `finally`.
Run with the local Nest API or set `API_TEST_BASE_URL` to a local Worker using the
same integration database. It tests account isolation, origin checks, canonical
saved queries, publication-only alerts, read positions, price changes,
currency/opt-out handling, coordinate/province area searches and input limits.
Use a test database in CI. Existing customer accounts are never used as fixtures.
