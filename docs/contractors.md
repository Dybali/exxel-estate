# Müteahhitler (müteahhit rehberi ve kat karşılığı)

`/muteahhitler` alt sitesi, Hizmetler (`docs/services.md`) gibi kendi üst menüsü ve alt bilgisiyle çalışır (`app/muteahhitler/layout.tsx`, `lib/site-chrome.ts`). Kod: `lib/contractors.ts` (firmalar, arama, yönetim, kat karşılığı), `lib/contractor-emails.ts`, `lib/contractor-samples.ts` (yalnızca kodda duran, etiketli örnek firmalar; `CONTRACTOR_SAMPLES=0` ile kapanır), `lib/contractors-server.ts`. Stiller Hizmetler'in `svc-*` / `service-*` sınıflarını kullanır, ekler `app/contractors.css`'te.

Satıştaki konut projeleri ayrı kalır (`/projeler`, `lib/projects.ts`); müteahhit profili, aynı üyenin onaylı projelerini "Satıştaki projeleri" başlığıyla listeler.

Tablolar ilk kullanımda `CREATE TABLE IF NOT EXISTS` ile oluşur (`CONTRACTOR_SCHEMA`, sahibinin onayıyla 2026-11-10); PostgreSQL ve SQLite'ta çalışır, migrasyon dosyası yoktur: `contractor_firms`, `contractor_areas`, `contractor_projects`, `land_requests`, `land_request_recipients`, `land_offers`.

## Firma

- Her üye bir müteahhit firması açabilir (Hesabım › Müteahhit firmam); hesap türü değişmez. Profil ve her düzenleme yönetici onayına gider (`pending → approved | rejected`, yayındaki firma askıya alınabilir). Karar e-postayla bildirilir.
- Alanlar: ad, açıklama, uzmanlık alanları (konut, villa, ticari ve ofis, karma, kentsel dönüşüm, otel ve turizm, sanayi ve depo, restorasyon), çalışılan il/ilçeler (tüm il ilçeleri kapsar), telefon, WhatsApp, e-posta, web sitesi, logo, kapak, kuruluş yılı, **Yapı Müteahhitliği Yetki Belgesi numarası**, "kat karşılığı çalışıyoruz" seçeneği, vergi bilgileri (yalnızca yönetici).
- **Tamamlanan projeler** (en fazla 30): ad, tür, il/ilçe, tamamlanma yılı, bağımsız bölüm sayısı, kısa açıklama, en fazla 6 fotoğraf. Profille birlikte kaydedilir ve onaya gider.
- **Doğrulanmış müteahhit**: yönetici, yetki belgesi numarasını Bakanlığın sisteminden kontrol ettikten sonra verir. Numarası olmayan firma doğrulanamaz; numara değişirse rozet kendiliğinden düşer.
- Fotoğraflar ilan fotoğrafı hattıyla yüklenir (`/api/media?purpose=contractor`); onaylı firmanın logo, kapak ve proje fotoğrafları herkese açıktır (`contractorMediaPublic`). Bir fotoğraf tek bir ilan, proje veya firmaya aittir.

## Kat karşılığı

1. Üye `/muteahhitler/kat-karsiligi` formunu doldurur (giriş gerekir): il, ilçe (veya tüm il), arsa alanı (50–1.000.000 m²), imar durumu, isteğe bağlı emsal (0,05–10) ve beklenen pay (%1–99), açıklama, ad, e-posta, isteğe bağlı telefon ve "müteahhitler beni arayabilir" seçeneği. Profildeki düğme talebi yalnızca o firmaya gönderir (`?firma=`).
2. Eşleşme (`matchingContractors`): kat karşılığı çalışan, o ilde (ilçe seçildiyse o ilçede veya tüm ilde) yayındaki firmalar; öne çıkan ve doğrulanmış olan önce, en fazla 12. Üyenin kendi firması alıcı olmaz. Eşleşen yoksa talep kaydedilmez.
3. Sınırlar: üye başına günde 3 talep; talep 30 gün sonra kendiliğinden kapanır.
4. Müteahhitler e-posta alır ve Müteahhit firmam › Kat karşılığı talepleri'nde talebi görür (adı görünür; telefon ve e-posta, üye paylaşmayı seçtiyse veya firmanın teklifini kabul ettiyse görünür). Firma bir kez teklif verir (arsa sahibine kalacak pay %, teslim süresi ay, açıklama) ya da geçer.
5. Üye e-posta alır, Hesabım › Kat karşılığı taleplerim'de teklifleri en yüksek paydan başlayarak görür, birini kabul eder (diğerleri "seçilmedi" olur, talep kapanır, firma e-posta alır) veya talebi kapatır.

estatemarket24 arsa sahibi ile müteahhit arasındaki sözleşmenin tarafı değildir; sayfalar noter onaylı sözleşme ve avukat önerir. Gizlilik politikasında "Müteahhit firmaları" ve "Kat karşılığı talepleri" veri kategorileri yer alır.

## İnşaat ve tadilat talebi ("Benim için müteahhit bul", 2026-11-24)

Aynı form (`/muteahhitler/kat-karsiligi`, `?tur=insaat` ile açılır) ikinci bir tür alır: üye arsasına ev/villa, apartman, kentsel dönüşüm, büyük tadilat/güçlendirme veya ticari bina yaptırmak ister ve müteahhitler **TL fiyat** verir. Formun üstünde iki seçenek vardır (inşaat / kat karşılığı); seçim adresteki `tur` değerini günceller.

