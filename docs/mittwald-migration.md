# Mittwald'a taşıma planı

**Karar (2026-10-30, sahibi):** Geliştirme bitince site alan adıyla birlikte Mittwald dedicated server'a (mStudio, Node.js) taşınacak. O zamana kadar geliştirme ve test Cloudflare Workers'ta (`exxel-estate.estatemarket24.workers.dev`) sürer.

**Kararlar (2026-11-03, sahibi):** Taşımaya şimdi başlanıyor, geliştirme sonra Mittwald'da sürer.
- Ana adres **estatemarket24.com**, test ortamı **test.estatemarket24.com**; exxelestate.com ana adrese yönlendirilir. Alan adları ve DNS Mittwald'da (proje `exxelestate`, proje alan adı `p-r9al26.project.space`).
- Site Mittwald'da **konteyner** olarak çalışır (Docker imajı GitHub Actions'ta üretilir); PostgreSQL de aynı projede konteyner.
- Fotoğraflar ve belgeler şimdilik **Cloudflare R2 (AB)**'de kalır; site S3 API ile bağlanır.
- İki ortam: `main`'e her push test ortamına gider; canlıya geçiş sahibinin onayıyla.

**Güncel durum (2026-11-03 akşam, sahibinin kararı):** Ayrı test ortamı yok; Mittwald ana çalışma yeri oldu.
- Site `https://p-r9al26.project.space` (geçici proje adresi) üzerinde konteyner `site` olarak çalışır, `SITE_URL` bu adres. Geliştirme bitince estatemarket24.com bağlanır.
- Veritabanı aynı stack'te `postgres` konteyneri (PostgreSQL 18, iç ağ, port 5432). Neon'un tam kopyası 2026-11-03'te alındı (68 tablo, satır sayıları aynı); kopya tek seferlik `db-copy` konteyneriyle (`postgres:18`, `pg_dump | psql`, ardından tablo bazında satır sayısı karşılaştırması) yapıldı ve konteyner silindi.
- `main`'e her push `mittwald.yml` ile imajı GHCR'ye (herkese açık paket) gönderir ve `site` konteynerini günceller (`MITTWALD_API_TOKEN` secret'ı, `MITTWALD_PROJECT_ID`/`MITTWALD_SERVICE_ID`/`MITTWALD_TEST_URL` değişkenleri).
- R2: `mittwald-site` token'ı (üç kovaya okuma/yazma).
- Giriş şimdilik Neon Auth'ta kalır (Better Auth'a geçişe kadar); Neon Auth güvenilen adreslerine geçici adres eklenmelidir.
- Cloudflare yayını ve eski Sites hâlâ Neon'a yazar; kapatılmaları ve son veri kopyası sıradaki iştir.

Aşamalar: 1) kodun Node/Docker'da da çalışması (Cloudflare yayını bozulmadan), 2) sahibinin mStudio kurulumu (PostgreSQL, uygulama konteyneri, test alt alan adı, API anahtarı), 3) GitHub Actions ile Mittwald test yayını + Neon verisinin kopyası, 4) Resend (estatemarket24.com) ve Neon Auth → Better Auth, 5) test ortamında uçtan uca deneme, 6) canlıya geçiş, anahtarların yenilenmesi, eski adreslerin kapatılması.

## Kurallar (şimdiden)

- Barındırma ortamını yalnızca `lib/runtime.ts` bilir. `cloudflare:workers` başka hiçbir dosyada import edilmez; ortam değişkenleri ve `waitUntil` oradan alınır.
- Yeni özellikler Cloudflare'e özel servislere (D1, R2 binding, Queues, KV, Durable Objects, Stream vb.) bağlanmaz. Veri Neon'a, dosyalar S3 uyumlu depoya (R2'nin S3 API'si `lib/external-r2.ts`) gider.
- Zamanlanmış işler bir HTTP uç noktası olarak yazılır, böylece Mittwald cronjob'u da çağırabilir.

## Bugün Cloudflare'e bağlı olanlar

