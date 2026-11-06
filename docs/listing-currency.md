# İlan fiyatları: TL esas fiyat ve gösterim para birimi (TCMB)

Sahibinin kararı (2026-11-06). Kapsam yalnızca ilan fiyatlarıdır: paket/abonelik fiyatları, siparişler ve ödemeler, geçmiş istatistikler değişmez. Gösterilen döviz tutarları bilgi amaçlıdır; sözleşme ve ödeme para birimi değildir. Sitede hukuki uygunluk iddiası yoktur.

## Fiyat girişi: yalnızca TL

- İlan verme formu (`components/PostListing.tsx`), düzenleme (`components/ListingEditor.tsx`) ve XML içe aktarma (`lib/listing-import.ts`) fiyatı yalnızca TL olarak alır. XML'de `currency` özniteliği yoksa TRY sayılır, `TL` de kabul edilir; başka para birimi satır hatasıdır.
- API: `POST /api/listings` ve `PUT /api/listings/[id]` TRY dışındaki para birimini `İlan fiyatı yalnızca Türk lirası (TL) olarak girilebilir.` hatasıyla reddeder (`lib/price-filters.ts` `listingCurrencyAllowed`). Taslaklar da yalnızca TRY saklar.
- Saklanan fiyat (`listings.price`, `currency='TRY'`) esas fiyattır. Kur değişimi saklanan fiyatı asla değiştirmez; döviz tutarları yalnızca gösterim için hesaplanır.

## Eski (EUR/USD/GBP) ilanlar

