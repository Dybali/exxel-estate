# Mittwald'a taşıma planı

**Karar (2026-10-30, sahibi):** Geliştirme bitince site alan adıyla birlikte Mittwald dedicated server'a (mStudio, Node.js) taşınacak. O zamana kadar geliştirme ve test Cloudflare Workers'ta (`exxel-estate.estatemarket24.workers.dev`) sürer.

## Kurallar (şimdiden)

- Barındırma ortamını yalnızca `lib/runtime.ts` bilir. `cloudflare:workers` başka hiçbir dosyada import edilmez; ortam değişkenleri ve `waitUntil` oradan alınır.
- Yeni özellikler Cloudflare'e özel servislere (D1, R2 binding, Queues, KV, Durable Objects, Stream vb.) bağlanmaz. Veri Neon'a, dosyalar S3 uyumlu depoya (R2'nin S3 API'si `lib/external-r2.ts`) gider.
- Zamanlanmış işler bir HTTP uç noktası olarak yazılır, böylece Mittwald cronjob'u da çağırabilir.

## Bugün Cloudflare'e bağlı olanlar

| Parça | Bugün | Mittwald'da | İş |
|---|---|---|---|
| Çalışma ortamı | `vinext` ile Workers derlemesi, giriş `build/sites-worker.ts` | `next build` (`output: "standalone"`), `node server.js`; mStudio Node.js uygulaması veya konteyner | Orta |
| Ortam değişkenleri | `lib/runtime.ts` → `cloudflare:workers` | `lib/runtime.ts` → `process.env`, `waitUntil` → arka planda çalışan promise | Küçük, tek dosya |
| İstek sarmalayıcısı | `build/sites-worker.ts`: `?lang` başlıkları, 5xx kaydı | Next `middleware.ts` + `instrumentation.ts` | Küçük |
| D1 (`env.DB`) | İşlem sayaçları, çeviri ve mesaj çevirisi önbelleği (`lib/operations-runtime.ts`, `lib/translation-runtime.ts`, `app/api/messages`, `app/api/translations`, `app/api/admin/translations`, `app/api/assistant`) | Aynı tablolar Neon'da (`postgres/migrations/`) | Orta; veritabanı değişikliği, önce sahibine sorulur |
| Özel R2 (`env.BUCKET`, `exxel-estate-private`) | Belgeler, yedekler, tur kayıtları (`app/api/agent-verification`, `app/api/backup-storage`, `app/api/media/[...key]`, `lib/tour-capture.ts`) | Aynı kova S3 API ile (ayrı erişim anahtarı) veya Mittwald depolaması | Orta |
| Fotoğraflar (R2 S3 API) | `lib/external-r2.ts`, `R2_*` gizli ayarları | Değişmez, Mittwald'dan da çalışır | Yok |
| Cron (`wrangler.jsonc` `triggers`) | 06:00 UTC öne çıkarma bitişi + e-posta özeti, saat başı :07 sağlık kontrolü | mStudio cronjob → korumalı uç nokta (`CRON_SECRET`) | Küçük |
| Video (`lib/stream-server.ts`) | Cloudflare Stream (token yok, kapalı) | Sunucuda ffmpeg konteyneri: tus yükleme, MP4/H.264 dönüştürme, kapak; arayüz (`components/VideoUpload.tsx`) aynı kalır | Orta |
| Yayın | GitHub Actions → `wrangler deploy` | GitHub Actions → derle, Mittwald'a gönder (SSH/rsync veya konteyner imajı) | Küçük |

Değişmeyenler: Neon PostgreSQL (ilanlar, kullanıcılar, mesajlar), Neon Auth, Resend, DeepL, Gemini. Veri taşınmaz; yeni sunucu aynı veritabanına bağlanır.

## Taşıma günü

1. Mittwald'da proje ve Node.js uygulaması (veya konteyner) oluştur; bütün gizli ayarları ortam değişkeni olarak gir (`DATABASE_URL`, `R2_*`, `NEON_AUTH_*`, `GEMINI_API_KEY`, `DEEPL_API_KEY`, `RESEND_API_KEY`, `GOOGLE_CLIENT_*`, `EXXEL_ADMIN_EMAIL`, `BACKUP_READ_TOKEN`, `SITE_URL`).
2. Yukarıdaki tablodaki değişiklikleri bir dalda yap, `npm run verify` ve Mittwald'daki geçici adreste uçtan uca test et.
3. Alan adını Mittwald'a yönlendir, HTTPS sertifikası.
4. `SITE_URL`'i alan adına çevir; Neon Auth güvenilen adresleri, Google OAuth yönlendirme adresi, Resend alan adı doğrulaması (SPF/DKIM).
5. workers.dev adresini alan adına yönlendir, bir süre sonra Cloudflare Worker'ı kapat.
6. Eski Sites yayınını kapat; ortak gizli anahtarları (Neon şifresi, Gemini, DeepL, yedek token'ı) yenile.