| Parça | Bugün | Mittwald'da | İş |
|---|---|---|---|
| Çalışma ortamı | `vinext` ile Workers derlemesi, giriş `build/sites-worker.ts` | `next build` (`output: "standalone"`), `node server.js`; mStudio Node.js uygulaması veya konteyner | Orta |
| Ortam değişkenleri | `lib/runtime.ts` → `cloudflare:workers` | `lib/runtime.ts` → `process.env`, `waitUntil` → arka planda çalışan promise | Küçük, tek dosya |
| İstek sarmalayıcısı | `build/sites-worker.ts`: `?lang` başlıkları, 5xx kaydı | **Yapıldı:** `proxy.ts` (`?lang`, güvenlik başlıkları). 5xx sayacı Node'da henüz yok (`instrumentation.ts` `onRequestError`, sonraki adım) | Küçük |
| D1 (`env.DB`) | İşlem sayaçları, çeviri ve mesaj çevirisi önbelleği (`lib/operations-runtime.ts`, `lib/translation-runtime.ts`, `app/api/messages`, `app/api/translations`, `app/api/admin/translations`, `app/api/assistant`) | **Yapıldı:** ana veritabanında, ilk kullanımda oluşan tablolar (aşağıda) | — |
| Özel R2 (`env.BUCKET`, `exxel-estate-private`) | Belgeler, yedekler, tur kayıtları (`app/api/agent-verification`, `app/api/backup-storage`, `app/api/media/[...key]`, `lib/tour-capture.ts`) | **Yapıldı:** bağlama yoksa aynı kova S3 API ile (`lib/private-bucket.ts`) | — |
| Fotoğraflar (R2 S3 API) | `lib/external-r2.ts`, `R2_*` gizli ayarları | Değişmez, Mittwald'dan da çalışır | Yok |
| Cron (`wrangler.jsonc` `triggers`) | 06:00 UTC öne çıkarma bitişi + e-posta özeti, saat başı :07 sağlık kontrolü | **Yapıldı:** `/api/cron/health`, `/api/cron/daily` (`CRON_SECRET`); konteyner cronjob'u `node scripts/cron-call.mjs` | — |
| Video | Cloudflare Stream (token yok, kapalı; kod kaldırıldı) | **Yapıldı (2026-11-04):** kendi sistemimiz. Parçalı yükleme API üzerinden R2'ye (çok parçalı yükleme), konteyner içindeki işçi ffmpeg ile MP4 (H.264/AAC, en fazla 720p) + kapak üretir, HTML5 oynatıcı, Range destekli medya yolu; tablo `listing_videos` (019). Ayrıntı: [listing-videos.md](listing-videos.md). Cloudflare yayınında video kapalı | — |
| Yayın | GitHub Actions → `wrangler deploy` | **Yapıldı (test):** `.github/workflows/mittwald.yml` → GHCR imajı → test konteyneri | — |

Değişmeyenler: DeepL, Gemini.

