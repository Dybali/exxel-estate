# İlan fotoğraflarının korunması (2026-11-16)

Sahibinin isteği: fotoğrafların çalınmasını zorlaştırmak ve çalınan fotoğrafın kaynağını belli etmek. Hiçbir yöntem ekran görüntüsünü engelleyemez; filigran bu yüzden asıl önlemdir.

- **Filigran** (`lib/photo-watermark-svg.ts`): sağ alt köşede "estatemarket24" ve ortadan çapraz geçen, büyük ve çok saydam (%16) bir işaret; kırpılarak silinemez.
  - **Mittwald (Node)**: sunucu her ilan fotoğrafını kendisi işaretler (`lib/photo-watermark-node.ts`, sharp; `next.config.ts` takma adı `@/lib/photo-watermark`). Tarayıcı `GET /api/media` ile bunu öğrenir ve fotoğrafı işaretsiz gönderir; 640/1280 WebP kopyaları da sunucu üretir. Hangi yoldan (site, XML, toplu yükleme) gelirse gelsin atlanamaz. Konteynerde yazı tipi gerekir: Dockerfile `ttf-liberation fontconfig`.
  - **Cloudflare**: sunucuda resim kütüphanesi yok; işareti tarayıcı çizer (`lib/photo-optimize.ts`).
  - Profil, hizmet firması, müteahhit ve 360° fotoğrafları işaretlenmez.
- **Sağ tık / sürükleme / basılı tutma** (`components/PhotoGuard.tsx`, `app/polish.css`): `/api/media/` fotoğraflarında kapalı.
- **Hotlink** (`app/api/media/[...key]/route.ts`): başka bir sitenin sayfasına gömülen fotoğraf isteği (Sec-Fetch-Site cross-site, Referer başka alan adı) 403 alır. Arama motorları, bağlantı önizlemeleri ve Referer göndermeyen istekler (web posta) etkilenmez.
- **Çalıntı fotoğraf tespiti**: dHash parmak izleri (`docs/listing-risk.md`).
- Testler: `tests/photo-protection.test.mjs`, `tests/photo-optimize.test.mjs`.
