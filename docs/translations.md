# İçerik ve mesaj çevirisi (Gemini)

İlan başlığı/açıklaması, blog metinleri ve kullanıcıya gelen özel mesajlar **Google Gemini** ile çevrilir (`gemini-3.5-flash-lite`). 2026-11-12'ye kadar DeepL kullanılıyordu. Sahibi maliyet nedeniyle Gemini'ye geçmeye karar verdi. Gerçek ilanlarla ölçüldü (Yönetim › Çeviri testi, `lib/translation-trial.ts`): 1 milyon çevrilmiş karakter ≈ 1 $, DeepL'de ≈ 20 €. Arayüz metinleri çalışma anında çevrilmez; onlar sözlükte (`lib/i18n-dictionary.ts`).

## Kurulum

- `GEMINI_API_KEY` (estateAI ve doğal dil aramasıyla aynı anahtar). **Faturalandırması açık (ücretli) bir Google Cloud projesinin anahtarı olmalı.** Google, ücretsiz katmanda gönderilen metinleri ürün geliştirmede kullanabilir; ücretli katmanda kullanmaz. Mesajlar kişisel veri olduğundan bu şart.
- İsteğe bağlı: `GEMINI_TRANSLATION_MODEL` (varsayılan `gemini-3.5-flash-lite`).
- Harcama sınırları (çevrilen kaynak karakter, UTC gün/ay): `TRANSLATION_DAILY_CHAR_LIMIT` (varsayılan 2.000.000 ≈ 2 $/gün), `TRANSLATION_MONTHLY_CHAR_LIMIT` (varsayılan 30.000.000 ≈ 30 $/ay). Sınır aşılınca yeni çeviri yapılmaz, ziyaretçi asıl metni görür; ertesi gün/ay kendiliğinden devam eder. Ayrıca Google Cloud Console › Billing › Budgets'tan bütçe uyarısı kurulması önerilir.
- `DEEPL_API_KEY` artık kullanılmıyor; ortamdan silinebilir.

## Ne zaman çevrilir

- **İlanlar bir kez, bütün dillere (sahibinin kararı, 2026-11-12):** yeni, düzenlenen ve onaylanan her ilan sıraya girer ve yayındaysa o gece toplu modda (yarı fiyat) bütün dillere çevrilir (aşağıda). Amaç: arama motorları yabancı dildeki sayfaları hazır metinle görsün, ziyaretçi beklemesin, çeviri masrafı ziyaretçiye/bota bağlı olmasın. İlan başına ≈ 0,7 cent (toplu) / 1,4 cent (normal).
- **Yedek, istendiğinde:** gece işinden önce bir ziyaretçi ilanı başka bir dilde açarsa tarayıcı `POST /api/translations` ile o dili ister; çeviri bir kez yapılır ve saklanır. Blog metinleri ve mesajlar yalnızca bu yolla çevrilir. Yönetici, Yönetim › Çeviriler'den elle de hazırlayabilir.
- **Bir istek, bir dil, ilanın bütün alanları:** eksik alanlar tek Gemini isteğinde çevrilir; model "düşünme" kapalı (`thinkingLevel: minimal`), çünkü düşünme token'ları da ücretlidir.
- **Önbellek:** her alan, hedef dil + metnin özetine göre `content_translations` tablosunda saklanır. Düzenlemede yalnızca değişen alan yeniden çevrilir. Anahtar öneki (`deepl:auto:realestate-v1:`) tarihseldir; DeepL döneminin çevirileri bu sayede geçerli kaldı.
- **Elle girilen çeviriler** her zaman önceliklidir ve üzerine yazılmaz. İlanın kendi dili (`presentation.language`) hiçbir zaman çevrilmez.
- **Kilit:** aynı ilan/dil için eş zamanlı iki istek tek çeviri yapar (`translation_leases`).

## İlanlar: gece toplu çeviri

