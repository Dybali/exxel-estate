# CRM (Hesabım)

Emlakçı panelinde **CRM** sekmesi; bireysel ilan verenlerde **İlan istatistikleri**. Alt bölümler: İstatistikler (`components/CrmStats.tsx`), Müşteri talepleri (`LeadsPanel`), Randevular (yalnızca emlakçı). Eski `?tab=talepler` / `?tab=randevular` bağlantıları buraya açılır (`?bolum=`).

## İstatistikler (`lib/crm-stats.ts`, `GET /api/crm/stats?days=7|30|90`)

Yalnızca hesabın kendi ilanları. Ölçülenler:

| Ölçüm | Kaynak |
|---|---|
| Görüntülenme | `listing_view_daily` (kişi başına günde bir; çerez izni olmayan ziyaretçi sayılmaz) |
| Favori | `favorites.created_at` |
| Telefon / WhatsApp | `listing_event_daily` (yeni; `POST /api/listings/[id]/event`, `components/ContactCard.tsx`) |
| Mesaj atan kişi | `messages` (konuşma başına bir kişi) |
| Randevu talebi | `appointments` |
| Ziyaretçi dili | sayılan her görüntülenmenin sayfa dili (`listing_event_daily`, kind `view`) |

`listing_event_daily` ilk kullanımda oluşur; ziyaretçi, gün ve türle birlikte özetlenmiş bir kimlik (`actor_hash`) tutar, kişiyi tanımlayan bilgi tutmaz. Üye hesabıyla, misafir yalnızca analiz çerezi izniyle sayılır; botlar ve ilan sahibi sayılmaz.

Ekran: önceki döneme göre değişim, günlük görüntülenme/iletişim grafiği, satış hunisi (görüntülenme → favori → iletişim → randevu), ziyaretçi dilleri, 24 saattir yanıt bekleyen müşteri sayısı ve ilan başına 0–100 "ilan sağlığı" puanı ile öneriler. En çok ilgi isteyen ilan üstte.

**Öneriler kurallarla üretilir** (yapay zekâ çağrısı yok, maliyeti sıfır): benzer ilanların (aynı şehir ve emlak tipi, en az 3 yayındaki ilan) ortalamasının yarısından az görüntülenme, 40+ görüntülenme ama iletişim yok, dönüşüm %1'in altında, favori var iletişim yok, 60+ gündür yayında ve son 7 günde görüntülenme yok, 6'dan az fotoğraf, 300 karakterden kısa açıklama; olumlu: yabancı dilde ziyaret ≥ %30, benzerlerinin 2 katı görüntülenme, dönüşüm ≥ %5. Puan: 100'den her uyarı 20, her ipucu 8 düşer.

Sonraki adımlar (planlanan): Kişiler (müşteri kartları), Fırsatlar (satış hunisi panosu), Görevler, otomatik eşleştirme.

Testler: `tests/crm-stats.test.mjs`.

## Genel Bakış: emlakçı performans paneli (2026-11-23)

Sahibinin isteğiyle (profesyonel emlak paneli örneği) emlakçı hesabının ve yönetici hesabının **Hesabım › Genel Bakış** sekmesi tek ekranlık bir performans paneli oldu. Bireysel, müteahhit ve hizmet firması hesaplarında eski sade özet kalır. Kod: `lib/agent-overview.ts`, `GET /api/crm/overview?days=7|30|90`, `components/AgentOverview.tsx`, stiller `app/overview.css` (panel genişliğine göre düzen, container query; telefonda tek sütun ve kart görünümlü tablo).

Bölümler, hepsi gerçek veriden (tahmini veya uydurma sayı yok; site satış/komisyon kaydı tutmadığı için gelir, gider ve "kapanan iş" gösterilmez):

- **Üst sayılar:** yayındaki ilan (incelemede / süresi dolan), görüntülenme ve iletişim (önceki döneme göre % değişim; telefon, WhatsApp, mesaj kırılımı), 24 saati geçen yanıt bekleyen müşteri.
- **Görüntülenme ve iletişim grafiği:** günlük seri, üzerine gelince gün ayrıntısı.
- **En çok ilgi gören ilan:** fotoğraf, fiyat (ziyaretçinin para birimiyle), görüntülenme/favori/iletişim, ilan sağlığı puanı ve ilk öneri (`crmStats` kuralları).
- **Satış hunisi:** görüntülenme → favori → iletişim → randevu; halka, iletişime dönüşme oranını gösterir (%10 = tam halka).
- **Bugün yapılacaklar:** yanıt bekleyen müşteriler, onay bekleyen randevular, Talep akışındaki yeni talepler (`boardUnseen`, okundu işaretlemez), 7 gün içinde süresi dolacak ilanlar, taslaklar. Her satır ilgili sekmeyi açar.
- **Yaklaşan randevular:** önümüzdeki 7 günün şeridi ve 14 günlük liste (talep edilmiş veya onaylanmış).
- **İlanlarım tablosu:** arama ve durum filtresi; fiyat, görüntülenme, iletişim, sağlık puanı, durum ve kalan gün.
- **Son müşteriler:** ilanlar için yazan son kişiler, "Yanıt bekliyor" işareti ve mesaja geçiş.
- **Ziyaretçi dilleri:** bayraklarla yüzdeler.

Hesabım'ın tamamı da aynı tarzda (sahibinin isteği, 2026-11-23): emlakçı ve yönetici hesabında üstteki karşılama bandı yerine üst çubuk (sayfa başlığı, tarih, okunmamış mesaj zili, yardım, Yeni ilan ver, profil), yapışkan ikonlu menü (koyu yeşil seçili sekme), açık yeşil zemin ve her sekme beyaz yuvarlak kart içinde; sekmelerin kendi başlığı üst çubukta tekrarlanmaz. `components/Dashboard.tsx` (`account-pro`), stiller `app/account-pro.css`. Telefonda menü yatay kaydırmalı şerittir. Bireysel ve firma hesapları eski görünümde kalır.

Testler: `tests/agent-overview.test.mjs`.
