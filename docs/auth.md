# Giriş, e-posta kodları ve Google girişi

Durum: 2026-11-09 (sahibinin onayı). Neon Auth kullanılmıyor; giriş tamamen kendi sistemimizde.

## Genel yapı

| Parça | Nerede |
|---|---|
| Kayıt, şifreyle giriş, çıkış | `app/api/account/route.ts`; şifreler `users.password_hash` (PBKDF2-SHA256, `lib/server.ts` `passwordHash`/`verifyPassword`) |
| Oturumlar | `sessions` tablosu (yalnızca token özeti), çerez `excell_session`, 30 gün |
| E-posta doğrulama ve şifre sıfırlama | `app/api/account/recovery/route.ts` → `lib/email-codes.ts` (kod mantığı), `lib/email-codes-server.ts` (anahtar, gönderim), `lib/auth-email.ts` (e-posta içeriği) |
| E-posta gönderimi | `lib/email.ts` `sendEmail`: Mittwald'da SMTP (`lib/email-smtp-node.ts`), `RESEND_API_KEY` varsa Resend |
| Google girişi | `app/api/auth/google`, `app/api/auth/callback/google`, `lib/google-auth.ts`; eşleştirme `oauth_accounts` (`provider='google'`) |
| Arayüz | `components/AuthForm.tsx` (`/giris`), `components/EmailRecovery.tsx` (`/sifremi-unuttum`, `/eposta-dogrula`) |

## E-posta kodları

