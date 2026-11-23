# Anlık mesajlaşma

Sahibinin isteği (2026-11-23): mesaj karşı tarafa 15 saniyelik kontrolü beklemeden, anında düşer; "yazıyor…" göstergesi ve okundu bilgisi de anında gelir. Dış servis, token veya ek ücret yoktur; her şey Mittwald'daki kendi Node sunucumuzda çalışır.

## Nasıl çalışır

- **Akış:** `GET /api/live` (`app/api/live/route.ts`), giriş yapmış hesabın Server-Sent Events akışı. Tarayıcı sekme başına tek bağlantı açar (`lib/live-client.ts`, `EventSource`); başlıktaki okunmamış sayısı ve mesaj kutusu aynı bağlantıyı kullanır. Sayfalar arasında geçerken bağlantı 3 saniye açık tutulur.
- **Olaylar** (`lib/live-events.ts`): `message` (yeni mesaj: alıcıya ve gönderenin diğer sekmelerine), `read` (okundu: gönderene), `typing` (yazıyor: karşı tarafa). Olaylar yalnızca kimlik taşır (`listingId`, `peerId`), mesaj metni taşımaz; sayfa mesajları her zamanki erişim kontrollü `/api/messages` ile yükler.
- **Yazıyor:** `POST /api/live { action: "typing", listingId, peerId }`; yalnızca iki kişi arasında o ilanda en az bir mesaj varsa ve gönderen/görüşme başına 2,5 saniyede bir. Gösterge 6 saniye sonra kendiliğinden kaybolur.
- **Yedek yol:** Bağlantı yokken (eski tarayıcı, ağ kopması) sayfalar eskisi gibi kontrol eder: açık görüşme 15 sn, liste 20 sn, başlık 30 sn. Bağlantı açıkken bu kontroller 60/90/120 saniyeye iner. Tarayıcı kopan bağlantıyı 5 saniyede yeniden kurar.
- **Sınırlar:** hesap başına en fazla 8 açık akış (fazlası en eskisini kapatır), 25 saniyede bir `: ping` satırı; Mittwald'ın vekil sunucusu için `X-Accel-Buffering: no`.

## Bilinen sınır

Bağlantılar sunucu belleğinde tutulur; site tek konteyner olarak çalıştığı için yeterlidir. Birden fazla konteyner çalıştırılırsa olaylar PostgreSQL `LISTEN/NOTIFY` üzerinden dağıtılmalıdır.

Testler: `tests/live-messaging.test.mjs`.
