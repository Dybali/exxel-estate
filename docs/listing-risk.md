# Sahte ve tekrar ilan tespiti

Advisory fraud and duplicate check for administrators. It never deletes or rejects a listing.
Code: `lib/listing-risk.ts` (pure: hashing, text, keywords, scoring), `lib/listing-risk-server.ts`
(queries, admin actions), `app/api/admin/risk/route.ts`, `components/AdminSuspicious.tsx`.
Tests: `tests/listing-risk.test.mjs`.

## When it runs

- `POST /api/listings` and `PATCH /api/listings/[id]`, before the database write. A failing check is
  logged and ignored; the listing is saved as before.
- Admin backfill ("Şüpheli ilanlar" → "Eski ilanları tara"): at most 50 old listings per run,
  12 photos each, oldest first. Backfill only flags; it never changes a listing's status.

## Storage (no schema change)

Everything is in `listings.presentation`:

| key | content |
| --- | --- |
| `photoHashes` | `{ [photo url]: dHash }`, 16 hex digits per photo |
| `risk` | `{ v, score, level, reasons: [{code, weight, params}], matches: [{id, sameOwner, photos, exact, text, attributes}], checkedAt, signature, review? }` |
| `riskFlag` | `"medium"` or `"high"` while open; removed by "Sorun yok" |

`publicPresentation` (`lib/listing-location.ts`, used by `parseListing`) removes all three, so no
public API, page or owner view receives them. Admin APIs read them from the raw row.

The "Bekleyen işler" count and the admin list use `json_extract(l.presentation,'$.riskFlag')`, which
`lib/pg-json.ts` rewrites for PostgreSQL. Exact file duplicates use the existing
`property_images.checksum_sha256`.

## Photo fingerprints: why in the browser

The upload path runs on Cloudflare Workers, which has no image decoder (no canvas, no sharp), and
the Node build has no image library either. The browser that prepares the photo
(`lib/photo-optimize.ts`, `photoFingerprint`) therefore computes a 64-bit dHash of the final,
watermarked image and sends it as the `photoHash` form field. `app/api/media` accepts only 16 hex
digits (near-uniform hashes are refused) and stores it as R2 object metadata `x-amz-meta-phash`.
The listing routes already `HEAD` every new photo, so they read the hash at no extra cost.
The backfill decodes stored photos in the administrator's browser with the same function.

Limitation: a client can send a wrong hash. That only weakens one advisory signal; the stored file
checksum is computed on the server.

## Signals and weights

| code | condition | weight |
| --- | --- | --- |
| `photos_other_owner` | another account's listing has a photo within Hamming distance 8 (`PHOTO_HAMMING_MAX`) or the identical file | 1 photo 20, ≥2 photos 35, ≥4 or an identical file 40 |
| `text_other_owner` | word 3-shingle Jaccard ≥ 0.6 with another account's listing (Turkish-aware folding) | 15, ≥ 0.85: 20 |
| `own_duplicate` | same account, live listing, same city/purpose/type, and an identical file, ≥2 similar photos, or text ≥ 0.8 with location, type and price within 10 % | 25, ≥2 listings 35 |
| `price_low` | TL price per m² < Q1 − 1.5·IQR and < half the median of ≥5 published listings in the same district, purpose and type | 25 |
| `price_high` | > Q3 + 3·IQR and > 3× median | 5 |
| `scam_terms` | Western Union, "yurt dışındayım", keys by post, gift cards, crypto … in 8 languages | 30 |
| `payment_terms` | kapora, ön ödeme, Vorauszahlung, acompte, предоплата … (only if no strong term) | 12 |
| `external_contact` | URL, e-mail, phone or messenger name in the text | 8 |
| `phone_reused` | owner's phone or a phone in the description belongs to other accounts (same company excluded) or appears in another account's listing text | 20 |
| `new_account_burst` | account < 7 days old with ≥ 10 listings in 24 h | 15 |

Candidates: listings in the same city or of the same owner, newest 500 (`RISK_CANDIDATE_LIMIT`),
plus listings holding an identical file. Demo and sample ids (`ex-`, `sample-`) are ignored.

Score = sum, capped at 100. Levels: medium ≥ 35, high ≥ 70 (`RISK_THRESHOLDS`). One signal alone
reaches at most medium.

## Actions

- **high**: a non-admin's new listing or edit is saved as `pending` with review note
  "İlanınız kontrol için incelemeye alındı." (shown translated in İlanlarım). Administrators'
  own saves are never held back.
- **medium**: published as usual and flagged in "Şüpheli ilanlar".
- **low**: nothing.

Admin view: score, reasons, the listing next to its matches (photos, title, price, owner),
"Sorun yok" (closes the flag, `admin_audit` action `risk_clear`), "İncelemeye al" and
"Yayından kaldır" (existing moderation via `/api/admin`). Publishing a listing from the review
screen also closes its flag. A closed flag stays closed while later checks find only the same
reasons and listings (`risk.review.keys`); anything new opens it again.

## False positives to expect

- Several agents legitimately listing the same flat with the same photos: medium flag only.
- One shared building or complex photo: weight 20, below medium.
- Agents reusing their own description template: same-owner text matches need near-identical
  text plus same location, type and price.
- Sale and rent of the same home by one owner: different purpose, not a duplicate.
- "Kapora" is common in honest Turkish listings: weak term, 12 points.
- Offices sharing one phone across agent accounts: excluded when the account company is the same;
  team members without a company name can still trigger `phone_reused`.
- Districts with few listings: no price judgement below 5 comparables.
