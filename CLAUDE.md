# Exxel Estate / EstateMarket24

Türkiye'deki satılık ve kiralık gayrimenkuller için çok dilli (TR, DE, FR, EN, AR, FA, RU, NL, ES, IT) ilan platformu. Ayrıntılar: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), `docs/`.

## Geçmiş

- Proje ChatGPT Sites üzerinde geliştirildi; commit mesajları otomatik ("Update Site source").
- Geliştirme `main` üzerinden yapılır. Eski Sites geçmişleri `archive/main-before-cloudflare` ve `archive/sites-2026-10-28` branch'lerinde saklıdır; bunlara commit atılmaz.
- Barındırma: yalnızca **Mittwald** (sahibinin kararı, 2026-11-23): konteyner `site`, şimdilik `https://p-r9al26.project.space`, alan adı geçişi [docs/mittwald-migration.md](docs/mittwald-migration.md). Cloudflare Worker yayını ve Cloudflare derlemesi (`vinext`, `wrangler`, `build/sites-worker.ts`) koddan kaldırıldı; eski Sites yayını kapalı. Cloudflare'den yalnızca R2 (dosyalar, S3 API ile) şimdilik kullanılır.
- **Neon kullanılmıyor** (sahibinin kararı, 2026-11-23): asıl veritabanı Mittwald'daki `postgres` konteyneri (PostgreSQL 18). Neon'un son hâli yalnızca yedek olarak saklanır; koda Neon sürücüsü, paketi veya betiği geri eklenmez. Yayın canlı veriyi kullanır: site gerçek kullanıcılara açıktır.
- Yeni özellikler Cloudflare'e özel servislere (D1, R2 binding, KV, Queues, Stream vb.) bağlanmaz; veri Mittwald PostgreSQL'e, dosyalar S3 uyumlu depoya gider. Ortam ayarları `lib/runtime.ts` (`process.env`) üzerinden okunur.
- `apps/web` (Vercel) + `apps/api` (NestJS/Render) eski, yarım kalmış bir geçiş planıdır; kullanılmıyor.

## Yapı

