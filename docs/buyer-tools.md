# Alıcı ve mal sahibi araçları (2026-11-17)

hepsiemlak.com incelemesinden sonra sahibinin isteğiyle eklendi. Ana sayfada "Araçlar" bölümü (`components/HomeTools.tsx`), alt bilgide "Araçlar" sütunu, üst menüde "Danışmanlar". Sayfa başlıkları `lib/seo-copy.ts`, hepsi site haritasında. Ortak stiller `app/tools.css`.

## Hesaplama araçları: `/hesaplama-araclari`

`lib/property-calculators.ts`, `components/PropertyCalculators.tsx`. Üç araç, sayfa içi bağlantılarla (`#kira-artisi`, `#tapu-harci`, `#tapu-masrafi`).

- **Kira artışı:** üst sınır TÜFE'nin 12 aylık ortalama değişimi (TBK md. 344; konut kiralarındaki %25 sınırı 2024 Temmuz'da bitti). Oran her ay değişir, ziyaretçi girer. Sunucu ayarı `RENT_INCREASE_RATE` (ör. `34.88`) ve `RENT_INCREASE_MONTH` (ör. `2026-10`) alanı önceden doldurur; **sahibi her ay TÜİK açıklamasından sonra günceller**. Ayar yoksa alan boş gelir.
- **Tapu harcı:** alıcı ve satıcı ayrı ayrı binde 20 (492 sayılı Harçlar Kanunu). "Tamamını alıcı öder" seçeneği anlaşmalar içindir.
- **Tapu masrafları:** alıcının harç payı + döner sermaye + DASK + ekspertiz + emlakçı bedeli (%10 üstü yok sayılır). Döner sermaye her yıl değişir; `DEED_REVOLVING_FEE` önceden doldurur.

## Fiyatı düşenler: `/fiyati-dusen-ilanlar`

`/ilanlar?priceDrop=1`'e kalıcı yönlendirme. Filtre `lib/search-categories.ts` (`priceDrop`, `PRICE_DROP_DAYS = 30`): ilanın son fiyat değişikliği son 30 günde, aynı para birimi ve ilan türünde bir düşüş. `price_history` tablosu `PUT /api/listings/[id]` ile zaten doluyor. İlan aramasının filtrelerinde "Son 30 günde fiyatı düşenler" kutusu.

## Benim için bul: `/benim-icin-bul`

`lib/home-requests.ts`, `lib/home-request-emails.ts`, `app/api/home-requests`, `components/HomeRequestForm.tsx`, `components/HomeRequestsPanels.tsx`.

1. Giriş yapmış, e-postası doğrulanmış üye: satın alma/kiralama, il, ilçe, kategori, oda, bütçe, not, ad, e-posta, telefon ve **açık paylaşım onayı** (zorunlu).
2. Eşleşme: yayında o tür (satılık/kiralık, kategori) ilanı olan onaylı emlakçılar; önce ilçe, sonra il; ilan sayısına göre en fazla 8 danışman. Kimse yoksa talep kaydedilmez.
3. Danışmanlar e-posta alır (mesaj e-postası tercihine uyar) ve **Hesabım › CRM** sekmesinin başında "Müşteri talepleri"ni görür: telefon, WhatsApp, e-posta; "İletişime geçtim" / "Geç".
4. Üye talebini **Hesabım › Aramalarım**'da görür ve kapatabilir. Talep 30 gün sonra kapanır; kapalı/süresi dolmuş talepte iletişim bilgisi danışmana gösterilmez.
5. Sınırlar: üye başına günde 3 talep; 15 dakikada 20 istek.

Tablolar ilk kullanımda: `home_requests`, `home_request_agents`. Gizlilik politikasında "Benim için bul talepleri" maddesi var.

## Konut değerleme: `/konut-degerleme`

`lib/valuation.ts`, `app/api/valuation`, `components/ValuationTool.tsx`. Üyelik gerekmez. Yayındaki satılık ve kiralık ilanlardan (diğer para birimleri TCMB kuruyla TL'ye çevrilir): önce ilçe (en az 5 ilan), yoksa il; benzer büyüklük (±%35) yeterliyse onlar. m² fiyatının çeyrekleri → değer aralığı, ortanca → tahmin; kiralıklardan aylık kira, brüt getiri ve geri dönüş süresi. Sayfa bunun ekspertiz olmadığını açıkça yazar.

## Sezonluk kiralık: `/ilanlar?purpose=gunluk`

2026-11-17: `/sezonluk-kiralik` buraya kalıcı olarak yönlenir. Sonuçlar satır satır listelenir (fotoğraf solda, `ListingCard layout="row"`; arama sayfasında Kart / Liste düğmeleri), üstte tatil bölgesi kısayolları ve izin belgesi notu. Aşağıdaki eski açıklama tarihçe içindir.

### Eski tanıtım sayfası

Var olan "Turistik günlük kiralık" (`purpose = gunluk`) ilan türü için tanıtım sayfası: popüler tatil yerleri (`lib/seasonal-rentals.ts`) ve her birinde yayındaki ilan sayısı. 7464 sayılı Kanun gereği 100 güne kadar turizm amaçlı kiralamada Kültür ve Turizm Bakanlığı izin belgesi gerektiği ev sahiplerine hatırlatılır. **Öneri:** günlük kiralık ilan formuna zorunlu "izin belgesi numarası" alanı eklenmeli.

## Danışmanlar: `/danismanlar`

`lib/agent-directory.ts`, `app/api/agents`, `components/AgentDirectory.tsx`, `components/AgentLanguagesSetting.tsx`. En az bir yayındaki ilanı olan onaylı emlakçılar, ilan sayısına göre. Filtreler: il, ilçe (ilan konumuna göre), konuştuğu dil, ad/ofis (GET formu, her filtrenin kendi adresi var, sunucuda çizilir). Kart: fotoğraf, ad, ofis, en çok ilanının olduğu il/ilçe, ilan sayısı, diller, belge doğrulama rozeti, "Telefonu göster" (`GET /api/agents?phone=`), profil bağlantısı. Emlakçı dillerini **Hesabım › Profilim › Konuştuğum diller**'den seçer (`agent_languages`, ilk kullanımda oluşur; dil adları ziyaretçinin dilinde `Intl.DisplayNames` ile).

## Testler

`tests/buyer-owner-tools.test.mjs` (hesaplamalar, değerleme, Benim için bul, danışman dizini, sezonluk), `tests/search-categories.test.mjs` (fiyatı düşen filtresi).
