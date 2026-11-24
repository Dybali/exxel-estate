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

### Talep akışı: serbest piyasa (2026-11-19, sahibinin kararı)

`lib/lead-board.ts`, `app/api/lead-board`, `components/LeadBoard.tsx` (Hesabım › CRM › "Talep akışı").

- **Eşleştirme yok.** Talep, iletişim bilgisi ve not olmadan, bütün onaylı emlakçıların gördüğü açık panoya düşer. Bölge veya portföy kısıtı yoktur; danışman istediği talebi seçer.
- Pano: en yeni üstte, sayfa başına 30. Filtreler il, satılık/kiralık, kategori, **Sıcak** (hemen alacak/taşınacak, nakit veya kredi onaylı), **Yabancı alıcı** (dil adıyla), **Ulaştıklarım**. Üstte açık talep sayısı, bu ay ulaşılan, ortalama (medyan) dönüş süresi ve paket.
- **Ulaşma:** "Teklif gönder" (en az 20 karakter mesaj ve isteğe bağlı en fazla 3 kendi yayındaki ilanı) danışmana adı ve notu açar. "Telefonu aç" e-posta ve telefonu açar; alıcı kimin açtığını görür. İkisi de danışmanı talebin listesine yazar (`home_request_agents`, state `contacted`). **Bir talebe en fazla 4 danışman**; dolunca "Dolu". Kapalı/süresi dolmuş talebe ulaşılamaz.
- Alıcı teklifleri **Hesabım › Aramalarım**'da görür: danışman (profil bağlantısı, ofis, "Hızlı yanıt" rozeti), mesaj, önerilen ilanlar; numarasını açanlar ayrıca yazar. Teklif gelince alıcıya e-posta (mesaj tercihine uyar).
- **Hızlı yanıt:** son 90 günde en az 3 talebe ulaşmış ve medyan dönüşü 2 saat veya altı.
- **Kapatma:** neden (bu siteden buldum, başka yerden buldum, erteledim, diğer); "bu siteden buldum"da talebe ulaşmış danışmanlardan hangisiyle bulduğu seçilebilir (`foundWith`, istatistik için).
- **İl takibi:** danışman en fazla 10 il seçer; yeni talep o ildeyse e-posta gelir. Seçim yoksa yayındaki ilanlarının bulunduğu iller kullanılır. Panonun okunmamış sayısı `GET /api/lead-board?count=1`.
- **Paketler, `LEAD_PLANS=1` (varsayılan kapalı):** kapalıyken bütün onaylı emlakçılar serbestçe ulaşır. Açıkken paketsiz danışman panoyu görür ama ulaşamaz (kilitli kart, "Paketleri gör"); **Profesyonel ayda 20**, **Prestij ayda 60** talebe ulaşır (takvim ayı, talep başına bir kez sayılır); yeni talepler ilk **24 saat yalnızca Prestij**'e açıktır. Paket bilgisi `agent_plan_grants` tablosundan.
- Sınırlar: üye başına günde 3 talep; talep 30 gün açık, uzatmayla en fazla 90 gün; danışman başına 15 dakikada 40 işlem.

Tablolar ilk kullanımda: `home_requests`, `home_request_agents`, `home_request_details`, `home_request_offers`, `home_request_reveals`, `agent_lead_follows`. Gizlilik politikasında "Benim için bul talepleri" maddesi açık panoya göre güncel (2026-11-19). Testler: `tests/lead-board.test.mjs`.

## Konut değerleme: `/konut-degerleme`

