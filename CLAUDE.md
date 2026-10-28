# Exxel Estate / EstateMarket24

Türkiye'deki satılık ve kiralık gayrimenkuller için çok dilli (TR, DE, FR, EN, AR, RU) ilan platformu. Ayrıntılar: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), `docs/`.

## Geçmiş

- Proje ChatGPT Sites üzerinde geliştirildi; commit mesajları otomatik ("Update Site source").
- Güncel çalışma `estatemarket24-guncel-2026-10-28` branch'inde. `main` ile **ortak geçmişi yok** (bağımsız iki kopya), birleştirme yapma.
- Canlı site hâlâ ChatGPT Sites'ta (`.openai/hosting.json`). `apps/web` (Vercel) + `apps/api` (NestJS/Render) planlanmış ama yarım kalmış bir geçiş.

## Yapı

- Kök uygulama: Next.js 16 / React 19, Cloudflare Workers üzerinde `vinext` ile derlenir. Sayfalar `app/`, API'ler `app/api/`, bileşenler `components/`, iş mantığı `lib/`.
- Veri: Neon PostgreSQL (asıl depo), Cloudflare R2 (fotoğraflar). `lib/neon-d1.ts` eski D1 arayüzünü Neon'a bağlar.
- Migrasyonlar iki yerde tutulur ve senkron kalmalı: `postgres/migrations/` (Neon) ve `drizzle/` (D1/SQLite). `.sql` dosyaları LF satır sonu ister (`.gitattributes`).
- Çeviriler `lib/i18n.tsx` ve `lib/*-translations.ts` dosyalarında. Yeni metin eklerken 6 dilin hepsini doldur; makine çevirisi otomatik yapılmaz.
- `lib/messaging-service.ts` birebir `apps/api/src/shared/` altına kopyalanır; birini değiştirirsen diğerini de güncelle.
- `apps/` ayrı bir workspace'tir ve kök doğrulamaya dahil değildir.

## Komutlar

- Kurulum: `npm run install:ci` (Node 22.13+; yerelde Node 24 kullanılıyor)
- Geliştirme sunucusu: `npm run dev` (port 5173)
- Tam doğrulama: `npm run verify`: testler (`tests/*.test.mjs`, `node --test`), `tsc -p tsconfig.site.json`, production build. Değişiklikten sonra mutlaka çalıştır.
- Sadece testler: `npm test`
- Windows'ta yeniden build almadan önce açık Worker süreçlerini durdur (`dist/` kilitlenebilir).

## Kurallar

- Gizli değerler (Neon, R2, Google OAuth, Gemini, Neon Auth) asla repoya, istemci koduna veya `hosting.json`'a yazılmaz. Repo private kalmalı.
- Yerel HTTP testleri production verisine dokunmaz; bkz. [docs/release-verification.md](docs/release-verification.md).
- Örnek/demo ilan ve şirketler (`source: "demo"`, `sample: true`) arayüzde her zaman açıkça etiketlenir; gerçek sayımlara dahil edilmez.
