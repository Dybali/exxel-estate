# Hizmetler (hizmet firmaları rehberi)

`/hizmetler` alt sitesi: boyacı, tesisatçı, nakliyeci, avukat, tercüman gibi firmaların profilleri, kategori ve il/ilçe sayfaları, arama ve "Teklif iste". Kod: `lib/services.ts` (firmalar, arama, yönetim), `lib/service-extras.ts` (2. aşama), `lib/service-emails.ts`, `lib/service-samples.ts` (yalnızca kodda duran, etiketli örnek firmalar; `SERVICE_SAMPLES=0` ile kapanır).

Tablolar ilk kullanımda `CREATE TABLE IF NOT EXISTS` ile oluşur (`SERVICE_SCHEMA`); PostgreSQL ve SQLite'ta çalışır, migrasyon dosyası yoktur.

## Firma

- Her üye bir firma açabilir (Hesabım › Hizmet firmam); hesap türü değişmez. Profil ve her düzenleme yönetici onayına gider (`pending → approved | rejected`, yayındaki firma askıya alınabilir).
- Yönetici kararı (onay, düzeltme, askı) firmaya e-postayla bildirilir.
- **Çalışma bilgileri** (`service_firm_details`): haftalık saatler (Pazartesi ilk, `["09:00","18:00"]` veya `null` = kapalı, `24:00` = gece yarısına kadar), 7/24 acil hizmet, TL fiyat aralığı ve birimi (iş/saat/gün/m²/ziyaret başı), kısa fiyat notu. Onaya gitmeden hemen yayınlanır. Profilde "Şu an açık/kapalı" İstanbul saatiyle (UTC+3) tarayıcıda hesaplanır; yapılandırılmış veride `openingHoursSpecification` ve `priceRange`.
- **Belgeler** (`service_firm_documents`): vergi levhası, ticaret sicil/oda kaydı, ustalık belgesi, faaliyet izni, sigorta, diğer. PDF/JPG/PNG, en fazla 5 MB, firma başına 8 belge; özel depoda `private/service-documents/{firmId}/…`. Yalnızca firma sahibi ve yöneticiler indirebilir (`/api/services/documents/{id}`, `Content-Disposition: attachment`, sandbox CSP). Onaylanan tek belge "Belgeli firma" rozetini verir (kart, profil, `?belgeli=1` filtresi). Ret notu ve onay e-postayla bildirilir. "Doğrulanmış firma" (`verified`) yöneticinin ayrı elle verdiği rozettir.
- **İstatistikler** (`service_firm_stats`): firma ve gün (İstanbul takvimi) başına sayaçlar: `view`, `phone`, `whatsapp`, `email`, `website` (ziyaretçinin tarayıcısı `POST /api/services/track` ile bildirir) ve `quote`, `offer` (sunucu sayar). Yalnızca yayındaki firmalar sayılır. Aynı ziyaretçi/firma/tür 30 dakikada bir kez sayılır; bunun için IP özeti yalnızca süreç belleğinde tutulur, veritabanına kişi, IP veya oturum yazılmaz. Panel 7/30/90 gün ve önceki dönem karşılaştırması gösterir.

## Teklif iste

1. Üye `/hizmetler/teklif-iste` formunu doldurur (giriş gerekir): kategori, il/ilçe, açıklama (20–2000 karakter), zaman (hemen / bu ay / 1–3 ay / esnek), ad, e-posta, isteğe bağlı telefon ve "firmalar beni arayabilir" seçeneği. Kategori/il/ilçe sayfalarındaki ve firma profilindeki düğmeler formu doldurur (`quoteHref`); profildeki düğme talebi yalnızca o firmaya gönderir (`?firma=`).
2. Eşleşme (`matchingFirms`): kategoriyi veren, o ilde (ilçe seçildiyse o ilçede veya tüm ilde) hizmet veren yayındaki firmalar; öne çıkan, belgeli, doğrulanmış olan önce; en fazla 12 firma. Üyenin kendi firması alıcı olmaz. Eşleşen firma yoksa talep kaydedilmez ve üye bilgilendirilir.
3. Sınırlar: üye başına günde 5 talep (ve 15 dakikada 10 istek); talep 30 gün sonra kendiliğinden kapanır.
4. Firmalar e-posta alır (müşteri iletişim bilgisi e-postada yoktur) ve Hizmet firmam › Teklif talepleri'nde talebi görür. Firma müşterinin yalnızca adını görür; telefon ve e-posta, müşteri paylaşmayı seçtiyse veya firmanın teklifini kabul ettiyse görünür.
5. Firma bir kez TL teklif verir (tutar veya aralık + açıklama) ya da talebi geçer. Müşteri e-posta alır, Hesabım › Teklif taleplerim'de teklifleri en ucuzdan başlayarak yan yana görür, birini kabul eder (diğerleri "seçilmedi" olur, talep kapanır, firma e-posta alır) veya talebi kapatır.
6. Ortalama yanıt süresi: son 90 günde talebin firmaya ulaşması ile teklif arasındaki sürelerin medyanı; en az 3 teklifle profilde gösterilir.