`lib/valuation.ts`, `app/api/valuation`, `components/ValuationTool.tsx`. Üyelik gerekmez. Yayındaki satılık ve kiralık ilanlardan (diğer para birimleri TCMB kuruyla TL'ye çevrilir): önce ilçe (en az 5 ilan), yoksa il; benzer büyüklük (±%35) yeterliyse onlar. m² fiyatının çeyrekleri → değer aralığı, ortanca → tahmin; kiralıklardan aylık kira, brüt getiri ve geri dönüş süresi. Sayfa bunun ekspertiz olmadığını açıkça yazar.

## Sezonluk kiralık: `/ilanlar?purpose=gunluk`

2026-11-17: `/sezonluk-kiralik` buraya kalıcı olarak yönlenir. Sonuçlar satır satır listelenir (fotoğraf solda, `ListingCard layout="row"`; arama sayfasında Kart / Liste düğmeleri), üstte tatil bölgesi kısayolları ve izin belgesi notu. Aşağıdaki eski açıklama tarihçe içindir.

### Eski tanıtım sayfası

Var olan "Turistik günlük kiralık" (`purpose = gunluk`) ilan türü için tanıtım sayfası: popüler tatil yerleri (`lib/seasonal-rentals.ts`) ve her birinde yayındaki ilan sayısı. 7464 sayılı Kanun gereği 100 güne kadar turizm amaçlı kiralamada Kültür ve Turizm Bakanlığı izin belgesi gerektiği ev sahiplerine hatırlatılır. **Öneri:** günlük kiralık ilan formuna zorunlu "izin belgesi numarası" alanı eklenmeli.

## Danışmanlar: `/danismanlar`

`lib/agent-directory.ts`, `app/api/agents`, `components/AgentDirectory.tsx`, `components/AgentLanguagesSetting.tsx`. En az bir yayındaki ilanı olan onaylı emlakçılar, ilan sayısına göre. Filtreler: il, ilçe (ilan konumuna göre), konuştuğu dil, ad/ofis (GET formu, her filtrenin kendi adresi var, sunucuda çizilir). Kart: fotoğraf, ad, ofis, en çok ilanının olduğu il/ilçe, ilan sayısı, diller, belge doğrulama rozeti, "Telefonu göster" (`GET /api/agents?phone=`), profil bağlantısı. Emlakçı dillerini **Hesabım › Profilim › Konuştuğum diller**'den seçer (`agent_languages`, ilk kullanımda oluşur; dil adları ziyaretçinin dilinde `Intl.DisplayNames` ile).

2026-11-23 yenilemesi (Emlakjet/Hepsiemlak/Properstar örneğiyle, sahibinin isteği): satır düzeni ve **Danışmanlar / Ofisler** geçişi (`?gorunum=ofisler`, `listOffices`).
- Danışman satırı: fotoğraf + bağlı ofisin logosu, ad, bağlı olduğu ofis (ekip üyeliği, yoksa sahibi olduğu onaylı ofis; ofis profiline bağlantı, yoksa "Bağımsız danışman"), bölge, konuştuğu diller (bayraklarla), danışmanın kendi tanıtım yazısından ilk satırlar (**Hesabım › Profilim › Hakkımda**, `seller_profiles.bio`, `shortAbout` ile 220 karakter), istatistikler (aktif ilan, ortalama TL satış fiyatı, son 3 ayda eklenen ilan), "Hemen ara" ve "Profil ve ilanlar", Prestij/Profesyonel paketinde şerit (`agent_plan_grants`).
- Ofis satırı: logo, ofis adı, bölge, danışman sayısı (sahip + ekip), ilan sayısı, son 3 ay, ekibin dilleri.
- Profil sayfası `/profil/<id>` (ilan sayfasındaki danışman kutusundan açılır): ofise bağlı danışmanda adın altında ofis bağlantısı (`/sirketler/<id>`) ve iki sekme, **Danışmanın ilanları** / **Ofisin tüm ilanları** (`GET /api/profiles/<id>?liste=ofis`; ofis sahibinin ve aktif ekip üyelerinin ilanları, `lib/seller-profiles.ts` `profileOffice`, `OFFICE_LISTINGS_SQL`). Ekip üyesi danışmanların hesap rolü alıcı/bireysel kalsa da profilleri açıktır (`TEAM_CONSULTANT_SQL`).
- Filtreler: il, ilçe, dil, ilan türü (`tur`: satılık/kiralık), uzmanlık (`uzmanlik`: konut, iş yeri, arsa, turistik), sıralama (`sira`: önerilen = belgeli önce, en çok ilan, son 3 ayda en aktif, ortalama fiyat), ad veya ofis.

## Testler

`tests/buyer-owner-tools.test.mjs` (hesaplamalar, değerleme, Benim için bul, danışman dizini, sezonluk), `tests/search-categories.test.mjs` (fiyatı düşen filtresi).

## Benim için bul: premium sunum ve talep bülteni (2026-11-24)

Sahibinin isteğiyle Benim için bul premium hizmet olarak öne çıkarıldı:
- **Ana sayfa:** hızlı bağlantıların hemen altında koyu yeşil premium bölüm (`components/HomeFindForMe.tsx`, `app/find-for-me.css`): üç adım, güven maddeleri (numara izin verilene kadar gizli, en fazla 4 danışman, ücretsiz), "Talebimi oluştur" ve emlakçılar için "Talep bültenine katılın" (`/paketler`). Sağdaki teklif görseli bir örnektir ve "Örnek görünüm" diye etiketlidir. Ana sayfa turunda ayrı bir adımı var.
- **Talep akışı (bülten):** `components/LeadBoard.tsx`, `app/lead-board.css`. Üstte paket kutusu (Prestij/Profesyonel, bu ay kullanılan/sınır çubuğu, yükseltme), sayılar (açık talep, son 24 saatte yeni, sıcak, ortalama dönüş; `leadBoard` sonucundaki `summary`), filtre çubuğu (Tümü/Satılık/Kiralık, il, kategori, Sıcak, Yabancı alıcı, Ulaştıklarım, yenile), kartlarda Yeni/Sıcak rozetleri, bütçe, etiketler ve 4 danışman yeri göstergesi; yan sütunda takip edilen iller ve ipuçları. Hesabım içinde sekme panel zeminine oturur.