- Kod, `currency` alanı TRY olmayan satırları değiştirmeden okumaya devam eder (Neon'daki Cloudflare yayını dahil). Gösterim, filtre ve sıralamada TL karşılığı aynı istekteki TCMB bülteniyle hesaplanır: SQL'de `CASE l.currency WHEN 'EUR' THEN <kur> ...` (`lib/listing-sort.ts` `tlPriceSql`), bellekte `tlPrice`. Bültende kuru olmayan para birimi sıralamada sona düşer, fiyat aralığına girmez.
- Bu ilanlar düzenlenirken fiyat yeniden TL olarak girilir (form eski tutarı ve TCMB karşılığını ipucu olarak gösterir). Fiyata dokunmayan güncelleme para birimini değiştirmez.
- **Tek seferlik dönüşüm (sahibinin onayı, 2026-11-06):** `postgres/migrations/020_listing_prices_try.sql` (SQLite/D1: `drizzle/0027_listing_prices_try.sql`). TCMB bülteni 2026/208, 05.11.2026, ForexSelling/Unit; `price = ROUND(price × kur)`, `currency='TRY'`, `updated_at`, ilan başına iki `price_history` satırı (eski para biriminde eski fiyat, 1 ms sonra TL fiyat; API'nin para birimi değişikliği biçimi). Yalnızca `currency <> 'TRY'` ve kuru olan satırlar; ikinci çalıştırma bir şey değiştirmez. PostgreSQL'de `individual_listing_policy` tetikleyicisi bu tek komut için kapatılır (yayın süresi değişmesin diye). Mittwald konteynerinde açılışta otomatik ve bir kez uygulanır.
  - **Neon'a uygulanmaz** (Cloudflare yayını Neon'u kullanır; Neon'daki satırlar dönüşmez, kod onları yukarıdaki gibi gösterir). `scripts/neon-migrate.mjs` bu dosya için uygun değildir (işlem dışında, `;` ile bölerek çalışır).
  - Başlangıç çalıştırıcısı (`lib/postgres-migrations.ts` `pendingMigrations`) bir dosyayı yalnızca adına göre `schema_migrations` tablosunda arar. Neon'dan Mittwald'a sonradan yeni bir veri kopyası alınırsa ve kopyadaki `schema_migrations` 020'yi içermezse, 020 o veride tekrar çalışır: Neon'da o anda TRY olmayan satırlar aynı 05.11.2026 kurlarıyla dönüşür (o kopya için bir kez).
  - SQLite aynası tetikleyiciyi kapatamaz: yayında olup süresi geçmiş satırlar orada atlanır.

## Gösterim para birimi

- Varsayılan (ziyaretçi seçmediyse) dile göre: tr→TRY, de/fr/nl→EUR, en→GBP (sahibinin kararı, 2026-11-06), ru→RUB, fa→IRR, ar→SAR (`lib/display-currency.ts`). IRR'yi TCMB yayımlamaz: Farsça varsayılanda fiyatlar TL kalır ve desteklenen para birimleri önerilir.
- Başlıktaki "Para birimi / ülke" seçicisi (`components/DisplayCurrency.tsx` `CurrencySwitch`, dil seçicinin yanında; Hizmetler alt sitesinde fiyat olmadığı için yok): para birimleri TRY, EUR, USD, GBP, RUB, SAR, AED; ülkeler Türkiye, Birleşik Krallık, ABD, Suudi Arabistan, BAE, Rusya ve euro bölgesi ülkeleri. "Dile göre" seçimi açık tercihi siler.
- Açık seçim `localStorage` (`em24:currency`) ve zorunlu tercih çerezi `em24_currency` (1 yıl, çerez politikasında) ile saklanır; sunucu çerezi okuyarak doğru para birimini ilk çizimde gösterir. Dil seçicide dil değiştirilince açık seçim silinir ve yeni dilin varsayılanı uygulanır (sahibinin isteği, 2026-11-06); para birimi dil seçildikten sonra ayrıca değiştirilirse o seçim bir sonraki dil değişikliğine kadar korunur. Eski `em24:display-currency` ayarı açık seçim sayılmaz, silinir.
- Fiyatın göründüğü her yer (kartlar, ilan detayı, favoriler, karşılaştırma, benzer ilanlar, bölge sayfası istatistikleri, fiyat geçmişi, harita etiketleri, keşif bildirimleri) seçili para birimini kullanır. TL seçiliyse ve dönüşüm yoksa yalnızca TL, kaynak notu olmadan. Biçim `Intl.NumberFormat` (arayüz dili), yuvarlama yalnızca gösterimde (10 000 altı tam birim, sonra yüzlük, milyondan itibaren binlik), tutarlar `<bdi>` ile yalıtılır (ar/fa).
- Dönüştürülmüş tutarın altında: "Kaynak: TCMB · Kur tarihi: GG.AA.YYYY" (TCMB bağlantısı, "Türkiye Cumhuriyet Merkez Bankası" ipucu) ve "Yaklaşık karşılıktır. Esas ilan bedeli TL’dir."; ilan detayında ayrıca "Esas fiyat: ₺…". Kartlarda kısa sürüm.
- Fiyat filtresi: ziyaretçi tutarı gösterim para biriminde girer (`currency` parametresi artık yalnızca aralığın para birimidir, ilanları para birimine göre süzmez), sunucu aynı bültenle TL'ye çevirip TL esas fiyatla karşılaştırır. Kayıtlı aramalar ve e-posta özeti de aynı şekilde çalışır. Fiyat sıralaması her zaman TL esas fiyata göredir.

## TCMB kurları

- Kaynak `https://www.tcmb.gov.tr/kurlar/today.xml` (`lib/tcmb.ts`): her para birimi için `ForexSelling / Unit` = 1 birim için TL; gösterim tutarı = TL fiyat / kur. Tarih, bültenin `Tarih` özniteliğidir (bugünün tarihi değil); hafta sonu ve tatilde son yayımlanan bülten kendi tarihiyle gösterilir. 21 günden eski veya ileri tarihli bülten kullanılmaz.
- Önbellek (`lib/tcmb-server.ts`): işlem/isolate başına bellekte; TCMB en fazla 15 dakikada bir yeniden sorulur, eşzamanlı istekler tek çağrı paylaşır. Cloudflare'de son iyi bülten ayrıca standart Cache API'de tutulur (Node/Mittwald'da yalnızca bellek). Sayfa en fazla 1,5 saniye bekler; daha yavaş kontrol arka planda tamamlanır.
- Bir istek tek bülten kullanır (`requestRates`, React `cache`): layout bu bülteni `CurrencyProvider`'a verir, açık sayfa `/api/exchange-rates`'i 15 dakikada bir yeniden okur ve tüm tutarlar birlikte güncellenir.
- Kesinti: TCMB'ye ulaşılamazsa son iyi bülten kendi tarihiyle ve "Kur verisi şu anda yenilenemiyor" uyarısıyla gösterilir; kullanılabilir bülten yoksa fiyatlar yalnızca TL'dir. Asla "anlık piyasa kuru" denmez.
- Ana sayfadaki kur şeridi de aynı TCMB verisini kullanır ("Kaynak: TCMB"). open.er-api.com ve ECB kaynakları kaldırıldı.
- Belirsizlik: TCMB'nin Cloudflare Workers ve Mittwald'dan erişilebilirliği canlıda doğrulanmalı (`/api/exchange-rates` 503 dönüyorsa erişim yok demektir; site TL ile çalışmaya devam eder).

## Testler

`tests/tcmb-rates.test.mjs` (XML ayrıştırma, birim, eksik/sıfır/negatif değerler, dönüşüm ve yuvarlama, hafta sonu, önbellek/15 dakika/hata/eski veri, dil varsayılanları, desteklenmeyen para birimi, biçim ar/fa dahil, filtre dönüşümü SQLite), `tests/listing-sort.test.mjs` (TL esaslı sıralama, eski satırlar), `tests/listing-currency-migration.test.mjs` (dönüşüm, geçmiş satırları, tekrar çalıştırma, çalıştırıcı), `tests/individual-direct-publication.test.mjs` (API TRY dışını reddeder), `tests/listing-import.test.mjs`.
