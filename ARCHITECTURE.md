# Exxel Estate architecture

## Current public service and migration path

The existing public Site continues serving the production audience while the separate hosting accounts are connected. It remains connected to the same Neon PostgreSQL database and Cloudflare R2 bucket. Do not delete it until the new frontend and API have passed a production cutover check.

`apps/web` is the standalone Next.js + TypeScript frontend for Vercel. `apps/api` is the standalone NestJS + TypeScript REST API for a Node.js host. The Next application proxies `/api/*` to the API origin so authentication cookies and media URLs stay on the website origin. `apps/web/scripts/prepare.mjs` can refresh its frontend snapshot from the current Site code; run `npm run sync` in `apps/web` after modifying the root frontend, then commit the generated files.

The Nest API uses Prisma with the **existing** Neon schema. The introspected schema and versioned baseline are under `apps/api/prisma`. The baseline has been marked applied on the existing database; use `npm run prisma:deploy` for future migrations. Never use `prisma migrate reset` against production. User and listing UUIDs, session rows, image keys, and all existing data remain stable. Existing PBKDF2 password hashes and session cookies are accepted by the new API, with short-lived JWT access cookies issued on new sign-ins.

Cloudflare R2 stores image bytes. Neon stores image metadata and object keys in `property_images`. The API supports direct upload with a five-minute presigned URL (`/api/media/presign`, then `/api/media/complete`) and a compatible multipart endpoint for the current listing form. The API checks identity, image size, type, signature, ownership, and actual R2 object presence before publishing image references. Published photos may be served through a configured Cloudflare CDN media domain; until then, the API serves cached image responses.

Listing photos are stored at up to 2560px. At upload the browser (`lib/photo-optimize.ts`) also makes watermarked WebP copies at 640px and 1280px long edge and sends them in the same `POST /api/media` request (fields `variant640`, `variant1280`; one request, so one count against the upload limit). The server stores them next to the key it generated, `listings/<uid>/<uuid>.w640.webp` / `.w1280.webp` (`lib/listing-media.ts`), after the same signature and metadata checks plus a WebP size check; the database and `images` keep main keys only. `GET /api/media/<main key>?w=640|1280` applies the main photo's access rules and serves the copy, or the original when there is none (all photos uploaded earlier). Cards and the listing gallery use them through `photoVariantUrl` / `photoSrcSet`; `removeListingMedia` deletes the copies with the photo.

Published listing reads are public. Registration, login, favorites, messaging, photo uploads, and seller actions require a server-side session. Emlakçı accounts and listings require administrator approval. Passwords and OAuth secrets belong in runtime environment variables only.

## Hosting

`render.yaml` defines a Frankfurt Node service for the API with a health check and pre-deploy migrations. Connect the GitHub repository to Render, fill the secret environment variables from the owner's Neon, R2 and Google Cloud dashboards, and deploy it first. Then import the same repository into Vercel with **Root Directory `apps/web`** and set `API_BASE_URL` to the Render origin and `NEXT_PUBLIC_SITE_URL` to the eventual frontend URL. Keep the existing public Site running until login, uploads, messaging, admin moderation, and media have been tested through the new domain.

The Google OAuth file currently authorizes `https://www.exxelestate.com/api/auth/callback/google`. That hostname is not owned or configured yet. Set `FRONTEND_ORIGIN` and `GOOGLE_REDIRECT_URI` to the same actual HTTPS frontend origin after domain purchase and DNS setup. Until then, Google sign-in stays disabled on the new host; email/password accounts work independently.

`apps/api/.env.example` and `apps/web/.env.example` document settings. Real credentials are intentionally excluded from Git. Locally, `apps/api/.env` is populated from the owner's provided files and is ignored by Git. The GitHub repository must remain private until a secret scan and publication review are complete.

## API contract

Public: `GET /api/health`, `GET /api/listings`, `GET /api/listings/:id`, `GET /api/locations?city=&district=`, `GET /api/city-counts`, `GET /api/companies?category=&page=`, `GET /api/companies/:id?page=`, `GET /api/media/listings/:owner/:file`. City counts exclude sample and pending listings. Company endpoints expose approved agencies/developers together with explicitly marked presentation examples; real-company counts and portfolios include published listings only. Directory pages contain 24 companies; profile pages contain 24 listings. Company category is stored in `agencies.category` by migration `20261014010000_agency_category`.

