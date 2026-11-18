# Emlak piyasası: `/emlak-piyasasi` (2026-11-18)

Sahibinin isteğiyle (Emlakjet'in piyasa sayfası örnek alındı). Emlakjet verisini ücretli Endeksa'dan alıyor; biz **ücretsiz resmi veriyi** kullanıyoruz: Türkiye Cumhuriyet Merkez Bankası (TCMB) EVDS.

## Veri (TCMB EVDS3)

| Veri | Seri | Sıklık | Düzey |
|---|---|---|---|
| Konut birim fiyatı (TL/m²) | `TP.BIRIMFIYAT.<IL>` (ör. `IST`, `ANTEP`, `URFA`) | üç aylık | 81 il + Türkiye |
| Değerlemesi yapılan konutların birim kirası (TL/m², aylık) | `TP.BK.<IL>` (ör. `ISTANBUL`) | üç aylık | 81 il + Türkiye |
| Konut fiyat endeksi (KFE) | `TP.KFE.<BÖLGE>` | aylık | 19 bölge + Türkiye |
| Yeni kiracı kira endeksi (YKKE) | `TP.YKKE.<BÖLGE>` | aylık | 19 bölge + Türkiye |

Kodlar EVDS seri listelerinden alındı (`lib/market-stats.ts`, `tests/market-stats.test.mjs`). Fiyat ve kira, bankaların konut kredisi için yaptırdığı değerleme raporlarından hesaplanır; ilan fiyatı değildir. Sayfada kaynak ve bu not yazar.

İstek: `https://evds3.tcmb.gov.tr/igmevdsms-dis/series=A-B&startDate=GG-AA-YYYY&endDate=…&type=json`, anahtar **`key` başlığında** (adreste değil). 20'şer seri, son 6 yıl.

## Kurulum (sahibi)

1. evds3.tcmb.gov.tr'de ücretsiz üye olun, profil sayfasından API anahtarını kopyalayın.
2. Anahtarı gizli ayar **`EVDS_API_KEY`** olarak Mittwald konteynerine (ve yedek için Cloudflare: `npx wrangler secret put EVDS_API_KEY`) kendiniz girin. Sohbete veya repoya yazmayın.
3. Anahtar girildikten sonra sayfa ilk açılışta veriyi arka planda çeker (saatte en fazla bir deneme); sonrasında günlük iş (06:00 UTC / `/api/cron/daily`) 20 saatten eski kaydı yeniler.

Anahtar yokken sayfa "Piyasa verileri hazırlanıyor" der ve konut değerlemeye yönlendirir.

## Saklama ve hesaplar

- Tek satır: `market_stats` (`id='tcmb'`, JSON), ilk kullanımda oluşur (`lib/market-stats-store.ts`). Eksik gelen yanıt (Türkiye serisi yok veya 40'tan az il) kaydedilmez, eski kayıt kalır.
- Yıllık değişim: m² fiyatı ve kira için 4 çeyrek önceye, endeksler için 12 ay önceye göre.
- Brüt kira getirisi = 12 × m² kira ÷ m² fiyat, yalnızca ikisi aynı çeyrekse; amortisman = 100 ÷ getiri.
- İl kartında ilin bulunduğu bölgenin KFE ve YKKE yıllık değişimi.

## Sayfa

`app/emlak-piyasasi/page.tsx`, `components/MarketMap.tsx`, `components/MarketPageParts.tsx`, `app/market.css`. Harita mevcut il şekilleri (`public/turkiye-map-shapes.json`, OpenStreetMap, ODbL) ile SVG: ek harita kütüphanesi yok. Ölçüt sekmeleri (m² fiyat, m² kira, brüt getiri, yıllık değişim), eşit sayılı 6 renk sınıfı, en yüksek 14 il ve seçili il etiketli. Yanda il ayrıntısı, m² fiyat seyri, "{il} ilanlarını gör"; altta sıralanabilir 81 il tablosu. Alt bilgide "Araçlar › Emlak piyasası", site haritasında var.

İlçe ve mahalle düzeyi resmi veride yok; ileride Endeksa gibi ücretli bir kaynak eklenirse aynı sayfaya bağlanır.
