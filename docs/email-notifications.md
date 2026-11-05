# E-posta (Mittwald SMTP veya Resend)

## Ne gönderilir

- **Yeni mesaj:** Bir ilan veya destek konuşmasında mesaj geldiğinde alıcıya e-posta. Aynı konuşma için en fazla 30 dakikada bir. Varsayılan açık (işlemsel bildirim), kullanıcı kapatabilir.
- **Günlük özet:** Kayıtlı aramalara uyan yeni ilanlar ve favorilerdeki fiyat değişiklikleri, her gün 06:00 UTC (09:00 Türkiye) Cron tetikleyicisiyle. **Varsayılan kapalı**; kullanıcı Hesabım → Aramalarım ve bildirimler bölümünden açar.
- **İletişim formu:** Yeni mesaj `CONTACT_EMAIL`e (yoksa `EXXEL_ADMIN_EMAIL`) bildirilir; bildirimin Reply-To'su ziyaretçinin adresidir.
- **İletişim mesajına yanıt (yönetim paneli → İletişim mesajları → "Yanıtla"):** Yanıt ziyaretçiye "Re: estatemarket24: &lt;konu&gt;" konusuyla gider; gönderen `EMAIL_FROM` (noreply), Reply-To `CONTACT_EMAIL` (info@estatemarket24.com), orijinal mesaj altında alıntılanır. Yanıt `contact_replies` tablosuna (metin, yönetici, zaman, sağlayıcı ileti kimliği) yazılır, mesaj "Yanıtlandı" olur. Gönderim başarısızsa hiçbir şey kaydedilmez. Yönetici başına saatte en fazla 30 yanıt. E-posta yapılandırılmamışsa panel bunu söyler ve `mailto:` bağlantısı yedek olarak kalır.
- **Test e-postası (yönetim paneli → Hizmet durumu → "Site e-postası" → "Test e-postası gönder"):** Oturum açmış yöneticinin adresine; hangi sağlayıcının kullanıldığını da gösterir. Yönetici başına 10 dakikada 5.
- **Sağlık uyarıları** (`ALERT_EMAIL` / `EXXEL_ADMIN_EMAIL`).
- Bildirim e-postalarında tek tıkla abonelikten çıkma bağlantısı ve `List-Unsubscribe` + `List-Unsubscribe-Post` başlıkları bulunur (`/api/email/unsubscribe`), iki sağlayıcıda da.
- Bildirimler yalnızca e-postası doğrulanmış hesaplara gönderilir. İçerik Türkçe + İngilizce.

