# Office authority document review

The user's clarified requirement is a once-per-office Taşınmaz Ticareti Yetki Belgesi upload, not a property-level EİDS authorization. This is a private platform review. It does not implement official government identity/authority checks and must not be presented as EİDS verification or as a replacement for it.

## Workflow

- Verified agent accounts see the document card on `/ilan-ver` and `Hesabım → Profilim`.
- Upload document number plus PDF/JPEG/PNG (maximum 5 MiB; streamed byte cap and matching file signature). Company name comes from the authenticated account.
- Only one pending/approved document exists per account. No repeated upload after approval. Rejected documents can be replaced using the current version; the replaced private object is removed.
- Agents with a pending document may submit their first listing for review. No document or a rejected document blocks submission on the server. Draft editing remains available.
- `/yonetim` → Ofis yetki belgeleri provides private downloads, pending/approved/rejected filters, paging and optimistic concurrency. Approval activates both the user and agency. Rejection requires an explanation, shown to the owner; reupload is allowed.
- First pending listings remain pending until a separate listing review. Admin publication requires an approved matching office document for agent-owned listings. Subsequent new listings from approved agents with approved documents publish directly. Moderation holds and rejected-listing edit protection remain effective.
- Existing public listings are not automatically removed by this change. Previously approved agents without a document must submit one before creating another listing. Existing listing edits retain the current review/hold rules. Admin account rejection still suspends direct publication; a document badge does not override suspension.
- Office name is snapshotted; changed company names cannot reuse the prior document for new publication. Automated expiry/renewal and external authenticity lookup are not implemented.

## Storage and access

`office_verifications` uses text account IDs for compatibility with D1 and UUID-backed Neon users. An idempotent server schema bootstrap matches the Prisma migration. Private files live under `private/office-verifications/<user>/<document>.<ext>` in the internal BUCKET binding, never in public listing-image storage. The public media route only accepts `listings/...` keys.

`GET /api/agent-verification` returns the owner's metadata. `?download=1` streams an authenticated attachment with private/no-store, nosniff and sandbox headers. A verified admin can select `userId`; other users cannot. Object keys are not exposed by this endpoint. `POST` accepts raw file bytes with Content-Type, X-Document-Number and X-Document-Version. No multipart or original filenames are persisted. Files are not publicly embedded and are not malware-scanned; MIME signatures are format checks, not a malware guarantee.

`GET/POST /api/admin/agent-verifications` require verified admin rights. Approval/rejection plus user/agency state and admin audit are in a transaction, conditional on a random action token. Concurrent stale decisions return 409. Existing generic admin agent approval cannot bypass document approval. Admin export includes metadata under `officeVerifications`; exporting JSON does not back up file bodies. Access to storage/backups requires separate operational controls. Account deletion/retention policies need to cover these private records and objects before public launch.

Root Vinext routes are authoritative for Sites hosting. The separate Nest API has schema parity only, not this document workflow. Do not switch to Nest assuming route parity.

Official context: https://ticaret.gov.tr/kurumsal-haberler/elektronik-ilan-dogrulama-sistemi-eids-yetki-dogrulama-uygulamasi-hayata-gecirildi

## Validation (21 October 2026)

39 unit tests passed, including streaming file limits, format signatures and live-database publication eligibility after suspension, company change, rejection and approval. Actual local D1/R2 API tests covered upload/download authorization, private media boundaries, CSRF, concurrent upload/review, version conflicts, rejection/replacement, account and agency activation, first-listing publication gate, export and suspension. Browser tests performed actual PDF upload and admin approval at 320/390px and desktop sizes, checked the first-listing submission gate, post-approval publish button and profile status, and found no page JavaScript errors. Existing reporting/moderation API integration tests also passed with a synthetic approved-document fixture.

The local preview has no external listing-photo storage credentials. Full creation of a new listing with a real photo stopped at that existing storage prerequisite; first-listing publication tests used an isolated pending listing fixture. This does not validate production photo upload or official EİDS. Root-wide TypeScript checking still reports existing Response.json unknown-type issues in older components; no new document-workflow TypeScript errors were found. Prisma generation passed.

## Otomatik kontrol (2026-11-13)

**2026-11-20: kapalı (sahibinin kararı).** Yalnızca yetki belgesi istenir; belge yüklenince başvuru "İncelemede" olur ve yönetici Yönetim › Emlakçı başvuruları ekranından onaylar. Otomatik kontrol `OFFICE_AUTO_CHECK=1` ayarıyla yeniden açılır; açıkken de yüklemenin yanıtını beklemez, arka planda çalışır (OpenAI okuması bir dakika sürebildiği için Mittwald ağ geçidi bağlantıyı kesiyordu).

Sahibinin kararı: tüm kontrolleri geçen başvuru otomatik onaylanır, yönetici sonra TTBS'den teyit eder; mevcut onaylı ofislere dokunulmaz. Hiçbir başvuru otomatik reddedilmez.

- `lib/office-check.ts`: yüklenen belge OpenAI GPT-6 Luna ile okunur (PDF dosya olarak, resim image_url olarak; strict JSON, düşünme kapalı; `OFFICE_CHECK_MODEL` ile değiştirilebilir, `OPENAI_API_KEY` yoksa okunmaz ve yönetici karar verir). Belge başına ≈ 0,0001 $.
- Kontroller: belge numarası başka bir bekleyen/onaylı hesapta yok, aynı dosya (SHA-256) başka hesapta yok, vergi numarası VKN/TCKN kontrol hanesiyle geçerli, belge bir Taşınmaz Ticareti Yetki Belgesi, belge numarası ve işletme adı başvuruyla uyuşuyor (hukuki ekler ve Türkçe harfler yok sayılır), geçerlilik tarihi geçmemiş, belgedeki vergi numarası aynı, değiştirilme izi yok. Hepsi geçerse `decideOffice` (`lib/office-decision.ts`, gözden geçiren "system") onaylar ve bekleyen ilk ilanlar yayımlanır; sonuç `office_checks` tablosunda tutulur.
- Yönetim › Üyeler ve firmalar › Emlakçı başvuruları: başvuru ayrıntısında puan, kontroller, belgeden okunanlar, **TTBS'de sorgula** (`https://ttbs.gtb.gov.tr/Home/BelgeSorgula`; resmî API ve robot kontrolü nedeniyle insan adımı), **TTBS doğrulandı** ve gerekçeli **Onayı geri al** (`revokeOffice`). "TTBS kontrolü bekleyen" filtresi otomatik onaylanıp teyit edilmemişleri listeler.
- Günlük görev (`officeExpiryJob`): geçerlilik bitmeden 30 gün önce bir hatırlatma e-postası, bittikten sonra onay geri alınır.
- Herkese açık: onaylı ofisin profilinde ve ilan iletişim kartında yetki belgesi numarası (ilanlarda zorunlu) ve TTBS ile doğrulandıysa bu bilgi.
- Testler: `tests/office-check.test.mjs`.