- Veri aynı tablolarda: `land_requests.kind` (`land` | `build`), `work` (`BUILD_WORKS`: ev, apartman, kentsel-donusum, tadilat, ticari), isteğe bağlı `budget_min`/`budget_max` (TL); `land_offers.price_min`/`price_max` (TL; inşaat tekliflerinde `owner_share` 0'dır). Sütunlar sahibinin onayıyla eklendi; eski veritabanlarına `ensureContractors` ilk kullanımda ekler (PostgreSQL `ADD COLUMN IF NOT EXISTS`, SQLite düz `ADD COLUMN`, var olan sütun yok sayılır). Eski talepler `land` sayılır.
- Alan 20–1.000.000 m², imar durumu isteğe bağlı (boşsa "bilinmiyor"), emsal ve beklenen pay sorulmaz; bütçede en az ≤ en çok.
- Eşleşme: kat karşılığı çalışıp çalışmadığına bakılmaz, bölgedeki tüm onaylı müteahhitler; öne çıkan önce, sonra işin türüne uyan uzmanlık (ör. villa için `villa`/`konut`), sonra doğrulanmış. En fazla 12; günlük 3 talep sınırı iki türde ortaktır.
- Teklif: fiyat (TL, isteğe bağlı üst sınırla aralık), teslim süresi, açıklama. Üye teklifleri en düşük fiyattan başlayarak görür; kabul ve kapatma kat karşılığıyla aynıdır. E-postalar türe göre başlık ve fiyat satırı kullanır.
- Panelde firmanın sekmesi "Müşteri talepleri", üyenin bölümü "Müteahhit taleplerim" adını aldı; kartlarda tür etiketi görünür. Profil sayfasında her yayındaki firma için "Bu firmadan inşaat teklifi iste", kat karşılığı çalışanlar için ayrıca kat karşılığı düğmesi vardır.
- Testler: `tests/contractors.test.mjs` (inşaat talebi, eski veritabanına sütun ekleme).

## API

| Yol | Ne yapar |
| --- | --- |
| `GET/PUT/DELETE /api/contractors/mine` | Üyenin firması (GET ayrıca yeni talep sayısı); PUT oluşturur veya düzenler |
| `GET/POST /api/contractors/mine/land` | Firmaya gelen talepler; `offer` / `pass` |
| `GET/POST/PATCH /api/contractors/land` | Üyenin talepleri ve teklifleri, yeni talep, `accept` / `close` |
| `GET/POST /api/admin/contractors` | Yönetim: durum listesi, approve / reject / suspend / verify / unverify / feature / unfeature |

## Örnek firmalar

Ana sayfadaki üç kurgusal inşaat firması (Akdeniz Atlas Yapı, Ege Form Yapı, Marmara Kent Proje, `public/developers` fotoğraflarıyla) gerçek firma sayısı bir sayfadan azken "Örnek müteahhit profilleri" bölümünde etiketli gösterilir; sayılmaz, indekslenmez, site haritasına girmez, talep almaz. Lansmanda `CONTRACTOR_SAMPLES=0`.

## Testler

`tests/contractors.test.mjs` (onay akışı, doğrulama, arama, kat karşılığı teklif ve kabul, sınırlar, süre dolması, silme, medya, örnekler; `node:sqlite`).

## Hesap türü (2026-11-13)

Bir hesap tek türdür: Bireysel, Emlakçı, Müteahhit veya Hizmet firması (`lib/account-kind.ts`). Müteahhit ve hizmet firması türü kayıtta seçilir ya da Hesabım › Profilim › Hesap türü'nden değiştirilir; `users.role` değişmez (`buyer`), tür `account_kinds` tablosunda tutulur (ilk kullanımda oluşur). Yeni firma yalnızca o türdeki hesapla açılır; emlakçılar açamaz. Mevcut firmalar düzenlenebilir kalır ve eski hesapların türü sahip oldukları firmadan çıkarılır. Her türün kendi Hesabım menüsü vardır (`lib/account-panel.ts`).

## Firma paneli ve istatistikler (2026-11-13)

Müteahhit hesabının paneli Müteahhitler alt sitesinin içindedir: `/muteahhitler/panel` (`CONTRACTOR_PANEL`). Panelde Profil, Kat karşılığı talepleri ve İstatistikler sekmeleri vardır. `contractor_firm_stats` (`lib/firm-stats.ts`): aramalarda görünme, profil görüntülenme, telefon/WhatsApp/e-posta/web sitesi tıklaması (`POST /api/contractors/track`), gelen kat karşılığı talebi ve gönderilen teklif (sunucu sayar).

## Almanya (2026-11-16)

Çalışma bölgeleri, aramalar ve teklif formu Türkiye illerinin yanında Almanya şehirlerini de kabul eder (`lib/service-locations.ts`, 82 şehir, ilçe yok). Şehir adı olduğu gibi saklanır; ülke addan anlaşılır, veritabanı değişmedi. Şehir seçimlerinde iller "Türkiye", şehirler "Almanya" başlığı altında gruplanır. Kat karşılığı talepleri Türk uygulamasına özgü olduğu için yalnızca Türkiye illeriyle kalır.