**E-posta (2026-11-05, sahibinin kararı):** Şimdilik Mittwald posta kutusunun SMTP sunucusu üzerinden (`lib/email-smtp-node.ts`, nodemailer 10.2.1, yalnızca Node derlemesi; Cloudflare'de `@/lib/email-smtp` boş yuva). Resend ileride `RESEND_API_KEY` girilerek açılabilir, kod değişmez. SPF zaten `include:agenturserver.de` içeriyor; **mStudio'da alan adı için DKIM etkinleştirilmeli**. Kurulum ve test: [email-notifications.md](email-notifications.md) (yönetim paneli → Hizmet durumu → "Test e-postası gönder").

## Veritabanı ve giriş sistemi (sahibinin isteği, 2026-11-02)

Veritabanı da Mittwald'a alınacak. mStudio'da proje içinde **PostgreSQL konteyner şablonu** var (sürüm 18, Almanya'da, Mittwald yedeklemesi `backup.command` etiketiyle).

- **Zamanlama:** Konteyner veritabanı projenin iç ağında çalışır; site Cloudflare'deyken ona bağlanmak için veritabanını internete açmak gerekir, bu yapılmaz. Veritabanı, site Mittwald'a taşındığı gün aynı projeye kurulur ve site ile yan yana çalışır. O güne kadar Neon kalır.
- **Veri aktarımı:** Taşıma günü yazmayı durdur (bakım modu) → `pg_dump` (Neon) → `pg_restore` (Mittwald) → tablo/satır sayılarını karşılaştır → `DATABASE_URL`'i Mittwald'a çevir. Neon projesi bir süre salt okunur yedek olarak tutulur. Veritabanını değiştiren iş olduğu için her adım sahibine sorulur.
- **Bağlantı:** `lib/neon-d1.ts` Neon'un HTTP sürücüsünü kullanır; Mittwald'da standart PostgreSQL sürücüsüne (`pg`/`postgres`) geçilir, D1 benzeri arayüz aynı kalır. **Yapıldı:** `lib/postgres-driver-node.ts` (postgres.js 3.4.9); sorgu dönüştürme iki sürücüde ortak (`lib/pg-d1.ts`).
- **Giriş sistemi (en riskli kısım):** Kayıt, giriş ve e-posta kodları Neon Auth'ta. Neon Auth, açık kaynaklı **Better Auth** üzerine kurulu; taşımada Better Auth Mittwald'da kendimiz çalıştırılır, kullanıcı/oturum tabloları aynı PostgreSQL'e aktarılır. Önce bir deneme ortamında giriş, kayıt, şifre sıfırlama ve mevcut kullanıcıların girişi test edilir; e-posta kodları için Resend (alan adıyla) hazır olmalıdır.

## Taşıma günü

1. Mittwald'da proje ve Node.js uygulaması (veya konteyner) oluştur; bütün gizli ayarları ortam değişkeni olarak gir (`DATABASE_URL`, `R2_*`, `NEON_AUTH_*`, `GEMINI_API_KEY`, `DEEPL_API_KEY`, `SMTP_*` (veya `RESEND_API_KEY`), `GOOGLE_CLIENT_*`, `EXXEL_ADMIN_EMAIL`, `BACKUP_READ_TOKEN`, `SITE_URL`).
2. Yukarıdaki tablodaki değişiklikleri bir dalda yap, `npm run verify` ve Mittwald'daki geçici adreste uçtan uca test et.
3. Alan adını Mittwald'a yönlendir, HTTPS sertifikası.
4. `SITE_URL`'i alan adına çevir; Better Auth (Neon Auth yerine) güvenilen adresleri, Google OAuth yönlendirme adresi, Resend alan adı doğrulaması (SPF/DKIM).
5. workers.dev adresini alan adına yönlendir, bir süre sonra Cloudflare Worker'ı kapat.
6. Eski Sites yayınını kapat; sohbette görünen bütün anahtarları yenile: Mittwald PostgreSQL şifresi (`eyup-aydin`), Neon şifresi, Gemini, DeepL, `BACKUP_READ_TOKEN`; `NEON_AUTH_COOKIE_SECRET` ve `CRON_SECRET` da yeniden üretilir.

## Aşama 1: teslim edilenler (2026-11-03)

Cloudflare yayını aynen çalışmaya devam eder (`npm run verify`); aynı kod `EXXEL_NODE_BUILD=1 npx next build` ile Node'da da derlenir.

- **Node derlemesi:** `next.config.ts` yalnızca `EXXEL_NODE_BUILD=1` iken `output: "standalone"` ve iki takma ad ekler: `cloudflare:workers` → `lib/runtime-node.ts`, `@/lib/postgres-driver` → `lib/postgres-driver-node.ts`. Cloudflare (vinext) derlemesi `lib/postgres-driver.ts`'i görür; bu boş bir yuvadır, postgres.js Workers paketine hiç girmez (`tests/mittwald-runtime.test.mjs` denetler).
- **Veritabanı sürücüsü:** `lib/server.ts` `db()`: `DATABASE_URL` bir Neon adresiyse Neon HTTP sürücüsü (bugünkü gibi); Node derlemesinde başka bir sunucuysa (veya `DATABASE_DRIVER=postgres`) standart TCP sürücüsü. SQL dönüştürme (`?` → `$n`, `INSERT OR IGNORE`, `json_each`, sunum JSON'u, yayın süresi filtresi) ve toplu işlemlerin tek transaction olması iki sürücüde ortaktır (`lib/pg-d1.ts`).
- **D1 artık kullanılmıyor:** İşlem sayaçları, DeepL çeviri önbelleği ve kilitleri, çeviri kullanım sayaçları, asistan kotaları ana veritabanında (`serviceDB()` in `lib/server.ts`). İlk kullanımda oluşan tablolar (sahibinin onayıyla): `content_translations`, `translation_leases`, `translation_usage`, `translation_service_state`, `ai_usage_limits` (+ `ai_usage_expiry_idx` dizini), `ai_monthly_usage`, `operations_events`. Milisaniye zaman damgası sütunları PostgreSQL'de `BIGINT`. **Eski D1 verisi aktarılmadı:** çeviriler ilk istekte yeniden hazırlanır, sayaçlar sıfırdan başlar. D1 bağlaması `wrangler.jsonc`'ta yalnızca `DATABASE_URL` olmayan yerel geliştirme için kalır; `drizzle/` dosyalarına dokunulmadı, geçmiştir.
- **Özel kova:** `bucket()` Cloudflare'de R2 bağlamasını, başka yerde `lib/private-bucket.ts`'i (aynı `exxel-estate-private` kovası, S3 API, `aws4fetch`) kullanır. Kullanılan kısım: `get` (`onlyIf.etagMatches`), `head`, `put` (`httpMetadata.contentType`, `customMetadata`), `delete` (tek anahtar veya liste), `list` (`limit`, `cursor`, `prefix`). Kimlik bilgileri fotoğraflarla aynı `R2_*` ayarları; **R2 API token'ı `exxel-estate-private` kovasına da yetkilendirilmeli** (Cloudflare panosu → R2 → API token'ları → mevcut token'ı düzenle → kovalara `exxel-estate-private` ekle, izin "Object Read & Write"; menü adları Cloudflare arayüzüne göre küçük farklılık gösterebilir).
- **Zamanlanmış işler:** `lib/scheduled-jobs.ts` hem Cloudflare `scheduled()` hem `GET/POST /api/cron/health|daily` tarafından kullanılır. Uç nokta `Authorization: Bearer <CRON_SECRET>` ister; `CRON_SECRET` yoksa veya 32 karakterden kısaysa 404, yanlış anahtarda 401. Sağlık kontrolü başarısızsa 503, günlük işlerden biri başarısızsa 500 döner. Konteyner içinden çağırmak için `node scripts/cron-call.mjs health|daily`.
- **Canlılık:** `/api/health/live` veritabanına dokunmadan 200 döner (Docker `HEALTHCHECK`).
- **Docker + yayın:** `Dockerfile` (node:22.23.4-alpine3.23, çok aşamalı, `node` kullanıcısı, port 3000), `.github/workflows/mittwald.yml`: `main`'e her push → testler + tip kontrolü → `ghcr.io/dybali/exxel-estate:<commit>` ve `:main` → Mittwald test konteyneri güncellenir. Mittwald ayarları yokken yayın adımı uyarı yazıp başarılı biter. **Canlıya geçiş ayrı, elle başlatılan bir iş akışı olacak; henüz eklenmedi.**
- **Başlangıç migrasyonları (2026-11-04):** Mittwald veritabanı yalnızca iç ağda olduğu için `postgres/migrations` dosyaları sunucu açılışında uygulanır: `instrumentation.ts` → `runStartupMigrations` (`lib/postgres-driver-node.ts`, mantık `lib/postgres-migrations.ts`). Yalnızca Node derlemesinde ve TCP PostgreSQL sürücüsü seçiliyken çalışır; Cloudflare derlemesinde `lib/postgres-driver.ts` boş yuvadır (postgres.js ve çalıştırıcı Workers paketine girmez). `schema_migrations` tablosu (sürüm = dosya adı), `pg_advisory_lock`, her dosya kendi işleminde. **BASELINE 018:** 001–017 kopyalanan üretim verisinde zaten var, asla yeniden çalıştırılmaz. Dosya adı `NNN_kucuk_harf.sql` olmalı. Hata sunucuyu durdurmaz, günlüğe `[migrations]` ile yazılır. Dockerfile klasörü `/app/postgres/migrations`'a kopyalar.
- **Bireysel ilan kuralı (2026-11-04, sahibinin kararı):** bireysel üyeler (`role='individual'`) **45 günde 1 ilan** verebilir (önce 3 takvim ayı); yayın süresi 20 gün. Kod `lib/listing-policy.ts`, PostgreSQL tetikleyicisi `018_individual_listing_45_days.sql` (Mittwald'da açılışta otomatik uygulanır), D1/SQLite `drizzle/0025_individual_listing_45_days.sql`. **Neon'a uygulanmadı:** Cloudflare yayını kapanana kadar Neon'daki tetikleyici 3 ay kuralını uygular; gerekirse 018 sahibinin onayıyla Neon'a ayrıca uygulanmalı (`scripts/neon-migrate.mjs` dosyaları `;` ile böldüğü için `$$` fonksiyonunu bozar, bu dosya için uygun değil).
- **İlan videoları (2026-11-04, sahibinin kararı):** Cloudflare Stream yerine kendi sistemimiz (`docs/listing-videos.md`): en fazla 3 dakika ve 1 GB, ilan başına 1 video. `instrumentation.ts` migrasyonlardan sonra ffmpeg işçisini başlatır (`@/lib/video-worker` yuvası, Cloudflare'de boş); `Dockerfile` ffmpeg kurar. Yeni tablo `listing_videos`: `019_listing_videos.sql` (açılışta otomatik), `drizzle/0026_listing_videos.sql`; Neon'a uygulanmadı.
- Node'da henüz olmayanlar: 5xx sayacı (`operations_events` `http`), Neon Auth → Better Auth (Aşama 4).

## Konteyner ortam değişkenleri

Hepsi mStudio'da konteynerin ortam değişkenleri olarak girilir; imaja ve repoya hiçbiri yazılmaz.

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | Evet | Test: `postgres://KULLANICI:ŞİFRE@<postgres-konteyner-adı>:5432/VERİTABANI` (aynı projenin iç ağı). Aşama 3'e kadar Neon adresi de olabilir. |
| `DATABASE_DRIVER` | Hayır | `postgres` (TCP) veya `neon` (HTTP). Boşsa: Neon adresi → `neon`, diğerleri → `postgres`. |
| `DATABASE_POOL_MAX` | Hayır | TCP bağlantı havuzu, varsayılan 10 (1–50). |
| `R2_ENDPOINT` | Evet | `https://<hesap>.eu.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME` | Evet | `exxel-estate-images` (ilan fotoğrafları) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Evet | İki kovaya da yetkili R2 token'ı |
| `R2_PRIVATE_BUCKET_NAME` | Hayır | Varsayılan `exxel-estate-private` |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | Evet (Better Auth'a kadar) | Neon Auth; güvenilen adreslere test alan adı eklenmeli |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google girişi için | Yönlendirme adresi test alan adıyla |
| `GEMINI_API_KEY` (+ isteğe bağlı `GEMINI_MODEL`, `AI_DAILY_CALL_LIMIT`, `AI_MONTHLY_CALL_LIMIT`) | Asistan için | |
| `DEEPL_API_KEY` (+ `DEEPL_DAILY_CHAR_LIMIT`, `DEEPL_MONTHLY_CHAR_LIMIT`) | Çeviri için | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | E-posta için (şu anki yol) | Mittwald posta kutusu: `mail.agenturserver.de`, `465` (doğrudan TLS; `587` = STARTTLS zorunlu), kullanıcı `noreply@estatemarket24.com`, şifre gizli. Bkz. [email-notifications.md](email-notifications.md) |
| `EMAIL_FROM` | E-posta için | `EstateMarket24 <noreply@estatemarket24.com>`. Mittwald yalnızca posta kutusunun adresiyle gönderir: adres `SMTP_USER`dan farklıysa kod `SMTP_USER` adresini kullanır, görünen adı korur |
| `EMAIL_REPLY_TO` | Hayır | Boşsa `CONTACT_EMAIL` |
| `RESEND_API_KEY` | Hayır | Girilirse SMTP yerine Resend kullanılır (alan adı Resend'de doğrulanmış olmalı) |
| `CONTACT_EMAIL` | Evet | `info@estatemarket24.com` |
| `EXXEL_ADMIN_EMAIL` | Evet | Yönetici hesabı |
| `ADMIN_TOTP_KEY` | Evet | Yönetici iki adımlı girişi (Cloudflare'dekiyle aynı değer olmalı) |
| `SITE_URL` | Evet | Test: `https://test.estatemarket24.com`, canlı: `https://estatemarket24.com` |
| `CRON_SECRET` | Evet | En az 32 karakter rastgele (ör. `openssl rand -hex 32`) |
| `ALERT_EMAIL` | Hayır | Sağlık uyarıları; yoksa `EXXEL_ADMIN_EMAIL` |
| `BACKUP_READ_TOKEN` | Yedek okuma için | En az 48 karakter |
| `BACKUP_ENCRYPTION_KEY` | Evet | Günlük şifreli veritabanı yedeği (R2 `estatemarket24-backups/mittwald-db/`): 32 rastgele bayt, base64 (`openssl rand -base64 32`). Ayrıca güvenli yerde saklanmalı. Bkz. [backups-monitoring.md](backups-monitoring.md) |
| `R2_BACKUP_BUCKET`, `BACKUP_MIN_TABLES`, `PG_BIN_DIR` | Hayır | Yedek kovası (varsayılan `estatemarket24-backups`), en az tablo sayısı (30), `pg_dump` klasörü (`/usr/libexec/postgresql18`) |
| `GA_MEASUREMENT_ID`, `GOOGLE_SITE_VERIFICATION` | Hayır | Test ortamında boş bırakılması önerilir |
| `SMS_PROVIDER`, `PHONE_CODE_SECRET` | Telefon doğrulaması için | |
| `CAPTURE_WORKER_TOKEN`, `CAPTURE_WORKER_MODE` | Tur yakalama için | |
| `VIDEO_WORKER` | Hayır | `0` ilan videosu işçisini (ffmpeg) ve video yüklemeyi kapatır; boşsa açık. Bkz. [listing-videos.md](listing-videos.md) |
| `SERVICE_SAMPLES` | Hayır | Hizmetler bölümündeki örnek firmalar (`lib/service-samples.ts`, yalnızca kodda; "Örnek firma" etiketli, sayılmaz, indekslenmez, site haritasına girmez). Boşsa açık; lansmanda `0` yapın. Cloudflare'de `wrangler.jsonc` → `vars` içine `"SERVICE_SAMPLES": "0"` |
| `NODE_OPTIONS` | Hayır | Ör. `--max-old-space-size=768` (konteyner belleğine göre) |
| `PORT`, `HOSTNAME`, `NODE_ENV` | — | İmajda hazır: `3000`, `0.0.0.0`, `production`; değiştirmeyin |

Cloudflare Stream (`STREAM_API_TOKEN`) artık kullanılmıyor; videolar konteynerde ffmpeg ile işlenir ve R2'de durur (aynı `R2_*` ayarları, `mittwald-site` token'ı üç kovaya da yetkili).

## Aşama 2: mStudio kontrol listesi (sahibi)

Menü adları mittwald geliştirici belgelerinden (developer.mittwald.de, 2026-11) alındı; *(doğrulanmadı)* işaretliler belgede bulunamadı, arayüzde en yakın menüde yapın.

1. **PostgreSQL (test):** Proje `exxelestate` → kenar menüde **Containers** → **Create Container** → PostgreSQL şablonu (sürüm 18). Kullanıcı adı, veritabanı adı (ör. `estatemarket24_test`) ve en az 32 karakter rastgele şifre verin. **Port yayınlamayın, alan adı bağlamayın** (yalnızca proje içi ağ). Konteyner adını not edin: aynı projedeki konteynerler birbirine bu adla ulaşır ("My container" → `my-container`).
2. **İmaja erişim (önerilen: paketi herkese açık yapmak):** GitHub → profil → Packages → `exxel-estate` → Package settings → Change visibility → Public. İmajda gizli değer yoktur (hepsi çalışma anında ortam değişkeni); repo private kalır. Paket private kalacaksa: GitHub'da yalnızca `read:packages` yetkili bir token oluşturun, mStudio'da **Containers** → **Registries** sekmesi → **Add registry** (adres `ghcr.io`, kullanıcı `Dybali`, şifre bu token). İlk imaj, bu değişiklikler `main`'e push'landıktan sonra GitHub Actions'ta oluşur.
3. **Uygulama konteyneri:** **Containers** → **Create Container** → imaj `ghcr.io/dybali/exxel-estate:main`, ad ör. `site`, port `3000/tcp`. Ortam değişkenlerini yukarıdaki tablodan girin (`DATABASE_URL` içindeki sunucu adı 1. adımdaki konteyner adı). Bellek en az 1 GB önerilir.
4. **Alt alan adı:** Kenar menü **Domains** → **Add** → **Subdomain** → `test.estatemarket24.com`, hedef 3. adımdaki konteyner, port `3000` → **Create**. SSL sertifikası *(otomatik Let's Encrypt olduğu doğrulanmadı)*. Deneme: `https://test.estatemarket24.com/api/health/live` → `{"ok":true}`.
5. **Cronjob'lar:** mittwald'da URL cronjob'ları başlık (Authorization) gönderemez ve konteynere bağlı cronjob'lar URL değil komut çalıştırır; bu yüzden **konteyner cronjob'u** kullanılır. Saat dilimi varsayılan UTC.
   - Sağlık, saatte bir: zamanlama `7 * * * *`, konteyner `site`, komut `node scripts/cron-call.mjs health`
   - Günlük: zamanlama `0 6 * * *`, aynı konteyner, komut `node scripts/cron-call.mjs daily` (şifreli veritabanı dış yedeği de bu işin içinde; elle: `node /app/scripts/cron-call.mjs backup`, bkz. [backups-monitoring.md](backups-monitoring.md))
   - CLI karşılığı: `mw cronjob create --description "estatemarket24 health" --interval "7 * * * *" --container-id <konteyner-id> --command "node scripts/cron-call.mjs health"` *(mStudio'daki cronjob menüsünün yeri ve komutun konteyner ortam değişkenlerini görüp görmediği doğrulanmadı; ilk çalıştırma kaydında `cron health: 200` görünmeli, `CRON_SECRET is not set` görünürse bana bildirin)*.
6. **API token:** mStudio → profil ayarları → API token'ları → yeni token, yazma yetkili *(menü adı doğrulanmadı)*.
7. **GitHub ayarları:** Repo → Settings → Secrets and variables → Actions:
   - Secret `MITTWALD_API_TOKEN` (6. adım; CLI bu değişkeni okur)
   - Variables: `MITTWALD_PROJECT_ID` (ör. `p-r9al26`), `MITTWALD_SERVICE_ID` (uygulama konteynerinin kimliği; `mw container list -p <proje> -o txt` ile görülür), isteğe bağlı `MITTWALD_TEST_URL` = `https://test.estatemarket24.com` (yayından sonra canlılık kontrolü).
   - Bunlar girilene kadar `mittwald.yml` yalnızca imajı üretir, yayın adımını uyarıyla atlar.
8. Sonraki push'ta iş akışı `mw container update <MITTWALD_SERVICE_ID> --project-id <MITTWALD_PROJECT_ID> --image ghcr.io/dybali/exxel-estate:<commit> --recreate --quiet` çalıştırır (`@mittwald/cli` 1.26.0).

Aşama 3 (Neon verisinin test veritabanına kopyası) veritabanı işidir; her adım ayrıca sahibine sorulur.
