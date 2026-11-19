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

`lib/home-requests.ts`, `lib/home-request-emails.ts`, `app/api/home-requests`, `components/HomeRequestForm.tsx`, `components/HomeRequestsPanels.tsx`. 2026-11-19: kullanıcı tarafı yenilendi (danışman tarafı ayrıca ele alınacak).

### Form (4 adım, giriş yapmış ve e-postası doğrulanmış üye)

1. **Ne arıyorsunuz?** Satın alma/kiralama, kategori (konut, arsa, iş yeri), gayrimenkul tipleri (çoklu; boşsa hepsi), oda sayısı (en fazla 3), en az brüt m².
2. **Nerede?** İl ve en fazla 3 ilçe (boşsa ilin tamamı); olmazsa olmazlar (`HOME_FEATURES`, en fazla 10; "Krediye uygun" yalnızca satın almada, "Evcil hayvan kabul" yalnızca kiralamada).
3. **Bütçe ve zamanlama:** bütçe veya aylık kira aralığı, zamanlama (hemen, 1–3 ay, 3–6 ay, sadece bakıyorum), satın almada ödeme şekli (nakit, kredi onaylı, kredi kullanacak, takas), yabancı alıcı ve satın almada yatırımla vatandaşlık amacı.
4. **İletişim:** özet, not, ad, e-posta, telefon; iletişim tercihi (telefon, WhatsApp, e-posta; ilk ikisi telefon ister) ve uygun saat; "yeni ilanlar için haber ver" (varsayılan açık) ve **açık paylaşım onayı** (zorunlu).

Ayrıntılar `home_request_details` tablosunda JSON (ilk kullanımda oluşur; eski taleplerin satırı yoktur). Eski `district` ve `rooms` sütunları ilk ilçe ve virgüllü oda listesiyle dolmaya devam eder.

### Eşleşme ve sonrası

- Danışmanlar: yayında o tür (seçilen tipler, yoksa kategori) ilanı olan onaylı emlakçılar; önce seçilen ilçeler, sonra il; ilan sayısına göre en fazla 8. Kimse yoksa talep kaydedilmez.
- Gönderince: "Şu an uyan ilanlar" (aramanın ifade edebildiği kadarıyla: tek ilçe/tip/oda seçildiyse o, bütçe ve m²; `homeRequestSearch`) ve "haber ver" açıksa aynı arama **kayıtlı arama** olur (e-posta özeti ve Bildirimler; hesap başına 10 sınırı geçerli).
- Danışmanlar e-posta alır ve **Hesabım › CRM** sekmesinde talebi ayrıntı etiketleriyle (zamanlama, ödeme, yabancı alıcı, olmazsa olmazlar, iletişim tercihi) görür.
- Üye **Hesabım › Aramalarım** sekmesinde: iletildi → gördü → size döndü sayıları, dönen danışmanlar (profil bağlantısıyla), "Uyan ilanları gör", **kapatma nedeni** (bu siteden buldum, başka yerden buldum, erteledim, diğer), **30 gün uzat / yeniden aç** (şimdiden en fazla 90 gün).
- Talep 30 gün sonra kapanır; kapalı/süresi dolmuş talepte iletişim bilgisi danışmana gösterilmez.
- Sınırlar: üye başına günde 3 talep; 15 dakikada 20 istek.

Tablolar ilk kullanımda: `home_requests`, `home_request_agents`, `home_request_details`. Gizlilik politikasında "Benim için bul talepleri" maddesi (2026-11-19 güncel).

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
