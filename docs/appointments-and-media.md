# Appointments, client tracking and listing media

## Viewing requests and private client tracking

`GET /api/appointments` returns the latest 100 requests in which the signed-in
account is buyer or listing owner. Only the owner receives the CRM stage and
private note; the buyer gets null for these fields. Other accounts cannot read
or update the request. No email address, phone or session token is returned.

`POST /api/appointments` accepts:

- `{action:"request",requestId,listingId,slotAt,message}`. Both IDs must be UUIDs.
  The listing must be published, and its owner is resolved server-side. An
  account cannot request its own listing. A slot must be at least 15 minutes
  ahead and within 180 days. Messages contain 5–1000 characters. Request IDs
  provide safe retries; a partial unique database index prevents multiple
  requested/confirmed appointments for the same buyer and property. A maximum
  of ten active requests is also checked at insert time.
- `{action:"update",id,version,status?,stage?,privateNote?}`. Version-conditional
  updates reject stale changes with 409. Owners can confirm or decline requests,
  cancel requested/confirmed appointments, and complete confirmed appointments.
  Buyers can cancel their requested/confirmed appointment. Terminal requests
  cannot be reopened. Only the owner may change stage/note, including after the
  appointment has ended. Notes are limited to 2000 characters.

Stages are `new`, `contacted`, `viewing`, `offer`, `closed`. Stages and appointment
status are separate, so a completed viewing can still be at the offer stage.
The dashboard at `/hesabim?tab=randevular` supports incoming/outgoing/status
filters, listing/person search and private client notes. It refreshes every
60 seconds while visible and has an explicit refresh button. Times are stored
as UTC ISO strings and displayed in the device time zone. This is a proposed
viewing followed by seller confirmation, not an availability calendar or an
external calendar synchronization. It does not promise automatic prevention
of overlapping viewings across different clients or properties.

There is no outbound email/SMS delivery, automatic reminder or video-call
account integration. No actual user was contacted for testing; fixtures used
disposable test accounts. Existing messaging remains available for arranging
another time. Appointments are included in the administrator export.

## Floor plans, videos and virtual tours

Listings store an optional `presentation` JSON field with `floorPlan`, `videoUrl`
and `tourUrl`. The same fields are available in the creation form, private draft,
editing form, preview, public detail page and administrator review.

- Floor plans use the existing R2 image upload pipeline (JPEG/PNG/WebP, maximum
  8 MB). The server validates the uploader path and object existence. Floor-plan
  references are recorded in `property_images`, separately from the gallery
  array, including metadata and ordering. Removing a reference does not delete
  a potentially shared R2 object. PDFs are not supported by this image field.
- Video URLs must be HTTPS YouTube or Vimeo links. The frontend constructs a
  canonical YouTube no-cookie or Vimeo embed URL and loads the iframe only after
  Play is clicked. JavaScript URLs, impersonating hostnames, user-info URLs and
  arbitrary external hosts are rejected.
- 360 tours accept HTTPS Matterport or Kuula URLs and open the normalized link
  in a separate tab. This feature displays a provided tour; it does not produce
  tours, host raw video files or create a Matterport/Kuula account.

Individual-owner media edits return the listing to pending review. Approved
agents publish directly, as with other listing changes. The existing public
media policy exposes referenced assets only for published properties (and
profile assets); owners/admins can view private uploads. Previously public
assets may remain in client/CDN caches according to the existing cache policy.

## Schema and verification — 20 October 2026

PostgreSQL migration `010_presentations_appointments.sql` and Prisma migration
`20261019030000_presentations_appointments` add the data. Drizzle migrations
0017–0018 provide the D1 equivalent. The custom partial unique index is retained
in SQL migrations because Prisma's schema cannot represent this partial index.
All 19 D1 migrations were applied successfully to an empty SQLite database.

- NestJS complete API suite: **30/30 passed**, 61.2 seconds.
- Local production Worker new-feature suites: **22/22 passed**, 30.6 seconds.
- `test/appointments-media.test.mjs` performs actual R2 uploads and verifies
  floor-plan metadata, public access, removal, individual moderation, unsafe URL
  rejection, future-time validation, owner exclusion, idempotency, duplicate
  protection, participant privacy, private-note authorization, status transitions
  and stale-write conflicts. Disposable users, listings and R2 objects are cleaned.
- Vinext, Next.js/TypeScript and NestJS/Prisma production builds pass.
- Browser QA uses disposable accounts and a pending private fixture. It verifies
  the owner dashboard, changing the CRM stage, confirming a request, and mobile
  layout. At 390px viewport width, the document measured 379px (no horizontal
  overflow). No real viewing or message was sent to a real member.
- Local-only load smoke: **200 requests, 10 in flight, zero failures**, 4.1s,
  p50 173ms / p95 365ms / maximum 770ms, against NestJS with configured Neon.
  This read-only catalogue check also ran while the Worker tests used Neon.
  It is not a 1000-concurrent-user production capacity certification.

The source includes `test/load-smoke.mjs`, which refuses public/non-local URLs.
Production monitoring, daily backup/restore automation, an email provider and
real-domain Google OAuth verification still require external service setup.

## Native 360° panoramas

An optional `panoramas` array is stored inside the existing `presentation` JSON;
no database migration is needed. Each entry has `{id,name,url}`. Creation and
editing accept either that array or its JSON string (the private draft stores
string fields). Up to eight unique room IDs/images are accepted; names are
required and limited to 60 characters. Paths must belong to the listing owner.
Panorama attachments participate in the existing R2 object-existence checks and
`property_images` reference/metadata maintenance, alongside gallery and floor plan
images. Removing a room removes the listing reference; it follows the existing
media-retention policy and does not immediately delete the R2 object.

Upload through `POST /api/media?purpose=panorama`, with the existing authenticated
same-origin multipart pipeline. The form accepts spherical 2:1 JPEG sources up to
25 MB, resizes them to at most 4096×2048 and strips source metadata by re-encoding.
The uploaded file remains subject to the 8 MB image cap. The server independently
checks JPEG SOF dimensions (1024×512 through 4096×2048, approximately 2:1).
Ordinary photos are not converted into missing 360° imagery.

The gallery exposes a 360° button only when the property has panoramas. An
on-demand Pannellum 2.5.7 viewer, served locally with its MIT license, provides
mouse/touch panning, zoom, reset, fullscreen and room selection. Labels are React
escaped; Pannellum HTML escaping is also enabled. Close/Escape returns focus and
releases the WebGL viewer. Mobile and unsupported-WebGL states are handled.
There are no spatial hotspots, floor-plan navigation or 3D geometry reconstruction.

Validation: `node --test tests/panoramas.test.mjs`; API TypeScript check after
Prisma client generation; local Playwright checks covered actual WebGL rendering,
room switching, reset, modal lifecycle, 1440/390/320 layouts, upload preparation,
real local draft persistence/reload and existing-attachment PATCH persistence.
Upload HTTP transport was mocked during local UI tests because local R2
credentials were unavailable. Production R2 upload needs a real user panorama
for a full end-to-end delivery check; no sample panoramas were published.
