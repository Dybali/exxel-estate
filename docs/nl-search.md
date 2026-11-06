# Doğal dil araması

Ziyaretçi aradığını kendi cümlesiyle yazar ("Bodrum'da denize yakın, havuzlu, 3+1, 15 milyona kadar satılık villa", "2-bedroom flat for rent in Antalya under 1000 euro"); site bunu `/ilanlar` filtrelerine çevirir. Ana sayfa hero'sunda ve `/ilanlar` üstünde (`components/NaturalSearch.tsx`), ayrıca estateAI sohbetinde "Bu aramayı aç" bağlantısı olarak.

## Akış

1. `POST /api/search/parse` (`app/api/search/parse/route.ts`): `{query, locale, currency?, ai?}` → `{filters, url, chips, ignored, unsupported, ai}`. Yalnızca aynı köken; IP başına (hash'lenmiş) 10 dakikada 30 istek, Worker isolate / Node süreci başına bellek içi sayaç. Sorgu metni saklanmaz, loglanmaz.
2. **Kural tabanlı ayrıştırıcı** (`lib/nl-search.ts`, saf, ağ ve veritabanı yok) her zaman önce çalışır:
   - Katlama: Türkçe ı/İ, aksanlar, Arapça/Farsça harf biçimleri (ي/ی, ك/ک, ة, hemze), Farsça/Arapça rakamlar.
   - Sözlük (8 dil): ilan türü, gayrimenkul tipi ve iş yeri/tesis alt tipi, olanaklar (`AMENITIES`), eşyalı, site içi, krediye uygun, takaslı, kiracılı, Amerikan mutfak, sahibinden/emlakçıdan, sıfır bina, yabancıya uygun, ısıtma, videolu, sanal tur. Uzun ifade önce eşleşir; 4+ harfli kelimelere kısa ek (Türkçe/Rusça/Arapça çekim) izinlidir; bulunamayan kelimeye tek harf hatası toleransı.
   - Yer: `lib/turkey-locations.ts` il/ilçeleri, Türkçe ekler ("Bodrum'da", "Alanyada", "Kadıköy'de"), yabancı yazımlar (Стамбул, إسطنبول, Аланья, Kapadokya…) ve tatil bölgeleri (Kalkan → Kaş + `q=Kalkan`, Mahmutlar → Alanya + `q=Mahmutlar`, Belek, Yalıkavak, Göcek…). Birden çok ilde olan ilçe, verilen ile göre; il yoksa bilinen olan (Kemer → Antalya). Gündelik kelimeyle aynı ilçe adları (Bahçe, Konak, Of, Sur…) yalnızca büyük harfle yazılınca ilçe sayılır.
   - Oda kuralı: N yatak odası → `N+1`, stüdyo → `1+0`. Salonu oda sayan diller (Almanca Zimmer, Fransızca pièces/T3, Rusça комнат, Felemenkçe kamers) N oda → `(N-1)+1`. "En az 3 oda", "3+ bedrooms" → en az o kadar yatak odalı tüm düzenler. "3 oda 1 salon" → `3+1`.
   - Fiyat: "kadar/under/bis/до/حتى/تا/tot" → en çok; "üzeri/over/ab/от/أكثر من/حداقل/vanaf" → en az; "5-10 milyon arası", "between … and …", "от … до …" → aralık; kelimesiz tutar → en çok (bütçe). Birimler: bin/k/тыс/ألف/هزار, milyon/m/Mio./млн/مليون/میلیون, milyar/bn/млрд. Para birimi kelime veya simgeden (TL ₺ lira, euro € avro, dolar $, sterlin £, рубль ₽, ريال → SAR, درهم → AED); yoksa ziyaretçinin gösterim para birimi, Türkçe sayı kelimesi (bin, milyon) varsa TL. İran riyali/tomanı TCMB bülteninde olmadığı için fiyat uygulanmaz, "uygulanamayanlar"da gösterilir.
   - Alan: m²/m2/metrekare/sqm/qm/кв.м/متر → alan; tek değer "en az" sayılır.
   - Filtresi olmayan istekler ("denize yakın", "near the beach", "у моря", "eşyasız", "sessiz"…) uygulanmaz, `unsupported` olarak döner. Anlaşılmayan kelimeler `ignored`.
3. **Gemini (isteğe bağlı)**: `GEMINI_API_KEY` varsa ve ayrıştırıcı en az iki içerikli kelimeyi (veya hiç filtre bulamadığında bir kelimeyi) kullanamadıysa, sorgu (e-posta/telefon maskelenmiş) asistanın modeline (`GEMINI_MODEL`, varsayılan `gemini-3.5-flash-lite`) gider: sıcaklık 0, 6 sn zaman aşımı, yalnızca izinli anahtar ve değerleri içeren JSON şeması (il listesi, tipler, olanaklar, oda düzenleri…). Yanıt `validateNlFilters` beyaz listesinden geçer; bilinmeyen anahtar/değerler atılır. Kural tabanlı sonuç her çakışmada kazanır, AI yalnızca boşlukları doldurur. Hata, zaman aşımı veya kota dolu → yalnızca kural tabanlı sonuç.
4. **Kotalar** (`reserveNlSearchAi`, mevcut `ai_usage_limits` / `ai_monthly_usage` tabloları, şema değişikliği yok): ziyaretçi başına günde 10 AI çağrısı, arama için günlük `NL_SEARCH_DAILY_AI_LIMIT` (varsayılan 200), asistanla ortak `assistant:global:<gün>` sayacında `AI_DAILY_CALL_LIMIT` ve aylık `AI_MONTHLY_CALL_LIMIT`. Yönetim operasyon sayfası toplamı gösterir.

## URL

`nlSearchUrl` yalnızca `/ilanlar` parametrelerini üretir (`components/Explorer.tsx` adlarıyla): `purpose, category, type, businessType, tourismType, city, district, rooms, minPrice, maxPrice, currency, minArea, maxArea, bathrooms, maxAge, heating, furnished, amenities, detailSite, detailCredit, detailSwap, detailUsage, detailKitchen, from, foreignSale, video, tour, q`. Fiyat aralığı girilen para biriminde kalır (`currency`), TL'ye çevirme `/api/listings` içinde aynı TCMB bülteniyle yapılır (`lib/price-filters.ts`). Etiketlerde TL karşılığı "≈" ile gösterilir.

## Testler

`tests/nl-search.test.mjs`: 8 dilde 50+ ifade, oda/fiyat/para birimi kuralları, yer belirsizlikleri, beyaz liste ve enjeksiyon, Gemini isteği (mock), AI hatasında geri dönüş, URL parametreleri, hız sınırı ve kota sayaçları.
