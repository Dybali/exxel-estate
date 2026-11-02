# Kendi Cloudflare hesabına yayın

Site, ChatGPT Sites yerine sahibinin Cloudflare hesabında bir Worker olarak çalışır. Yapılandırma `wrangler.jsonc` dosyasındadır. Asıl veriler değişmez: ilanlar, üyeler ve mesajlar Neon'da, ilan fotoğrafları EU R2 bucket'ında (`exxel-estate-images`) kalır.

Eski Sites yayını, yeni adres tamamen test edilene kadar açık kalmalıdır.

## 1. Cloudflare'e giriş

```bash
npx wrangler login
```

Tarayıcıda açılan Cloudflare onay ekranında izni hesap sahibi verir. Kontrol: `npx wrangler whoami`.

## 2. Kaynakları oluşturma (bir kez)

```bash
npx wrangler d1 create exxel-estate-db --location weur
npx wrangler r2 bucket create exxel-estate-private --jurisdiction eu
```

`d1 create` komutunun yazdığı `database_id` değeri `wrangler.jsonc` içindeki `00000000-...` yerine yazılır. Ardından D1 tabloları kurulur:

```bash
npm run db:migrate:remote
```

D1 yalnızca işletim sayaçları, çeviri önbelleği ve yedek veri yolu içindir. Neon bağlıyken kullanıcı ve ilan verisi D1'e yazılmaz.

## 3. Gizli değerler

Her biri `npx wrangler secret put AD` ile girilir; değer terminalde sorulur, dosyaya veya sohbete yazılmaz.

Zorunlu:

| Ad | Nereden |
| --- | --- |
| `DATABASE_URL` | Neon paneli → Connect → **pooled** bağlantı adresi |
| `R2_ENDPOINT` | `https://<hesap-id>.eu.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME` | `exxel-estate-images` |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage API tokens (yalnızca bu bucket için Object Read & Write) |
| `EXXEL_ADMIN_EMAIL` | Yönetici e-postası |

E-posta doğrulama ve şifre sıfırlama için (Neon Auth):

| Ad | Nereden |
| --- | --- |
| `NEON_AUTH_BASE_URL` | Neon paneli → Auth |
| `NEON_AUTH_COOKIE_SECRET` | En az 32 karakterlik rastgele değer; yeniden üretilebilir |

İsteğe bağlı özellikler:

| Ad | Özellik |
| --- | --- |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`, `AI_DAILY_CALL_LIMIT`, `AI_MONTHLY_CALL_LIMIT`) | Emlak asistanı |
| `DEEPL_API_KEY` (+ `DEEPL_DAILY_CHAR_LIMIT`, `DEEPL_MONTHLY_CHAR_LIMIT`) | İlan çevirileri |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google ile giriş (alan adı bağlandıktan sonra) |
| `EXXEL_ADMIN_SETUP_CODE` | `/yonetim/kurulum` ile tek seferlik yönetici açılışı |
| `BACKUP_READ_TOKEN` | Salt okunur yedek okuyucu (`docs/backup-reader.md`) |
| `CAPTURE_WORKER_TOKEN`, `CAPTURE_WORKER_MODE` | 360° tur işleme |
| `RESEND_API_KEY`, `EMAIL_FROM` | E-posta bildirimleri (`docs/email-notifications.md`) |
| `BANK_ACCOUNT_NAME`, `BANK_IBAN`, `BANK_NAME` | Havale/EFT ile sipariş (`docs/payments.md`) |
| `ADMIN_TOTP_KEY` | Yönetici iki adımlı doğrulaması (en az 32 rastgele karakter; değiştirilirse 2FA yeniden kurulur) — `docs/security-checklist.md` |
| `SMS_PROVIDER` (`netgsm` veya `twilio`) + `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_HEADER` veya `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS ile telefon doğrulaması |
| `PHONE_CODE_SECRET` | SMS kodlarının özet tuzu (yoksa `NEON_AUTH_COOKIE_SECRET` kullanılır) |
| `GA_MEASUREMENT_ID` | Google Analytics 4 (`G-…`), yalnızca çerez izniyle yüklenir |
| `GOOGLE_SITE_VERIFICATION` | Google Search Console HTML etiketi doğrulama değeri |

Sohbette paylaşılmış değerlerin yenilenmesi, eski Sites yayınlarının kapatılması ve bu özelliklerin açılması adım adım: [security-checklist.md](security-checklist.md).

ChatGPT Sites gizli değerleri geri göstermez. Elinde kopyası olmayan anahtarlar ilgili panelden yeniden oluşturulur; eskisi iptal edilmeden önce yeni site test edilir.

## 4. Yayın

```bash
npm run verify
npm run deploy
```