For the presentation, five fictional company profiles are served alongside approved agencies by both APIs. They are marked `sample: true` and linked to the existing `source: "demo"` property examples; the UI labels each profile and listing clearly. Real company approvals, user accounts, messages, and published listings remain in Neon, while these presentation fixtures are versioned in `data/demo-companies.json` and `lib/listings.ts`. Run `node scripts/export-demo-listings.mjs` after editing either fixture so the independent API receives matching JSON. Sample properties are excluded from the map's real published-listing counts, and their contact cards do not offer seller messaging.

Account: `GET /api/account`, `POST /api/account` with `action` (`register`, `login`, `logout`, `request_seller_role`), `GET /api/auth/google`, `GET /api/auth/callback/google`.

Authenticated: `GET/POST/DELETE /api/favorites`, `GET/POST /api/messages`, `GET /api/mine`, `POST /api/media`, `POST /api/media/presign`, `POST /api/media/complete`, `POST /api/listings`.

Admin: `GET/POST /api/admin` for pending listings, agent approvals, and country settings. New listings start with `status=pending`; the public API filters for `published` only.

## Verification and scale

Run `npm ci && npm run build && npm test` in `apps/api` while a local API is running with an isolated or approved Neon connection. Run `npm ci && npm run build` in `apps/web` with `API_BASE_URL` set. Database indexes cover publication status, city, property type, price, owner and messages. Catalogue responses are paginated at 12 items; administrative listing responses at 50. Load-test the deployed infrastructure before planning for 1,000 simultaneous users; account count alone does not establish concurrent capacity.

The homepage uses a real Antalya villa photograph by [Ahmet ÇÖTÜR on Pexels](https://www.pexels.com/photo/modern-luxury-villa-with-infinity-pool-and-scenic-views-32226001/). The province map uses [OpenStreetMap](https://www.openstreetmap.org/copyright) geometry under ODbL, packaged in `public/turkiye-iller.geojson` so it remains available without a third-party map API at runtime.

The language menu displays SVG flags from [flag-icons v7.3.2](https://github.com/lipis/flag-icons) under its MIT license, copied to `public/flags` with `LICENSE.txt`. These icons are visual cues alongside written language names; the chosen language persists in the browser.

## Messaging workspace (October 2026)
- The main menu exposes Mesajlarım to all visitors; unsigned visitors sign in first. Signed-in users see an unread count. The account inbox accepts ordinary listing threads and admin-initiated support conversations.
- `/yonetim#admin-message-center` lets administrators search/paginate members by name, email, company and role, start a private support conversation, and reply. Listing and agent tables have contextual Mesaj yaz actions. Admins see conversations they participate in, not other users' private threads.
- The shared, parameterized service is `lib/messaging-service.ts`, copied byte-for-byte to `apps/api/src/shared/messaging-service.ts`. Worker and Nest controllers use adapters to the same contract. A support thread uses an opaque `admin:<admin UUID>:<member UUID>` value in the existing text `listing_id` column; no fake listing row is created.
- Messages are paged at 50; conversations at 30; member lookup at 25. Read receipts are per-message and recipient in `message_receipts`. PostgreSQL and Prisma migrations are supplied; D1 schema/migration is updated. During rollout the authenticated API initializes only this new table idempotently on first use, without modifying existing records. Later SQL migrations use IF NOT EXISTS and are safe after bootstrap.
- GET only reads; the same-origin POST action=read records only incoming messages actually loaded in a visible, focused thread. Message content is plain text, 2–2000 characters. Sending remains limited to 10 messages/minute per sender. The client reuses requestId after a failed send to avoid duplicates. Drafts survive thread switches within the mounted inbox; they are not saved permanently across browser refreshes.
- An open thread refreshes every 15 seconds; the conversation list every 20 seconds and header count every 30 seconds. There is no websocket, email delivery or attachment sending in this release. Read receipts are included in the admin data export.
- `node --test tests/messaging.test.mjs` runs isolated SQLite-backed behavioral/security tests against the shared service. Local real-route browser checks use only ignored D1 fixtures and never send production messages.

## Listing details
- Photo-count-aware gallery, native-dialog keyboard navigation, favorites, share/copy actions and a two-column property/seller layout.
- `GET /api/listings/:id/contact` returns seller phone/profile only to signed-in members for a published listing (or its owner/admin). Responses are private/no-store; the public page does not embed phone numbers. Agency approval badges reflect actual account approval; no synthetic ratings or identity claims are displayed.
