# Güvenlik kontrol listesi (sahibi için)

Bu liste elle yapılacak işleri sırayla anlatır. Gizli değerler hiçbir zaman sohbete, repoya veya dosyaya yazılmaz; yalnızca ilgili panelde üretilir ve **mStudio → proje → Containers → `site` → Environment** bölümüne ortam değişkeni olarak girilir. Değişiklikten sonra konteyner yeniden başlatılır (mStudio'da **Recreate**, ya da bir sonraki `main` yayını). GitHub Actions yalnızca `MITTWALD_API_TOKEN` kullanır; uygulamanın gizli değerleri GitHub'a girilmez.

Site yalnızca Mittwald'da çalışır (2026-11-23): veritabanı Mittwald'daki `postgres` konteyneri, Neon ve Cloudflare Worker kullanılmaz.

## 1. Geçişte sohbete yapıştırılan gizli değerleri yenileyin

Her değeri yeniledikten sonra siteyi kontrol edin (ana sayfa, giriş, ilan detayı, yönetim → Sistem durumu).

| Değer | Nerede yenilenir | Nereye girilir |
| --- | --- | --- |
| Mittwald PostgreSQL şifresi (`DATABASE_URL` içindeki) | mStudio → `postgres` konteyneri → ortam değişkeni `POSTGRES_PASSWORD` ile birlikte veritabanında `ALTER USER … PASSWORD …` | `site` konteynerinde `DATABASE_URL` |
| `GEMINI_API_KEY` | Google AI Studio → **API keys** → yeni anahtar oluştur, eskisini **Delete**. | `site` ortam değişkeni |
| `OPENAI_API_KEY` | platform.openai.com → **API keys** → yeni Restricted anahtar (Chat completions, Files, Batch), eskisini **Revoke**. | `site` ortam değişkeni |
| `DEEPL_API_KEY` | DeepL hesabı → **API Keys** → yeni anahtar, eskisini devre dışı bırakın. | `site` ortam değişkeni |
| `BACKUP_READ_TOKEN` | Artık gerekmez: `site` ortam değişkenlerinde varsa silin. | — |

Notlar:

- Veritabanı şifresi değişince `DATABASE_URL` hemen güncellenmezse site birkaç dakika veritabanına ulaşamaz; ikisini art arda yapın.
- Bir değer yanlışlıkla GitHub'a veya bir dosyaya yazıldıysa o değer de aynı şekilde yenilenir; yalnızca dosyadan silmek yetmez.

## 2. Eski yayınları ve Neon'u kapatın (2026-11-23)

Eski ChatGPT Sites yayını zaten kapalı (404). Kalanlar:

1. **Cloudflare Worker'ı silin:** dash.cloudflare.com → **Workers & Pages** → `exxel-estate` → **Settings** → en altta **Delete**. Bu, `exxel-estate.estatemarket24.workers.dev` adresini kapatır ve Neon'a yazan son yeri ortadan kaldırır. Worker'ın gizli değerleri onunla birlikte silinir. **R2 kovalarına dokunmayın** (`exxel-estate-images`, `exxel-estate-private`, `estatemarket24-backups`): fotoğraflar ve belgeler hâlâ orada.
2. **Neon'dan son yedek:** console.neon.tech → proje → **Backup & Restore** (veya bilgisayarınızda `pg_dump` ile tam döküm). Dosyayı güvenli bir yerde saklayın; 3 Kasım'dan sonra yalnızca Neon'a yazılmış birkaç kayıt (1 ilan, olası üyelik/mesaj) yalnızca bu yedekte kalır.
3. **Neon projesini silin:** Neon → proje → **Settings** → **Delete project**. Ardından Neon hesabını kapatabilirsiniz.
4. Eski Sites panelinde gizli değer kaldıysa (Neon, Gemini, DeepL, Google OAuth…) silin.
5. GitHub → repo → **Settings → Secrets and variables → Actions**: `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` varsa silin; Cloudflare'de bu token'ı **My Profile → API Tokens** altından da iptal edin. (R2 için kullanılan `mittwald-site` R2 token'ı kalır.)

## 3. Yönetici iki adımlı doğrulamasını (2FA) açın

1. Anahtar üretin ve girin (en az 32 karakter):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   npx wrangler secret put ADMIN_TOTP_KEY
   ```
   Bu anahtar 2FA gizli anahtarlarını veritabanında AES-GCM ile şifreler ve 2FA onay çerezini imzalar. Değeri bir parola yöneticisinde saklayın. **Değiştirirseniz veya silerseniz** mevcut 2FA kayıtları çözülemez: anahtar silinirse 2FA zorunluluğu kalkar, değiştirilirse yöneticiler 2FA'yı yeniden kurmalıdır (bkz. "Kilitlenme").
2. Yönetici hesabıyla giriş yapın → **Hesabım → Profilim → Hesap güvenliği → Yönetici iki adımlı doğrulama ayarları** (doğrudan adres: `/yonetim/guvenlik`).
3. **Kurulumu başlat** → Google Authenticator veya Microsoft Authenticator'da "kurulum anahtarı gir" ile gösterilen anahtarı ekleyin (zaman tabanlı, 6 hane, 30 sn). Telefonda sayfayı açtıysanız bağlantıya dokunmak da yeterlidir. Bu sürümde QR kodu gösterilmez.
4. Uygulamadaki kodu girip **Kurulumu tamamla**. Gösterilen 10 kurtarma kodunu parola yöneticisine kaydedin; bir daha gösterilmez.
5. Bundan sonra her yeni oturumda şifreden sonra 6 haneli kod istenir. Onay 12 saat veya tarayıcı kapanana kadar geçerlidir.

**Zorunluluk (2026-11-15):** `ADMIN_TOTP_KEY` tanımlı olduğu anda 2FA bütün yöneticiler için zorunludur. Kurulumu yapmamış bir yönetici giriş yapınca doğrudan `/yonetim/guvenlik` sayfasına gönderilir; kurulum tamamlanana kadar yalnızca bu sayfayı açabilir, yönetim uçları kapalıdır. Mittwald'da anahtar mStudio'da konteynerin ortam değişkeni olarak girilir (`npx wrangler secret put` yalnızca Cloudflare içindir). Anahtar tanımlı değilse 2FA kapalı kalır ve hiçbir şey değişmez.

Nasıl çalışır: 2FA'yı açmış bir yönetici, oturumu kodu onaylayana kadar sitede normal üye gibi görünür (`isAdmin` yanlış döner); bu yüzden tüm `/api/admin/*` uçları, `/yonetim` sayfaları ve yöneticiye özel yetkiler (ilan düzenleme, medya, dışa aktarma vb.) kod girilene kadar kapalıdır. 5 hatalı denemede 15 dakika kilit vardır; aynı kod ikinci kez kullanılamaz.

Kilitlenme (telefon ve kurtarma kodları kayıp): mStudio'da `postgres` konteynerinin terminalinde `psql` ile `DELETE FROM admin_totp WHERE user_id='<yönetici kullanıcı id>';` çalıştırın; 2FA kapanır, sonra yeniden kurun.

## 4. SMS ile telefon doğrulaması (isteğe bağlı)

Sağlayıcı ayarlanmadıkça özellik kapalıdır ve hesap sayfasında "Telefon doğrulaması henüz kullanılamıyor." yazar. Doğrulama kimse için zorunlu değildir.

Kodlar için gizli tuz: `PHONE_CODE_SECRET` (en az 16, tercihen 32+ rastgele karakter); yoksa e-posta kodlarının anahtarı (`EMAIL_CODE_SECRET`, o da yoksa `DATABASE_URL`'den türetilen anahtar, bkz. [auth.md](auth.md)) kullanılır.

Netgsm (Türkiye, önerilen):

1. Netgsm panelinde bir **API alt kullanıcısı** oluşturun (yalnızca SMS gönderme yetkisi) ve onaylı bir **mesaj başlığı** (ör. `EXXELESTATE`) alın.
2. Girin:
   ```bash
   npx wrangler secret put SMS_PROVIDER      # netgsm
   npx wrangler secret put NETGSM_USERCODE   # abone no / API kullanıcı kodu
   npx wrangler secret put NETGSM_PASSWORD   # API alt kullanıcı şifresi
   npx wrangler secret put NETGSM_HEADER     # onaylı mesaj başlığı
   ```
   İstek: `POST https://api.netgsm.com.tr/sms/rest/v2/send`, Basic auth, JSON `msgheader`, `encoding: "TR"`, `iysfilter: "0"` (bilgilendirme mesajı), `messages[{msg,no}]`; başarı yanıtı `code: "00"`. Netgsm panelinde API için IP kısıtlaması açıksa Cloudflare Worker'ların sabit IP'si olmadığından kapalı kalmalıdır.

Twilio (yurt dışı numaralar için):

```bash
npx wrangler secret put SMS_PROVIDER        # twilio
npx wrangler secret put TWILIO_ACCOUNT_SID  # AC ile başlar
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_FROM         # +1… gönderici numara veya onaylı alfanümerik gönderici
```

Sınırlar: kullanıcı başına saatte 3, günde 10 kod; numara başına günde 5 kod; 60 sn yeniden gönderme beklemesi; kod 10 dakika ve 5 deneme geçerli. Kod veritabanında yalnızca HMAC özeti olarak (`phone_verifications` tablosu) saklanır. Doğrulanan numara hesabın telefon numarası olur; numara değişirse doğrulama işareti kalkar.

## 5. Google Analytics 4 ve Search Console (isteğe bağlı)

Google Analytics:

1. analytics.google.com → yeni GA4 mülkü → Web veri akışı → **Ölçüm kimliği** (`G-XXXXXXX`).
2. Mülk ayarlarında: **Veri toplama → Google sinyalleri kapalı**, **Reklam kişiselleştirme kapalı**, veri saklama süresi 2 ay (önerilen). Google ile veri işleme sözleşmesini (Data Processing Terms) kabul edin.
3. Girin: `npx wrangler secret put GA_MEASUREMENT_ID`.

Davranış: kimlik yoksa hiçbir Google dosyası yüklenmez. Varsa `gtag.js` yalnızca ziyaretçi çerez panelinde **İstatistik** iznini verdikten sonra yüklenir (Google Consent Mode v2, varsayılanlar "denied", yalnızca `analytics_storage` izinle açılır, reklam özellikleri kapalı). Sayfa geçişlerinde `page_view` gönderilir. GA eklenmeden önce verilmiş İstatistik izinleri GA'yı açmaz; panel bu ziyaretçilere bir kez yeniden gösterilir. Çerez politikasında `_ga` çerezleri listelenmiştir. **Gizlilik politikasına da Google Analytics bölümü eklenmelidir** (Google Ireland Limited, amaç, saklama süresi, ABD aktarımı / DPF) — bu metin hukuki kontrol gerektirdiği için kodda değiştirilmedi.

Search Console:

1. search.google.com/search-console → **URL ön eki** mülkü (`https://www.exxelestate.com`) → doğrulama yöntemi **HTML etiketi**.
2. Etiketteki `content="…"` değerini girin: `npx wrangler secret put GOOGLE_SITE_VERIFICATION`. Site, kök sayfada `<meta name="google-site-verification">` etiketini üretir.
3. Search Console'da **Doğrula**'ya basın, ardından **Site haritaları** bölümüne `sitemap.xml` ekleyin.

Alan adı mülkü (DNS TXT kaydı) kullanılırsa `GOOGLE_SITE_VERIFICATION` gerekmez; TXT kaydı alan adının DNS'ine eklenir.

Bu iki değer gizli değildir; yine de `wrangler.jsonc` içindeki `vars` yerine `wrangler secret put` ile girilmesi önerilir: `vars` her yayında dosyadaki değerle değiştirilir ve boş bırakılan değerler panelde girilenleri siler.