Otomatik yayın: `main`'e yapılan her push'ta GitHub Actions (`verify-site.yml`) önce `npm run verify`, başarılıysa `npm run deploy` çalıştırır. Bunun için depoda **Settings → Secrets and variables → Actions** altında iki gizli değer tanımlı olmalıdır: `CLOUDFLARE_API_TOKEN` (Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" şablonu, yalnızca bu hesap) ve `CLOUDFLARE_ACCOUNT_ID` (Workers & Pages sayfasının sağındaki Account ID). Tanımlı değilse yayın adımı atlanır.

İlk yayın `https://exxel-estate.<hesap-alt-alanı>.workers.dev` adresinde açılır. Bu adreste kontrol edilecekler: ana sayfa, arama, ilan detayı ve fotoğraflar, kayıt/giriş, ilan verme ve fotoğraf yükleme, mesajlaşma, yönetim paneli.

## 5. Verilerin eksiksiz taşınması

| Veri | Bugün nerede | Taşıma |
| --- | --- | --- |
| Üyeler, emlakçılar, şirketler, ekipler, ilanlar, favoriler, mesajlar, randevular, raporlar, ofis doğrulama kayıtları | Neon | Gerekmez; yeni site aynı veritabanına bağlanır |
| İlan ve profil fotoğrafları | `exxel-estate-images` (sahibinin EU R2 bucket'ı) | Gerekmez; aynı bucket kullanılır |
| Emlakçı ofis belgeleri, tur görüntüleri, eski fotoğraflar | Sites'ın kendi R2 deposu | `scripts/migrate-private-media.mjs` ile kopyalanır |
| DeepL çeviri önbelleği, işletim sayaçları | Sites'ın kendi D1'i | Taşınmaz; çeviriler ilk istekte yeniden üretilir |

Eski ve yeni site aynı Neon veritabanını kullandığı için geçiş süresince iki sitede yapılan kayıtlar aynı yere düşer; veri ayrışmaz.

Özel dosyaların kopyalanması (eski sitede `BACKUP_READ_TOKEN` tanımlı olmalı):

```bash
node scripts/migrate-private-media.mjs --dry-run
node scripts/migrate-private-media.mjs
```

İki eski Sites yayını vardır ve ikisi de aynı Neon veritabanına bağlıdır: güncel `estatemarket24-showcase.tastymole36.chatgpt.site` (betiğin varsayılanı) ve daha eski `exxel-estate.blue-grape-8839.chatgpt.site`. Her birinin kendi özel deposu vardır; eskisi için `OLD_SITE_URL` ile ayrıca çalıştırılır. Betik eski sitenin `BACKUP_READ_TOKEN` değerini gizli girişle sorar ve yüklemeyi oturum açılmış Wrangler ile yapar; R2 anahtarı istemez. Dosyalar önce `work/private-media/` klasörüne (Git dışı) indirilir, sonra yeni bucket'a yüklenir. Yeni Worker'a da aynı `BACKUP_READ_TOKEN` girilmişse betik yeni sitedeki listeyi okuyup her dosyanın boyutunu doğrular. Betik tekrar çalıştırılabilir; geçiş anında son bir kez çalıştırılarak arada eklenen dosyalar da alınır.

Geçişten hemen önce Neon panelinden bir **branch (anlık kopya)** oluşturulur; bir sorun olursa veri o ana döndürülebilir.

## 6. Alan adı ve geçiş

1. `exxelestate.com` Cloudflare'e eklenir, Worker'a Custom Domain olarak `www.exxelestate.com` bağlanır.
2. Google Cloud Console'da yönlendirme adresi `https://www.exxelestate.com/api/auth/callback/google` olarak kalır; `GOOGLE_*` gizli değerleri girilip yeniden yayın yapılır.
3. Özel dosya betiği son kez çalıştırılır.
4. Alan adı değiştiği için kullanıcılar bir kez yeniden giriş yapar; hesapları ve şifreleri aynıdır.
5. Her şey çalışınca ChatGPT Sites yayını kapatılır.
6. Sites kapandıktan sonra Neon'da `neondb_owner` şifresi sıfırlanır (Roles → Reset password) ve yeni adres `npx.cmd wrangler secret put DATABASE_URL` ile girilir. Eski şifre geçiş sırasında paylaşıldığı için bu adım atlanmamalıdır.
7. Aynı nedenle `GEMINI_API_KEY` (Google AI Studio) ve `DEEPL_API_KEY` (DeepL hesabı) yenilenir, eskileri iptal edilir ve yenileri `npx.cmd wrangler secret put` ile girilir.

## Geri alma

`npx wrangler rollback` önceki Worker sürümüne döner. Veriler Neon ve R2'de olduğu için kod geri alımı veriyi etkilemez.
