# Account and listing management

The Sites Worker and standalone NestJS API expose the same contracts.

| Route | Behaviour |
| --- | --- |
| `POST /api/account`, action `update_profile` | Authenticated user updates only their own `name`, `phone`, and `whatsappEnabled`. Omitted values stay unchanged. Roles and approval cannot be changed here. Phone numbers are normalized to international format. |
| `GET /api/favorites` | Returns `ids` and up to 100 current `listings`, including labeled samples and published customer listings. Unpublished or deleted listing details are excluded. |
| `POST /api/favorites`, `{id}` | Saves an existing published or sample listing for the current user. Repeated saves are idempotent. |
| `DELETE /api/favorites?id=...` | Removes only the current user's saved entry. |
| `PATCH /api/listings/:id` | Owner or administrator edits listing fields, price, translations and image references. `expectedUpdatedAt` rejects a stale editing session. UUID and existing R2 keys are retained. |
| `GET /api/listings/:id/contact` | Requires login. Returns the listing owner's supplied phone and WhatsApp consent; the UI only renders a WhatsApp link when consent is enabled. |
| `GET /api/messages` | Existing conversation participants receive `peer_whatsapp_phone` only when the peer has opted in. Other members cannot browse that number through this endpoint. |

Approved agents publish new and edited listings directly. Individual owners submit new listings and edits for administrator approval. Unapproved agents cannot create listings. Administrative moderation remains available for all published listings.

The WhatsApp notification is optional. Dismissal is remembered per account in that browser; the profile page always allows enabling or disabling it. A `wa.me` link opens a conversation in WhatsApp; the platform does not claim to verify ownership of the phone number or connect a WhatsApp Business API.

Database changes: `postgres/migrations/005_whatsapp_consent.sql` adds the consent flag in Neon. The matching Prisma migration is idempotent so later standalone deployment can use the existing database. D1 migrations add the same flag and the media-reference table for local integration testing. Photos remain in R2, while object keys and profile data stay in the database.

Validation included both production builds and the local account-feature integration test: role tampering, ownership guards, pending/private listings, approved-agent publication, price-only and complete edits, stale writes, real/sample favorites, authenticated phone access, and WhatsApp opt-in/out. The local script `scripts/test-account-features.mjs` requires the prepared local D1 administrator fixture at `work/feature-admin.json`, local R2 preview settings, and a server on `127.0.0.1:8787`; it never targets the production database. Test media is disposable and should be cleaned after browser QA.