- Kök uygulama: Next.js 16 / React 19, standart Next.js derlemesi (`output: "standalone"`, Docker imajı). Sayfalar `app/`, API'ler `app/api/`, bileşenler `components/`, iş mantığı `lib/`. Yalnızca Node'da çalışan parçalar `next.config.ts` takma adlarıyla bağlanır (`@/lib/postgres-driver` → `-node.ts` vb.).
- Veri: Mittwald PostgreSQL (asıl depo, `lib/postgres-driver-node.ts` TCP sürücüsü, `lib/pg-d1.ts` eski D1 arayüzünü PostgreSQL'e uyarlar), Cloudflare R2 (fotoğraflar, belgeler, yedekler; S3 API ile, şimdilik).
- Migrasyonlar iki yerde tutulur ve senkron kalmalı: `postgres/migrations/` (PostgreSQL, sunucu açılışında uygulanır) ve `drizzle/` (SQLite: testler ve yerel geliştirme veritabanı `.data/dev.sqlite`, `lib/dev-database.ts`). `.sql` dosyaları LF satır sonu ister (`.gitattributes`).
- Çeviri sözlüğü `lib/i18n-dictionary.ts` (sunucu ve tarayıcı ortak; `lib/i18n.tsx` sadece React tarafı). Eski metinler `lib/*-translations.ts` ve `data/*.json`, Farsça `data/fa-translations.json`, Hollandaca `data/nl-translations.json`, İspanyolca `data/es-translations.json`, İtalyanca `data/it-translations.json` (hepsi eksik anahtarda İngilizceye düşer; es/it 2026-11-23 sitenin çeviri modeliyle İngilizceden üretildi, testi `tests/spanish-italian.test.mjs`); **yeni metinler `lib/portal-translations.ts`** içine 6 dilin hepsiyle eklenir. `tests/localization.test.mjs` eksikleri yakalar. İlan metni sitenin herhangi bir dilinde yazılabilir (`presentation.language`, `lib/listing-language.ts`); diğer dillere, Türkçe dahil, OpenAI GPT-6 Luna ile (anahtar yoksa Gemini) bir kez çevrilir: yayınlanan/düzenlenen ilan o gece toplu modda bütün dillere, ondan önce açılan dil istenince (`docs/translations.md`). Arapça ve Farsça sağdan sola (`isRtl`).
- Dil: sayfa dili sunucuda seçilir (`lib/locale-negotiation.ts`, `proxy.ts` → `lib/request-context.ts`): önce `?lang=xx`, sonra ziyaretçinin kayıtlı seçimi (`em24_locale` çerezi), sonra tarayıcı dili, yoksa Türkçe; tarayıcı (`lib/i18n.tsx`) sunucunun seçtiği dili korur, yalnızca `?lang` veya kayıtlı seçim değiştirir (sayfa açıldıktan sonra dil değişmez). sayfa başlıkları `lib/seo-copy.ts`, kanonik/hreflang kök layout'ta. Adresler `SITE_URL` (wrangler vars) ile üretilir.
- Stil: sayfa stilleri `app/*.css` içinde katmanlıdır; diğer dosyaların üstüne gelen ince ayarlar (mobil üst bölüm, ilan sayfası galerisi ve sabit iletişim çubuğu, en küçük yazı boyutları) en son yüklenen `app/polish.css` içindedir.
- Yeni tablolar ilk kullanımda `CREATE TABLE IF NOT EXISTS` ile oluşur (ör. `lib/leads.ts`, `lib/orders.ts`, `lib/email-notifications.ts`); sorgular hem PostgreSQL hem SQLite'ta çalışmalı, testler `node:sqlite` ile yazılır.
- Zamanlanmış işler Mittwald cronjob'larıdır (`scripts/cron-call.mjs` → `/api/cron/health|daily|backup`): saat başı sağlık kontrolü, 06:00 UTC öne çıkarma bitişi, e-posta özeti ve yedek.
- Özellik belgeleri: `docs/xml-import.md`, `docs/email-notifications.md`, `docs/payments.md`, `docs/backups-monitoring.md`, `docs/auth.md` (giriş, e-posta kodları, Google girişi), `docs/listing-risk.md` (sahte/tekrar ilan tespiti), `docs/nl-search.md` (doğal dil araması), `docs/listing-map.md` (harita ve mahalle bilgisi), `docs/listing-currency.md` (TL esas fiyat, TCMB kuru ile görüntüleme), `docs/services.md` (Hizmetler: firmalar, çalışma bilgileri, belgeler, istatistikler, teklif iste), `docs/contractors.md` (Müteahhitler: firma profilleri, tamamlanan projeler, yetki belgesi doğrulaması, kat karşılığı talepleri), `docs/buyer-tools.md` (hesaplama araçları, fiyatı düşenler, Benim için bul ve emlakçılar için açık Talep akışı, `LEAD_PLANS`, konut değerleme, sezonluk kiralık, danışmanlar), `docs/listing-commission.md` (ilanlarda hizmet bedeli/komisyon, yasal sınırlar, Komisyonsuz filtresi), `docs/market-stats.md` (Emlak piyasası: TCMB il il m² fiyat, kira, getiri haritası; `EVDS_API_KEY`), `docs/firm-plans.md` (hizmet firması ve müteahhit paketleri: Ücretsiz/Plus/Pro, teklif başı ücret yok, firma mesajlaşması; sınırlar `FIRM_PLANS=1` ile açılır), `docs/listing-videos.md` (kendi sunucumuzda: R2 + konteynerde ffmpeg, yalnızca Mittwald), `docs/translations.md` (OpenAI Luna çevirisi, önbellek, bot koruması, ilanların gece toplu çevirisi), `docs/ai-limits.md` (yapay zekâ kotaları ve maliyet ekranı), `docs/crm.md` (Hesabım › CRM: ilan istatistikleri, satış hunisi, öneriler), `docs/photo-protection.md` (filigran: Mittwald'da sunucuda sharp ile; sağ tık ve hotlink engeli), `docs/pre-registration.md` (30 büyükşehir için Google Ads ön kayıt sayfaları: ayrı statik site, kayıtlar `POST /api/on-kayit` → `pre_registrations`, Yönetim › Ön kayıtlar), `docs/ui-help.md` (sayfa içi yardım: Hesabım başlangıç listesi, tek seferlik ipuçları, "?" açıklamaları), `docs/live-messaging.md` (anlık mesajlaşma: SSE akışı, yazıyor göstergesi, yedek kontrol), `docs/security-checklist.md` (sahibinin elle yapacağı güvenlik adımları: gizli anahtar yenileme, yönetici 2FA, SMS ve GA4 ayarları).
- Hesap türleri: Bireysel, Emlakçı, Müteahhit, Hizmet firması; bir hesap tek türdür ve her türün kendi Hesabım menüsü vardır (`lib/account-kind.ts`, `lib/account-panel.ts`). Müteahhit/hizmet türü `account_kinds` tablosunda; `users.role` CHECK'i yüzünden rol sütununa yazılmaz.
- `lib/messaging-service.ts` birebir `apps/api/src/shared/` altına kopyalanır; birini değiştirirsen diğerini de güncelle.
- `apps/` ayrı bir workspace'tir ve kök doğrulamaya dahil değildir.

## Komutlar

- Kurulum: `npm run install:ci` (`npm ci`; Node 22.13+; yerelde Node 24 kullanılıyor)
- Geliştirme sunucusu: `npm run dev` (port 5173; `DATABASE_URL` yoksa yerel SQLite `.data/dev.sqlite`, production verisine dokunmaz)
- Tam doğrulama: `npm run verify`: testler (`tests/*.test.mjs`, `node --test`), `tsc -p tsconfig.site.json`, production build. Değişiklikten sonra mutlaka çalıştır.
- Sadece testler: `npm test`
- Yayın: `main`'e push yeterli; yalnızca Mittwald'a gider (bkz. Çalışma düzeni).
- Windows'ta yeniden build almadan önce açık `next dev` süreçlerini durdur (`.next/` kilitlenebilir).

## Çalışma düzeni (birden fazla cihaz)

Sahibi aynı repoda iş bilgisayarından, ev bilgisayarından ve telefondan (Claude Code bulut oturumu) çalışır. Karışıklık olmaması için:

- **Tek yayın yolu GitHub Actions'tır ve yalnızca Mittwald'a yayınlar** (sahibinin kararı, 2026-11-23). `main`'e push edilince `mittwald.yml` testleri çalıştırır, Docker imajını kurar ve Mittwald konteynerini (`https://p-r9al26.project.space`) yeni imajla yeniden oluşturur; `verify-site.yml` yalnızca `npm run verify` yapar. Zamanlanmış işler Mittwald cronjob'larıyla çalışır.
- **İşe başlamadan önce `git pull origin main`.** Push'tan önce de tekrar çek; reddedilen push'ta `git pull --rebase` (veya merge) yapılır, asla force-push yapılmaz.
- Değişiklikler küçük, kendi içinde tamam commit'ler halinde ve iş bitince hemen push'lanır; yarım iş bir cihazda push'lanmadan bırakılmaz.
- Yayından sonra GitHub Actions sonucu kontrol edilir; kırmızıysa düzeltilir. Geri alma: hatalı commit `git revert` ile geri alınıp push'lanır.
- Veritabanını değiştiren işler (migrasyon, toplu güncelleme, silme) önce sahibine sorulur.

## Kurallar

- Gizli değerler (Mittwald PostgreSQL, R2, SMTP, Google OAuth, Gemini, OpenAI, DeepL, TCMB EVDS, EMAIL_CODE_SECRET) asla repoya, istemci koduna veya `hosting.json`'a yazılmaz. Repo private kalmalı.
- Yerel HTTP testleri production verisine dokunmaz; bkz. [docs/release-verification.md](docs/release-verification.md).
- Örnek/demo ilan ve şirketler (`source: "demo"`, `sample: true`) arayüzde her zaman açıkça etiketlenir; gerçek sayımlara dahil edilmez.