`lib/translation-batch.ts`. İlan verilince (`POST /api/listings`, XML aktarımı dahil), düzenlenince (`PATCH /api/listings/[id]`) ve yönetici onaylayınca (ilan onayı, ofis belgesi onayı) `translation_batch_queue` sırasına girer (`queueListingTranslation`). Günlük görev (`/api/cron/daily`) sıradaki en fazla 300 ilanın eksik bütün dil çevirilerini tek bir Gemini Batch işi olarak gönderir (`batchGenerateContent`, satır içi istekler, normal fiyatın %50'si). Saatlik görev (`/api/cron/health`) biten işleri toplar ve çevirileri normal önbelleğe (`content_translations`) yazar; Google bir işi en geç 24 saatte bitirir. İş bitene kadar ilanlar istenince çevrilir; zaten çevrilmiş diller işe konmaz.

- Aynı anda tek iş çalışır; işler `translation_batch_jobs` tablosunda izlenir. Başarısız/süresi dolan işin ilanları sıraya geri döner.
- İncelemedeki (`pending`) ilan yayına girene kadar en fazla 7 gün sırada bekler; reddedilen/silinen ilan sıradan çıkar.
- Günlük/aylık karakter sınırları burada da geçerlidir; sınırdaki iş ertesi güne kalır.
- Düzenlenen ilanda yalnızca değişen alanlar çevrilir; diğerleri önbellekte olduğu için işe konmaz.
- **Batch API yalnızca faturalandırması açık (ücretli) projelerde çalışır.** Ücretsiz katman anahtarı `400 FAILED_PRECONDITION` döner. O zaman `translation_batch_mode` "direct" olur ve saatlik görev, o gece sırada olan ilanlardan saatte en fazla 6'sını normal fiyatla tek tek çevirir (`translateQueueDirectly`; ücretsiz katmanın istek sınırlarına göre). Sınır, bekleme veya hata çalışmayı durdurur, ilan sırada kalır. Gece işi her gece yeni ilanlarla Batch API'yi tekrar dener; faturalandırma açılınca kendiliğinden toplu moda (yarı fiyata) döner.

## Bot koruması

`lib/translation-guard.ts`: kayıtlı bir çeviri herkese (arama motorları dahil) ücretsiz verilir. **Yeni (ücretli) bir çeviri** yalnızca şu üç koşul sağlanınca yapılır; sağlanmazsa ziyaretçi/bot asıl metni alır (`status: "original"`), hata almaz:

1. Bilinen bot, tarayıcı önizlemesi, izleme aracı veya betik değil (User-Agent: Googlebot, bingbot, GPTBot, HeadlessChrome, curl, python… ve `Mozilla/5.0` içermeyen her şey). Sosyal uygulamaların uygulama içi tarayıcıları (Instagram, LinkedIn…) gerçek kullanıcıdır ve engellenmez.
2. Gerçek tarayıcı isteği: `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors` ve `Accept-Language` başlıkları (tarayıcılar `fetch()` ile hep gönderir, basit betikler göndermez).
3. Ziyaretçi (IP özeti, `auth_limits`) başına saatte en fazla 20 yeni çeviri (`TRANSLATION_IP_LIMIT`). Gerçek bir ziyaretçi saatte 20 farklı ilanı yeni bir dilde açmaz.

Bunların hepsini aşan bir saldırıda bile günlük/aylık karakter sınırı (yukarıda) harcamayı durdurur. Sonuç: ilanlar zaten gece bütün dillere çevrildiği için Google yabancı dildeki sürümleri kayıtlı çeviriden görür; botlar yeni çeviri masrafı oluşturamaz.

## Mesajlar

`lib/message-translations.ts`: alıcının site diline çevrilir (`POST /api/messages`, `action: "translate"`, en fazla 20 id). Yalnızca `recipient_id`'si oturumdaki kullanıcı olan mesajlar gönderilir. Her (mesaj, dil) bir kez çevrilip `message_translations` tablosunda saklanır, mesajla birlikte silinir. Gönderilmeyenler: zaten okuyucunun dilinde olduğu açık olan metinler (Türkçe harfler, Kiril), harf içermeyen metinler (emoji, sayı, telefon). Gemini kaynak dili de bildirir; aynı dildeyse çeviri gösterilmez.

## Hatalar

Gemini 429 → kısa bekleme (`provider_busy`, 1 dk), 401/403 → `provider_auth`, 400/404 (model yok/kapatıldı) → `provider_config` (1 saat), diğer → `provider_unavailable`. Eksik/bozuk yanıt (sayı tutmayan sonuç, kesilen cevap) saklanmaz. Hata durumunda asıl metin gösterilir. Çeviri token'ları Yönetim › Sistem durumu'ndaki aylık Gemini toplamlarına eklenir.

## Testler

`tests/translation.test.mjs` (önbellek, kilit, sınırlar, Gemini isteği ve hata kodları), `tests/translation-batch.test.mjs` (toplu iş, faturalandırma olmadan saatlik çeviri), `tests/message-translations.test.mjs`, `tests/translation-trial.test.mjs`.