- 6 haneli, `crypto.getRandomValues` ile (modulo sapması olmadan) üretilir.
- Veritabanında yalnızca **HMAC-SHA256** özeti durur (anahtar: sunucu sırrı; mesaj: satır kimliği, amaç, e-posta ve kod). Kodun kendisi saklanmaz ve günlüğe yazılmaz; yalnızca e-postada bulunur.
- Geçerlilik **15 dakika**, en fazla **5 deneme** (5. hatalı denemede kod geçersiz olur), **tek kullanımlık**.
- Bir (e-posta, amaç) için yalnızca en yeni kod geçerlidir; yeni kod eskilerini geçersiz kılar.
- Yeniden gönderme için **60 saniye** bekleme. Ayrıca mevcut sınırlar (`auth_limits`, 15 dakikalık pencere): gönderme IP başına 10, e-posta başına 3; doğrulama IP başına 24, e-posta başına 8.
- Karşılaştırma sabit sürelidir (`equalStrings`).
- Amaçlar: `verify` (giriş yapmış üyenin kendi e-postası), `reset` (şifre sıfırlama).
- E-posta ziyaretçinin dilinde (tr varsayılan; de, fr, en, ar, fa, ru, nl — `lib/auth-email-translations.ts`), Arapça ve Farsça sağdan sola. İçerik: büyük kod, "Kod 15 dakika geçerlidir…", "Bu işlemi siz yapmadıysanız bu e-postayı yok sayın." Bağlantı/token yok. Gönderen `EMAIL_FROM` (SMTP'de posta kutusu adresi), yanıt adresi `CONTACT_EMAIL`.

### Tablo `email_codes` (ilk kullanımda `CREATE TABLE IF NOT EXISTS`)

```sql
CREATE TABLE IF NOT EXISTS email_codes(
  id TEXT PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL, user_id TEXT,
  code_hash TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS email_codes_lookup_idx ON email_codes(email,purpose,created_at);
CREATE INDEX IF NOT EXISTS email_codes_created_idx ON email_codes(created_at);
```

Bir günden eski satırlar yeni kod istendiğinde silinir. Başka hiçbir tablo değişmedi.

### Hesap varlığını sızdırmama

Şifre sıfırlamada "kod gönder" yanıtı, adres kayıtlı olsun olmasın aynıdır ("E-posta adresinizi kontrol edin…"). Kod yalnızca kayıtlı bir hesap için üretilir ve e-posta arka planda gönderilir; 60 saniyelik bekleme süresinde gelen tekrar istekleri sessizce atlanır. Hatalı/olmayan kod için de tek bir mesaj vardır.

### Akışlar

- **Kayıt:** hesap oluşturulur (`email_verified=0`), tarayıcı hemen `verify` kodu ister ve `/eposta-dogrula?sent=1`'e gider. Doğrulanmamış üye yalnızca hesap bilgisini ve bu akışı kullanabilir (`lib/server.ts` `currentUser`); sayfada "Kodu tekrar gönder" (60 sn sonra) vardır. Profilde ve ilgili yerlerde "E-postamı doğrula" bağlantısı durur.
- **Şifremi unuttum:** e-posta → kod + yeni şifre (en az 10 karakter, iki kez). Başarılı olunca şifre özeti değişir, `email_verified=1` olur (kod e-postayı kanıtlar), hesabın **bütün oturumları silinir** ve kullanıcı yeni şifresiyle giriş yapar (önceki davranış aynen).

### Sunucu sırrı

`EMAIL_CODE_SECRET`: en az 16, önerilen 32+ rastgele karakter (`openssl rand -hex 32`). Tanımlı değilse `DATABASE_URL`'den türetilen bir anahtar kullanılır (her yayında zaten var olan sunucu sırrı; HMAC etiketi farklı). İkisi de yoksa (ör. D1 ile yerel geliştirme) kodlar kapalıdır ve sayfa "hizmet kullanılamıyor" der. Anahtarı değiştirmek yalnızca o an bekleyen kodları geçersiz kılar. SMS kodları da `PHONE_CODE_SECRET` yoksa aynı anahtarı kullanır (eskiden `NEON_AUTH_COOKIE_SECRET`; geçişte o an bekleyen SMS kodları geçersiz olur).

Yönetim paneli → Hizmet durumu → "E-posta doğrulama": e-posta gönderimi ve anahtar tanımlıysa "E-posta gönderimi tanımlı". Teslimatı "Test e-postası gönder" ile deneyin.

## Neon Auth'tan çıkış: mevcut kullanıcılar

- Neon Auth hiçbir zaman şifre tutmadı. Bütün hesaplar yerel `password_hash` ile oluşturuldu (kayıt, `/yonetim/kurulum`) veya Google ile (`password_hash='google-only'`). Neon Auth yalnızca e-posta kodlarını gönderiyordu ve kod doğrulanınca var olan yerel hesabı `oauth_accounts(provider='neon')` satırıyla eşliyordu; yeni hesap açmıyordu.
- Dolayısıyla **herkes eskisi gibi kendi şifresiyle giriş yapar**; şifre özetleri, oturumlar ve `oauth_accounts` satırlarına dokunulmadı. `provider='neon'` satırları artık okunmuyor, zararsızdır (istenirse sahibinin onayıyla ileride silinebilir).
- Yerel şifresi olmayan tek grup Google ile kaydolanlardır. Şifreyle girmeye çalışırlarsa genel hata mesajı onları yönlendirir: "E-posta veya şifre hatalı. Google ile kaydolduysanız Google ile giriş yapın ya da “Şifremi unuttum” ile yeni bir şifre belirleyin." "Şifremi unuttum" ile bir kez şifre belirleyebilirler.
- Kaldırılanlar: `lib/neon-mail-auth.ts`, `lib/neon-identities.ts`, `@neondatabase/auth` paketi, `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` kullanımı. `@neondatabase/serverless` kalır (Cloudflare yayınının Neon sürücüsü). Bu değişkenler Mittwald, Cloudflare ve Sites ayarlarından silinebilir; Neon panelinde Auth kapatılabilir.

## Google girişi

### Akış

1. `/api/auth/google` PKCE + `state` üretir (`oauth_flows`), Google'a yönlendirir (kapsam `openid email profile`).
2. `/api/auth/callback/google` kodu takas eder, kullanıcı bilgisini alır; e-posta Google'da doğrulanmış olmalıdır.
3. Eşleştirme:
   - Google hesabı zaten bağlıysa o üye giriş yapar.
   - Aynı e-postayla **doğrulanmış** yerel hesap varsa Google hesabı ona bağlanır ve giriş yapılır (rol, ilanlar, kimlik aynı kalır; profil fotoğrafı yalnızca boşsa doldurulur).
   - Aynı e-postayla **doğrulanmamış** yerel hesap varsa bağlanmaz (o hesabın şifresini başka biri belirlemiş olabilir): kullanıcıya önce şifresiyle girip e-postasını doğrulaması veya "Şifremi unuttum" ile şifre belirlemesi söylenir.
   - Hesap yoksa yeni üye açılır (`email_verified=1`, `password_hash='google-only'`).
   - Profilden "Google hesabını bağla" (`?link=1`) aynen çalışır.
4. Mittwald'ın HTTPS proxy'si arkasında `request.url` iç adres/http olduğu için köken `requestOrigin` (X-Forwarded-Proto/Host) ile belirlenir ve `GOOGLE_REDIRECT_URI`'nin kökeniyle karşılaştırılır. Köken uyuşmazsa Google düğmesi kapalı görünür.

### Ortam değişkenleri

| Değişken | Değer |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth istemcisi → Client ID |
| `GOOGLE_CLIENT_SECRET` | Aynı istemcinin Client secret'ı (gizli) |
| `GOOGLE_REDIRECT_URI` | Şimdi `https://p-r9al26.project.space/api/auth/callback/google`; alan adı bağlanınca `https://estatemarket24.com/api/auth/callback/google`. https olmalı, yol tam olarak `/api/auth/callback/google`, sorgu yok. Sitenin açıldığı adresle aynı köken olmalı. |

### Google Cloud Console'da yapılacaklar (sahibi)

Menü adları Google Cloud Console'un 2026 arayüzüne göredir ("Google Auth Platform"); küçük farklar olabilir.

1. console.cloud.google.com → yeni proje, ör. **EstateMarket24**.
2. **Google Auth Platform → Branding (OAuth consent screen):**
   - App name: **EstateMarket24**
   - User support email: **info@estatemarket24.com** (Google hesabınızın erişebildiği bir adres veya yönettiğiniz bir Google grubu olmalı; değilse kendi Gmail adresinizi seçip sonra değiştirin)
   - Developer contact: info@estatemarket24.com
   - App home page / privacy policy: `https://estatemarket24.com/`, `https://estatemarket24.com/gizlilik-politikasi` (alan adı bağlanınca; şimdilik boş bırakılabilir). Kullanım koşulları sayfası henüz yok; alan boş kalabilir (ilan kuralları: `/ilan-kurallari`)
   - **Authorized domains:** `estatemarket24.com` ve geçici adres için `p-r9al26.project.space`. `project.space` Mittwald'ın Public Suffix List kaydıdır (2026-11-09'da listede doğrulandı), bu yüzden `p-r9al26.project.space` kendi başına "top private domain" sayılır ve eklenebilir; `project.space`'in kendisi eklenmez.
