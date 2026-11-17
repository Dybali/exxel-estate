# Cookie preferences, business transfers and construction membership

The deployed Sites app and the separate Next frontend use matching components. The live API is implemented in `app/api`; the existing Nest migration target is not deployed by Sites.

## Business transfers

The homepage category is **Devren mülk**, with `category=devren&purpose=devren`. It filters by listing purpose, across property types, rather than incorrectly treating timeshares as transfers. The former `category=devremulk` URL remains an explicit legacy timeshare filter; existing records are not relabeled. SQL, sample listings and saved-search filters use the same category meaning.

## Cookies

- A nonblocking preference panel offers equally accessible essential-only and accept-all buttons, plus separate statistics and external-video choices. Both optional categories default off.
- `POST /api/privacy/consent` validates booleans and same-origin requests; it stores a versioned browser preference for 180 days. This browser-specific choice is not linked to a user identity.
- The listing view tracker is gated both on the client and server. Withdrawing statistics permission clears the HttpOnly `em24_viewer` cookie. No view record is written without consent.
- Video iframes require external-media permission and a play action. Revoking that choice unmounts the player.
- Preferences can be reopened from the footer or cookie policy page. The six existing UI languages include the new preference panel and cookie policy. Language selection, login and search remain available without optional consent.
- `/cerez-politikasi` describes the actual application cookies. It is technical product documentation, not a certification of legal compliance. Operator-specific privacy contacts and final legal wording are maintained by the business.
- Reference guidance: https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber and https://www.edpb.europa.eu/edpb-cookie-policy_en

## Construction companies

- Entry: `/kurumsal-uyelik`, the homepage company section and the company directory. Registration includes the visible **İnşaat firmasıyım** choice.
- Accounts continue to use the established seller authorization role `agent` and a distinct `agencies.category=developer`. Registration creates pending user and company records transactionally. It never grants administrator or approved status.
- E-mail confirmation and private company document review are required. Construction companies submit a trade-registry or activity document; real-estate agencies retain their existing authorization-document flow. Admin review displays the company type and activates the existing publication permission checks.
- Google sign-in preserves identity verification; users complete their company application from Profile, with Construction company preselected. Existing buyers can apply through the same profile flow.
- The **Firma bilgilerim** dashboard section stores city, HTTPS website, address and description. Public approved company profiles expose city and description, not the private address or submitted verification document. Company name and type cannot be changed through this metadata endpoint.
- `GET/POST /api/company-account` is authenticated and owner-scoped; writes also require verified e-mail. Version checks prevent overwriting concurrent edits. SQL is parameterized.
- PostgreSQL migration: `postgres/migrations/012_company_profiles.sql`, with matching Prisma migration/model and schema bootstrap. Runtime creation is additive and uses the existing Neon connection. Admin exports include `companyProfiles`; ordinary PostgreSQL backups include the new table.

## Checks

`node --test tests/privacy-company.test.mjs tests/listing-statistics.test.mjs tests/office-publication.test.mjs tests/office-verification.test.mjs`

Tests exercise consent validation/expiration, revocation, measurement denial before storage, transfer semantics, registration status, owner isolation, stale profile updates, document file signatures and existing direct-publication restrictions. Browser checks and production build results are reported separately at delivery.

The 14 scoped tests passed. A local Worker HTTP check also confirmed that rejecting optional cookies sets the preference cookie, clears the viewer cookie and returns `recorded:false` for an unconsented view. The broad TypeScript check is not clean: existing Cloudflare environment and unknown-JSON type errors remain elsewhere in the project; it is not reported as passed.

## Ofis sayfası ve danışmanlar (2026-11-17)

`lib/company-office.ts`, `components/CompanyProfile.tsx`, `app/api/companies/[id]`:

- Üst bölüm: logo, ad, onay, il, **Taşınmaz Ticareti Yetki Belgesi** numarası (ofis doğrulamasından) ve "Telefonu göster" (`/api/agents?phone=`).
- Sol sütun **Danışmanlarımız**: önce ofis sahibi, sonra aktif ekip üyeleri; fotoğraf, unvan, ilan sayısı ve **Danışmanın ilanları** (`?danisman=<kullanıcı id>`: ofis sahibinin kendi ve ofis ilanları ya da bir danışmanın ofis ilanları). Listelenmeyen id tüm ofisi gösterir.
- **Hizmet verdiğimiz diller**: ofis sahibi ve danışmanların seçtiği dillerin birleşimi (`agent_languages`); ekip üyeleri de dillerini Hesabım › Profilim'den seçer.
- **Unvan**: ofis sahibi Hesabım › Ekip ve davetler'de her danışmana unvan verir (`company_team_titles`, ekip tablolarıyla ilk kullanımda oluşur). Ekipten çıkarma aynı ekranda.
- Ofis sayfasındaki ilan kartlarında ilanı veren danışmanın adı, fotoğrafı ve unvanı görünür (`Listing.agent`).
- `/danismanlar` onaylı ofislerin aktif danışmanlarını da ofis adıyla listeler; telefonları "Telefonu göster" ile açılır.

Testler: `tests/company-office.test.mjs`, `tests/buyer-owner-tools.test.mjs`, `tests/company-team-route.test.mjs`.
