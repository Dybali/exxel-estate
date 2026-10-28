# E-posta bildirimleri (Resend)

## Ne gönderilir

- **Yeni mesaj:** Bir ilan veya destek konuşmasında mesaj geldiğinde alıcıya e-posta. Aynı konuşma için en fazla 30 dakikada bir. Varsayılan açık (işlemsel bildirim), kullanıcı kapatabilir.
- **Günlük özet:** Kayıtlı aramalara uyan yeni ilanlar ve favorilerdeki fiyat değişiklikleri, her gün 06:00 UTC (09:00 Türkiye) Cron tetikleyicisiyle. **Varsayılan kapalı**; kullanıcı Hesabım → Aramalarım ve bildirimler bölümünden açar.
- Her e-postada tek tıkla abonelikten çıkma bağlantısı ve `List-Unsubscribe` başlığı bulunur (`/api/email/unsubscribe`).
- Yalnızca e-postası doğrulanmış hesaplara gönderilir. İçerik Türkçe + İngilizce.

Kod: `lib/email.ts` (Resend istemcisi), `lib/email-notifications.ts` (tercihler, kısıtlama, özet), `app/api/messages/route.ts` (mesaj sonrası arka plan bildirimi), `build/sites-worker.ts` (`scheduled`). Tablolar `email_preferences` ve `email_log` ilk kullanımda oluşturulur.

## Etkinleştirme

Ayarlar girilmeden hiçbir e-posta gönderilmez; tercihler yine kaydedilir.

1. Alan adı (ör. `exxelestate.com`) alındıktan sonra resend.com'da hesap açın, alan adını ekleyin ve verilen DNS kayıtlarını (SPF, DKIM) Cloudflare DNS'e girin.
2. Resend'de yalnızca gönderme yetkili bir API anahtarı oluşturun.
3. Gizli değerleri girin:
   ```bash
   npx.cmd wrangler secret put RESEND_API_KEY
   npx.cmd wrangler secret put EMAIL_FROM
   ```
   `EMAIL_FROM` örneği: `estatemarket24 <bildirim@exxelestate.com>`
4. **Gizlilik politikasını güncelleyin:** Resend (Resend, Inc.) e-posta gönderimi için veri işleyen olarak eklenmeli; alıcının e-posta adresi ve bildirim içeriği bu sağlayıcıya iletilir. Bu güncelleme yapılmadan gönderim açılmamalıdır.

Test için Resend, alan adı doğrulanmadan yalnızca hesap sahibinin kendi adresine `onboarding@resend.dev` göndericisiyle e-posta gönderir.
