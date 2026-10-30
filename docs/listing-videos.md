# İlan videoları (Cloudflare Stream)

İlan veren, ilan verme ve düzenleme formundan video yükler. Dosya tarayıcıdan doğrudan Cloudflare Stream'e, parça parça (tus, kaldığı yerden devam eder) gider; Worker dosyayı taşımaz. Stream videoyu her cihaz için dönüştürür, ilan sayfasında Stream oynatıcısı gösterilir.

## Sınırlar

- En fazla 10 dakika (`MAX_VIDEO_SECONDS`) ve 2 GB (`MAX_VIDEO_BYTES`), `lib/stream-video.ts`.
- İlan başına bir yüklenmiş video. YouTube/Vimeo bağlantısı ayrıca eklenebilir.

## Akış

1. `POST /api/media/video` `{size}` → tek kullanımlık tus adresi. Yükleyen kullanıcı videonun `creator` alanına yazılır.
2. Tarayıcı dosyayı 50 MiB parçalarla yükler (`components/VideoUpload.tsx`).
3. `PATCH /api/media/video` `{uid}` → video 31 gün sonra silinmek üzere işaretlenir; ilana eklenmezse kendiliğinden silinir.
4. İlan kaydedilince (`app/api/listings`, `app/api/listings/[id]`) videonun sahibi kontrol edilir ve silme işareti kaldırılır. Video değiştirilir, kaldırılır ya da ilan silinirse eski video Stream'den silinir.
5. `GET /api/media/video?uid=` formdaki hazırlanma durumunu verir.

Video kimliği `listing.presentation.streamVideo` içinde saklanır; veritabanı şeması değişmez.

## Kurulum

1. Cloudflare panelinde **Stream**'i etkinleştirin (ücretli: saklanan 1000 dakika için aylık yaklaşık 5 $, izlenen 1000 dakika için 1 $).
2. **My Profile → API Tokens → Create Token → Custom token**, izin: *Account → Stream → Edit*, hesap: bu hesap.
3. Worker'a gizli ayar olarak ekleyin: **Workers & Pages → exxel-estate → Settings → Variables and Secrets → Add → Secret**, ad `STREAM_API_TOKEN`.
4. `CLOUDFLARE_ACCOUNT_ID` `wrangler.jsonc` içindeki `vars`'ta durur.

Token yoksa form "Video yükleme henüz yapılandırılmadı." der; sitenin geri kalanı etkilenmez.