3. **Audience:** User type **External**. Yayın durumu "Testing" iken yalnızca "Test users" listesine eklenen Google hesapları girebilir; herkese açmak için **Publish app** ("In production"). Yalnızca `openid email profile` kullanıldığı için kapsam doğrulaması gerekmez.
4. **Data access (Scopes):** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Başka kapsam eklemeyin.
5. **Clients → Create client:** Application type **Web application**, ad ör. "EstateMarket24 web".
   - Authorized JavaScript origins: gerekmez (sunucu tarafı akış); eklemek isterseniz `https://p-r9al26.project.space`, `https://estatemarket24.com`.
   - **Authorized redirect URIs:** `https://p-r9al26.project.space/api/auth/callback/google` ve (şimdiden veya alan adı bağlanınca) `https://estatemarket24.com/api/auth/callback/google`.
   - Oluşturunca Client ID ve Client secret'ı mStudio'da konteynerin ortam değişkenlerine girin (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`), konteyneri yeniden başlatın. Repoya veya sohbete yazmayın.
6. **Marka doğrulaması (isteğe bağlı):** Doğrulanmadan onay ekranında uygulama adı yerine yalnızca alan adı görünebilir ve logo gösterilmez. Uygulama adı/logo için ana sayfa alanının Search Console'da sahiplik doğrulaması gerekir. `estatemarket24.com` DNS'i Mittwald'da olduğu için DNS TXT ile doğrulanabilir; `p-r9al26.project.space`'in DNS'i sizde değildir, ancak HTML etiketiyle (`GOOGLE_SITE_VERIFICATION`) doğrulanabilir *(Google'ın bu geçici adresi marka doğrulamasında kabul edeceği doğrulanmadı; marka doğrulamasını alan adı bağlandıktan sonra estatemarket24.com ile yapmanız önerilir)*.
7. Deneme: `/giris` → "Google ile Giriş Yap". Hata olursa adres çubuğundaki `?google=` değeri: `unavailable` (değişkenler eksik veya adres `GOOGLE_REDIRECT_URI` kökeniyle aynı değil), `exchange` (secret yanlış veya yönlendirme adresi Console'da ekli değil), `cancelled`, `expired`, `unverified`, `existing`.

Alan adına geçişte: `SITE_URL` ve `GOOGLE_REDIRECT_URI`'yi estatemarket24.com'a çevirin; geçici adres bir süre Console'da kalabilir.
