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