estatemarket24 firma ile müşteri arasındaki anlaşmanın tarafı değildir; ödeme site üzerinden alınmaz.

## E-postalar

`lib/service-emails.ts`, Türkçe/İngilizce. Firma onayı/reddi/askısı ve belge kararları her zaman gönderilir (hesapla ilgilidir). Yeni teklif talebi, yeni teklif ve kabul edilen teklif üyenin "mesaj e-postaları" tercihine uyar ve abonelikten çıkma bağlantısı içerir. Gönderim `waitUntil` ile arka planda yapılır; hata isteği etkilemez.

## API

| Yol | Ne yapar |
| --- | --- |
| `GET/POST/PATCH/DELETE /api/services/mine` | Üyenin firması (GET ayrıca çalışma bilgileri, belgeler, yeni talep sayısı, yanıt süresi) |
| `PATCH /api/services/mine/details` | Çalışma bilgileri |
| `GET/POST/DELETE /api/services/mine/documents` | Belgeler (POST gövdesi ham dosya, `X-Document-Kind`) |
| `GET /api/services/mine/stats?gun=7\|30\|90` | İstatistikler |
| `GET/POST/PATCH /api/services/mine/quotes` | Gelen talepler, teklif gönderme, geçme |
| `GET/POST/PATCH /api/services/quotes` | Üyenin talepleri, yeni talep, kapatma, teklif kabulü |
| `POST /api/services/track` | Görüntülenme ve iletişim tıklaması |
| `GET /api/services/documents/{id}` | Belge indirme (sahip veya yönetici) |
| `GET/POST /api/admin/services` | Yönetim: firmalar ve belgeleri, `approve_document` / `reject_document` |

## Testler

`tests/services.test.mjs`, `tests/service-search.test.mjs`, `tests/service-samples.test.mjs`, `tests/service-extras.test.mjs` (çalışma bilgileri, belgeler, istatistikler, teklif akışı, yanıt süresi; `node:sqlite`).

## Hesap türü (2026-11-13)

Bir hesap tek türdür: Bireysel, Emlakçı, Müteahhit veya Hizmet firması (`lib/account-kind.ts`). Müteahhit ve hizmet firması türü kayıtta seçilir ya da Hesabım › Profilim › Hesap türü'nden değiştirilir; `users.role` değişmez (`buyer`), tür `account_kinds` tablosunda tutulur (ilk kullanımda oluşur). Yeni firma yalnızca o türdeki hesapla açılır; emlakçılar açamaz. Mevcut firmalar düzenlenebilir kalır ve eski hesapların türü sahip oldukları firmadan çıkarılır. Her türün kendi Hesabım menüsü vardır (`lib/account-panel.ts`).

## Firma paneli ve istatistikler (2026-11-13)

Hizmet firması hesabının paneli Hizmetler alt sitesinin içindedir: `/hizmetler/panel` (`components/FirmPanelPage.tsx`); Hesabım'daki firma sekmesi ve e-posta bağlantıları buraya yönlendirir, mesajlar ve hesap ayarları Hesabım'da kalır. İstatistikler `lib/firm-stats.ts` ile günlük toplam olarak tutulur: aramalarda görünme (`search`, sonuç sayfasında listelenen firmalar, `lib/firm-track-client.ts`), profil görüntülenme, telefon/WhatsApp/e-posta/web sitesi tıklaması, gelen teklif talebi ve gönderilen teklif. Aynı ziyaretçi, firma ve tür 30 dakikada bir sayılır (`lib/firm-track.ts`); botlar sayılmaz.