Kod: `lib/email.ts` (sağlayıcı seçimi, `sendEmail`), `lib/email-smtp-config.ts` (SMTP ayarları, gönderen ve Reply-To kuralları), `lib/email-smtp-node.ts` (nodemailer, yalnızca Node/Mittwald derlemesi), `lib/email-smtp.ts` (Cloudflare'de boş yuva), `lib/email-layout.ts` (ortak HTML şablonu), `lib/email-notifications.ts` (tercihler, kısıtlama, özet), `lib/contact.ts` (`replyToContact`), `app/api/admin/contact/reply`, `app/api/admin/email-test`. Tablolar `email_preferences`, `email_log` ve `contact_replies` ilk kullanımda oluşturulur.

## Sağlayıcı seçimi

1. `RESEND_API_KEY` ve `EMAIL_FROM` varsa → **Resend** (HTTP API, her iki derlemede; davranış eskisi gibi, yalnızca Reply-To eklendi).
2. Yoksa `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` varsa ve derleme Node ise → **SMTP** (Mittwald posta kutusu).
3. Hiçbiri yoksa e-posta gönderilmez (`not_configured`); tercihler yine kaydedilir.

Cloudflare (vinext) derlemesinde SMTP yoktur: `next.config.ts` `@/lib/email-smtp` takma adını yalnızca `EXXEL_NODE_BUILD=1` iken `lib/email-smtp-node.ts`'e yönlendirir; nodemailer Workers paketine girmez (`tests/email-smtp.test.mjs` denetler).

## Mittwald posta kutusu ile gönderim (şu anki karar)

Ortam değişkenleri (mStudio → konteyner `site` → ortam değişkenleri; repoya ve imaja yazılmaz):

| Değişken | Değer |
|---|---|
| `SMTP_HOST` | `mail.agenturserver.de` |
| `SMTP_PORT` | `465` (önerilen, doğrudan TLS) veya `587` (STARTTLS zorunlu). Boşsa 465 |
| `SMTP_USER` | Posta kutusunun girişi, ör. `noreply@estatemarket24.com` |
| `SMTP_PASSWORD` | Posta kutusu şifresi (gizli) |
| `EMAIL_FROM` | `EstateMarket24 <noreply@estatemarket24.com>` |
| `EMAIL_REPLY_TO` | İsteğe bağlı; boşsa `CONTACT_EMAIL` (info@estatemarket24.com) |
| `CONTACT_EMAIL` | `info@estatemarket24.com` |

Kurallar ve davranış:

- **Gönderen = posta kutusu.** Mittwald yalnızca oturum açılan posta kutusunun adresiyle göndermeye izin verir. `SMTP_USER` bir e-posta adresiyse ve `EMAIL_FROM`daki adres ondan farklıysa, kod `SMTP_USER` adresini kullanır (From ve zarf göndereni), `EMAIL_FROM`daki görünen adı korur. `SMTP_USER` eski tip bir giriş adıysa (`p123456p1`), `EMAIL_FROM` olduğu gibi kullanılır; adres posta kutusununki olmalıdır.
- TLS her zaman zorunlu ve sertifika doğrulanır (465: doğrudan TLS; 587: STARTTLS, sunucu sunmazsa gönderim yapılmaz, şifre düz metin gitmez). En az TLS 1.2.
- Bağlantı havuzu (en fazla 2 bağlantı, bağlantı başına 50 ileti), zaman aşımları: bağlantı 10 s, karşılama 10 s, soket 30 s.
- HTML + düz metin (multipart/alternative), Reply-To, abonelik bağlantısı olan e-postalarda `List-Unsubscribe`.
- Günlük: başarıda `[email] smtp sent {"messageId":"…","to":"alıcı-alanadı"}`, hatada yalnızca nodemailer kodu, SMTP durum kodu ve komut adı (`{"code":"EAUTH","responseCode":535,"command":"AUTH"}`). Şifre, ileti gövdesi ve tam alıcı adresi asla yazılmaz.
- Hata nedenleri (`sendEmail` sonucu): `smtp_auth` (kullanıcı/şifre), `smtp_connection` (sunucuya ulaşılamadı), `smtp_rejected`, `smtp_error`.

Kurulum (sahibi):

1. mStudio → proje `exxelestate` → E-Mail → `noreply@estatemarket24.com` posta kutusunu oluşturun (gelen kutusu kullanılmayacaksa küçük kota yeterli), güçlü bir şifre verin.
2. **DKIM:** mStudio'da alan adının e-posta ayarlarında DKIM'i etkinleştirin (DNS Mittwald'da olduğu için kayıt otomatik eklenmeli; *menü yeri doğrulanmadı*). SPF kaydı `include:agenturserver.de` içerdiği için ek SPF işi yok. İsteğe bağlı: `_dmarc.estatemarket24.com` için `v=DMARC1; p=none; rua=mailto:info@estatemarket24.com` ile başlayın.
3. Konteynere yukarıdaki değişkenleri girin, konteyneri yeniden başlatın.
4. Yönetim paneli → Hizmet durumu → "Site e-postası": "Gönderim: SMTP (Mittwald posta kutusu)" görünmeli → "Test e-postası gönder". Gelmezse konteyner günlüğünde `[email]` satırlarına bakın (`smtp_auth` → şifre/kullanıcı; `smtp_connection` → host/port).
5. **Gizlilik politikası:** Mittwald zaten barındırma sağlayıcısı (veri işleyen) olarak geçiyorsa yeni bir işleyen eklenmez; Resend'e geçilirse Resend eklenmelidir.

## Daha sonra Resend'e geçmek

1. resend.com'da alan adını (`estatemarket24.com`) ekleyin, verilen SPF/DKIM kayıtlarını Mittwald DNS'ine girin (SPF tek kayıt kalmalı: `include:agenturserver.de` yanına Resend'in `include`u eklenir).
2. Yalnızca gönderme yetkili API anahtarı oluşturun; konteynere `RESEND_API_KEY` girin. `EMAIL_FROM` doğrulanmış alan adından olmalı. `RESEND_API_KEY` varken SMTP ayarları yok sayılır; geri dönmek için anahtarı silmek yeterli.
3. Cloudflare yayınında (SMTP yok) e-posta için tek yol Resend'dir: `npx.cmd wrangler secret put RESEND_API_KEY`; `EMAIL_FROM` `wrangler.jsonc` `vars` içinde durur (aynı adla secret eklemeyin). Bugünkü değer `EstateMarket24 <onboarding@resend.dev>`: Resend bu göndericiyle yalnızca hesap sahibine gönderir.
4. Gizlilik politikasına Resend (Resend, Inc.) veri işleyen olarak eklenmeli.

## Doğrulanan / varsayılan bilgiler (2026-11-05)

- **Doğrulandı** ([mittwald SSS: E-Mail-Client einrichten](https://www.mittwald.de/faq/e-mail/grundeinstellungen/e-mail-client-einrichten)): giden sunucu `mail.agenturserver.de`; STARTTLS 25/587, SSL 465; web uygulamaları için 465/SSL önerilir; SMTP kimlik doğrulaması zorunlu.
- **Varsayıldı:** mStudio posta kutularında SMTP kullanıcı adının tam e-posta adresi olduğu (SSS eski müşteri merkezi biçimini `pXXXXXXpX` gösteriyor, alias varsa e-posta adresinin de kullanılabileceğini söylüyor); "gönderen = posta kutusu" kuralı (sahibinin bilgisi; SSS'de yazmıyor); DKIM menüsünün yeri. developer.mittwald.de posta belgesi kontrol sırasında açılamadı (HTTP 503).
