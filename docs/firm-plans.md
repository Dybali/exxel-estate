# Firma paketleri (Hizmetler ve Müteahhitler)

Sahibinin kararı (2026-11-16): firmalardan iş başına veya teklif başına ücret alınmaz. Kayıt ücretsizdir; firma sabit aylık paketle daha fazla fotoğraf, müşteriyle mesajlaşma ve (Pro'da) üst sıra alır. Kod: `lib/firm-plans.ts` (sınırlar, fiyatlar, saklama), `lib/firm-plans-server.ts` (geçerli paket ve sınırlar), `components/FirmPlans.tsx` (paket sayfası), `components/FirmMessage.tsx` (profildeki "Mesaj gönder").

## Paketler

Fiyatlar KDV hariç. Yıllık ödeme 10 ay fiyatına.

| | Ücretsiz | Plus | Pro |
| --- | --- | --- | --- |
| Hizmet firması, aylık | 0 TL | 490 TL | 990 TL |
| İş fotoğrafı | 1 | 5 | 20 |
| Müteahhit, aylık | 0 TL | 1.000 TL | 4.000 TL |
| Tamamlanan proje | 1 | 10 | 30 |
| Proje başına fotoğraf | 1 | 5 | 20 |
| Müşteriyle mesajlaşma (otomatik çeviriyle) | – | ✓ | ✓ |
| Kat karşılığı talepleri (müteahhit) | – | 24 saat sonra | Hemen |
| İstatistik geçmişi | 7 gün | 30 gün | 90 gün |
| Aramalarda öne çıkma (`featured=1`) | – | – | ✓ |

Telefon, WhatsApp, e-posta ve web sitesi düğmeleri her pakette görünür. "Belgeli firma" ve "Doğrulanmış müteahhit" rozetleri satılmaz.

## Açma anahtarı

Sınırlar yalnızca sunucuda `FIRM_PLANS=1` varken uygulanır. Kapalıyken her firma ücretsiz olarak Pro sınırlarıyla çalışır (öne çıkma hariç), böylece mevcut firmalar için hiçbir şey değişmez. Paket satın almak ise banka bilgileri (`BANK_IBAN` vb., `docs/payments.md`) girildiği anda mümkündür.

Açmadan önce: banka bilgileri girilmiş, mesafeli satış / ön bilgilendirme metni hazır, fiyatlar muhasebeciyle netleşmiş olmalı.

Mevcut içerik silinmez: sınırın üstünde fotoğraf veya projesi olan firma bunları korur, yalnızca yenisini ekleyemez (`overLimit`).

## Satın alma

1. Firma `/hizmetler/paketler` veya `/muteahhitler/paketler` sayfasından paketi seçer (firma panelindeki "Paketim" bağlantısı). Sipariş `lib/orders.ts` üzerinden oluşur (`service-plus`, `service-pro-year` …); paket yalnızca o türdeki hesaba satılır.
2. Havale/EFT bilgileri ve sipariş kodu gösterilir. Yönetici **Siparişler**'de "Ödeme alındı" deyince `grantFirmPlan` paketi tanımlar.
3. Aynı paket yeniden alınırsa süre bitişinden uzar; başka bir paket hemen başlar ve eskisinin yerini alır. Pro firmanın `featured` bayrağını açar; Pro'dan inişte veya süre bitince (günlük iş, `expirePromotions` → `expireFirmPlans`) kapanır.

Saklama: `firm_plans(user_id, plan, ends_at, order_id, updated_at)`, ilk kullanımda oluşur; hesap başına tek satır.

## Mesajlaşma

Firma görüşmeleri mevcut mesaj sistemini kullanır; ilan kimliği yerine `firm:service:<id>` / `firm:contractor:<id>` anahtarı (`lib/messaging-service.ts`, `apps/api/src/shared/` kopyasıyla aynı). Üye, yayındaki firmaya profilden yazar; firma yalnızca açılmış görüşmeye cevap verir. `/api/messages` gönderimden önce firmanın paketinde mesajlaşma olup olmadığına bakar (iki yönde de). Mesajlar Hesabım › Mesajlar'da, karşı tarafın dili farklıysa otomatik çeviriyle görünür (`lib/message-translations.ts`).

Teklif sürecinde (2026-11-25): üye, kendisine teklif veren firmaya teklif kartındaki "Mesaj gönder" ile yazar (Hesabım › Tekliflerim, hizmet ve müteahhit). Firma, kendisine teklif veya müteahhit talebi ulaşmış üyeye talep kutusundaki "Müşteriye mesaj yaz" ile ilk mesajı gönderebilir (`requestedFirm`, `lib/messaging-service.ts`); başka üyelere yine yazamaz. Paket kontrolü değişmedi (`FIRM_PLANS` kapalıyken herkese açık).

## Kat karşılığı talepleri

Talep yine en fazla 12 eşleşen müteahhite kaydedilir. Pro firma talebi hemen görür ve e-posta alır; Plus firma talebi 24 saat sonra panelinde görür (e-posta almaz); ücretsiz pakette talepler görünmez. Teklif ve "geç" işlemleri aynı kuralla sınırlıdır (`landCutoff`).

## Testler

`tests/firm-plans.test.mjs` (sınırlar, sipariş → paket, uzatma/değiştirme/bitiş, firma görüşmeleri; `node:sqlite`).
