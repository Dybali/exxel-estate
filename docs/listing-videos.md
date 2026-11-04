# İlan videoları (kendi sunucumuzda)

İlan veren, ilan verme ve düzenleme formundan video yükler. Dosya parça parça bizim API'mize, oradan Cloudflare R2'ye gider; Mittwald konteynerindeki arka plan işçisi ffmpeg ile videoyu her cihazda oynayan bir MP4'e ve bir kapak görseline dönüştürür. İlan sayfasında tarayıcının kendi video oynatıcısı (HTML5 `<video>`) gösterilir. Cloudflare Stream kullanılmaz; eski Stream kodu kaldırıldı.

Video yalnızca **Mittwald konteynerinde** (Node derlemesi, kendi PostgreSQL'i, ffmpeg) çalışır. Cloudflare yayınında form "Video yükleme şu anda kullanılamıyor." der; sitenin geri kalanı etkilenmez.

## Sınırlar

- İlan oluşturabilen her üye (bireysel, emlak ofisi, yönetici) yükleyebilir. İlan başına **1 yüklenmiş video**; YouTube/Vimeo bağlantısı ayrıca eklenebilir (değişmedi).
- En fazla **3 dakika** (`MAX_VIDEO_SECONDS = 180`) ve **1 GB** (`MAX_VIDEO_BYTES`), `lib/listing-video.ts`. Süreyi tarayıcı önceden kontrol eder; asıl karar yüklemeden sonra **ffprobe**'undur, daha uzun video reddedilir.
- Kabul edilen biçimler ilk baytlardan tanınır: MP4/MOV/M4V/3GP, WEBM/MKV, AVI. ffprobe görüntü akışı bulamazsa video reddedilir.
- Bir üyenin ilana bağlanmamış en fazla 5 yüklemesi olabilir; istek sınırları 15 dakikada 10 yükleme başlatma ve 400 parça (`auth_limits`).

## Akış

1. **Başlat:** `POST /api/video-upload` `{size,type}` → `listing_videos` satırı (`status='uploading'`) ve özel kovada R2 çok parçalı yüklemesi (`CreateMultipartUpload`), anahtar `video-uploads/<üye>/<video-id>`.
2. **Parçalar:** Tarayıcı dosyayı 16 MiB parçalarla gönderir (`PUT /api/video-upload?id=&part=N`, `components/VideoUpload.tsx`). Sunucu her parçayı belleğe almadan, tam `Content-Length` ile R2'ye `UploadPart` olarak aktarır. İlk parçada dosya türü baytlardan kontrol edilir. Ağ hatasında parça birkaç kez yeniden denenir; yine olmazsa form "Devam et" düğmesi gösterir ve yüklenmiş parçaları atlayarak (`GET ?id=&parts=1`) kaldığı yerden sürer. "İptal" yüklemeyi R2'de iptal eder ve satırı siler.
3. **Tamamla:** `PATCH /api/video-upload` `{id,action:"complete"}` → parçalar R2'den listelenir (eksik varsa 409 ve eksik parça numaraları), `CompleteMultipartUpload`, `status='queued'`, işçi hemen uyandırılır.
4. **İşleme (işçi):** `lib/video-worker-node.ts` her seferinde bir iş alır. İş tek bir `UPDATE … RETURNING` ile kilitlenir (`lib/listing-video-store.ts`), aynı video iki kez işlenmez. Ham dosya `os.tmpdir()` altındaki geçici klasöre indirilir, ffprobe süreyi ve görüntüyü kontrol eder, ffmpeg (`-threads 2`, düşük öncelik) dönüştürür, kapak çıkarılır; MP4 ve kapak fotoğraf kovasına `videos/<id>/video.mp4` ve `videos/<id>/poster.jpg` olarak yüklenir, ham dosya silinir, satır `ready` olur. Geçici klasör her durumda silinir.
5. **Durum:** Form `GET /api/video-upload?id=` ile yoklar: *yükleniyor* (ilerleme çubuğu) → *işleniyor* → *hazır* (kapaklı önizleme) veya *hata* (okunabilir mesaj). İlan video işlenirken de kaydedilebilir; video hazır olunca ilanda görünür.
6. **İlana bağlama:** İlan kaydedilince (`app/api/listings`, `app/api/listings/[id]`) video kimliği `listing.presentation.videoId` içine yazılır; videonun sahibinin ilan sahibi olması, yüklemenin bitmiş ve başarısız olmamış olması kontrol edilir. `listing_videos.listing_id` aynı toplu işlemde doldurulur.
7. **Silme:** Video değiştirilir, kaldırılır ya da ilan silinirse eski videonun R2 dosyaları (ham, MP4, kapak) ve satırı silinir (fotoğraflardaki gibi). İlana bağlanmamış yüklemeler formdan "Videoyu kaldır" ile hemen silinir.
8. **Temizlik:** Günlük iş (`lib/scheduled-jobs.ts`, 06:00 UTC, `/api/cron/daily`) **2 günden eski** ilana bağlanmamış yüklemeleri ve başarısız işleri dosyalarıyla siler; başarısız video ilanın sunumundan da çıkarılır.

## Oynatma

- `/api/media/videos/<id>/video.mp4` ve `/poster.jpg` (`app/api/media/[...key]/route.ts`): video yayındaki bir ilana bağlıysa herkese açık ve uzun süre önbelleklenir; değilse yalnızca sahibine ve yöneticiye.
- **HTTP Range** desteklenir: tek aralıklı istekler R2'ye iletilir, yanıt `206`, `Accept-Ranges: bytes`, `Content-Range`. iPhone Safari'de oynatma ve ileri sarma bunu gerektirir.
- İlan sayfası videoyu yalnızca `ready` ise gösterir (sunucuda kontrol). Oynatıcı: `controls`, `playsinline`, `preload="metadata"`, kapak görseli; dikey videolar ekran yüksekliğini aşmaz.

## Dönüştürme ayarları (`lib/video-transcode.ts`)

- MP4, H.264 High (seviye 4.0) + AAC 128 kbit/s stereo, `-movflags +faststart` (oynatma dosyanın tamamı inmeden başlar).
- Boyut: yatay en fazla 1280×720, dikey en fazla 720×1280; küçük videolar büyütülmez. En fazla 30 kare/sn, `yuv420p`.
- Kalite: CRF 23, üst sınır 3 Mbit/s (`-maxrate 3M -bufsize 6M`), `-preset fast`.
- Telefonların konum (GPS) ve diğer üst verileri silinir (`-map_metadata -1`).
- Kapak: ilk saniyeden (kısa videoda süresinin dörtte biri) bir JPEG.
- Bir iş en fazla 20 dakika sürebilir; kilit 30 dakika. Geçici hatalarda (R2, ağ, süre aşımı) iş 5 dakika sonra yeniden denenir, en fazla 3 deneme. Dosya kaynaklı hatalar (video değil, 3 dakikadan uzun, ffmpeg başarısız) hemen "hata" olur.

## Veritabanı

`listing_videos` tablosu (sahibinin onayıyla): `postgres/migrations/019_listing_videos.sql` (Mittwald'da açılışta otomatik uygulanır), SQLite/D1 için `drizzle/0026_listing_videos.sql`. Sütunlar: `id`, `owner_id`, `listing_id` (ilan silinince NULL), `status` (`uploading|queued|processing|ready|failed`), `upload_id`, `raw_key`, `mp4_key`, `poster_key`, `content_type`, `size_bytes`, `duration_seconds`, `width`, `height`, `error`, `attempts`, `locked_until`, `created_at`, `updated_at`. **Neon'a uygulanmadı** (Cloudflare yayınında video kapalı).

## Kurulum ve ortam değişkenleri

- **ffmpeg:** `Dockerfile` çalışma aşamasında `apk add --no-cache ffmpeg` (ffmpeg ve ffprobe). Başka kurulum gerekmez.
- **R2:** Mevcut `R2_ENDPOINT`, `R2_BUCKET_NAME` (`exxel-estate-images`, MP4 ve kapak), `R2_PRIVATE_BUCKET_NAME` (varsayılan `exxel-estate-private`, ham yükleme), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. R2 token'ı `mittwald-site` zaten `exxel-estate-images`, `exxel-estate-private` ve `estatemarket24-backups` kovalarında okuma/yazma yetkili; yeni token veya **CORS kuralı gerekmez** (tarayıcı R2'ye doğrudan yüklemez).
- **`VIDEO_WORKER`** (isteğe bağlı): `0` işçiyi kapatır; o zaman yükleme de kapanır. Boşsa işçi şu koşullarda açılır: Node derlemesi, TCP PostgreSQL sürücüsü (`DATABASE_URL` Neon değil), R2 ayarları, ffmpeg/ffprobe bulundu. Açılmazsa günlüğe `[video] worker skipped: <neden>` yazılır; site çalışmaya devam eder.
- Disk: işlenen video için geçici klasörde ham dosya + MP4 kadar yer gerekir (en fazla ~1,1 GB). Kalmış geçici klasörler (`exxel-video-*`) işçi açılırken silinir.
- Cloudflare'e özel `STREAM_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` (Stream) artık kullanılmaz; `CLOUDFLARE_ACCOUNT_ID` `wrangler.jsonc` `vars`'tan çıkarıldı (GitHub Actions secret'ı aynı adla yayın için kalır).

## Cloudflare derlemesi

İşçi, ffmpeg ve `child_process` Workers paketine girmez: `instrumentation.ts` işçiyi `@/lib/video-worker` yuvasından alır; Cloudflare'de bu boş yuvadır (`lib/video-worker.ts`), Node derlemesinde `next.config.ts` onu `lib/video-worker-node.ts`'e yönlendirir. Video özelliği ayrıca TCP PostgreSQL sürücüsü yuvasına bağlıdır (`videoFeatureEnabled`, `lib/listing-video-server.ts`), o da Cloudflare'de boştur. `tests/listing-videos.test.mjs` bunu ve akışın geri kalanını denetler.

## Bilinen sınırlar

- iPhone'un HDR (10 bit HLG/Dolby Vision) videoları 8 bit SDR'ye çevrilir; renkler biraz soluk görünebilir.
- Mittwald ters vekil sunucusunun istek gövdesi sınırı belgelenmedi; 16 MiB parçalar sorun çıkarırsa `VIDEO_CHUNK_BYTES` küçültülebilir (en az 5 MiB, R2 kuralı).
- İşçi konteyner başına bir iş işler; birden fazla konteyner aynı tabloyu güvenle paylaşır.
