# İçerik ve mesaj çevirisi (OpenAI GPT-6 Luna)

İlan başlığı/açıklaması, blog metinleri ve kullanıcıya gelen özel mesajlar **OpenAI GPT-6 Luna** ile çevrilir (`gpt-6-luna`). Geçmiş: 2026-11-12'ye kadar DeepL, aynı gün Gemini 3.5 Flash-Lite, ardından sahibinin kararıyla Luna. Aynı 10 gerçek ilanla ölçüldü (Yönetim › Çeviri testi, `lib/translation-trial.ts`):

| | 10 ilan, 7 dil | 2,1 milyar karakter |
|---|---|---|
| Gemini 3.5 Flash-Lite (dil başına istek) | 0,0139 $ | ≈ 2.142 $ |
| Luna, dil başına istek (ziyaretçi bir dili açınca) | 0,0051 $ | ≈ 790 $ |
| **Luna, ilan başına tek istek (bütün diller)** | **0,0024 $** | **≈ 377 $** (Batch ile ≈ 190 $) |

Luna'nın çevirileri Arapça, Farsça ve Rusçada eşit veya daha iyiydi. Luna'da maliyetin yarısından fazlası girişte, yani her istekte tekrar gönderilen ≈ 400 token'lık talimatta. Bu yüzden gece işi her ilanın bütün eksik dillerini tek istekte ister ve cevap sade bir `{dil: [çeviriler]}` JSON'u olur (öğe başına anahtar veya kaynak dil kodu yok): ölçülen tasarruf %52. Düşünme kapalıdır (`reasoning_effort: none`), çünkü düşünme token'ları çıkış fiyatından ücretlenir. Arayüz metinleri çalışma anında çevrilmez; onlar sözlükte (`lib/i18n-dictionary.ts`).

## Kurulum

- `OPENAI_API_KEY`: platform.openai.com › API keys. **Restricted** anahtar: yalnızca *Chat completions* = Request, *Files* ve *Batch* = Write; diğer her şey None. Son kullanma tarihi olmayan bir proje anahtarı kullanın. OpenAI ön ödemelidir: bakiye biterse 429 `insufficient_quota` gelir, çeviri 30 dakika duraklar ve asıl metin gösterilir. Kullanım ve bakiye: platform.openai.com › Usage. OpenAI, API ile gelen metinleri model eğitiminde kullanmaz (kötüye kullanım denetimi için en fazla 30 gün saklayabilir); toplu iş dosyaları iş bitince silinir.
- İsteğe bağlı: `OPENAI_TRANSLATION_MODEL` (varsayılan `gpt-6-luna`).
- `OPENAI_API_KEY` yoksa çeviri eskisi gibi `GEMINI_API_KEY` ile yapılır (`GEMINI_TRANSLATION_MODEL`, varsayılan `gemini-3.5-flash-lite`). Gemini estateAI ve doğal dil araması için kullanılmaya devam eder.
- Harcama sınırları (çevrilen kaynak karakter, UTC gün/ay): `TRANSLATION_DAILY_CHAR_LIMIT` (varsayılan 2.000.000 ≈ 2 $/gün), `TRANSLATION_MONTHLY_CHAR_LIMIT` (varsayılan 30.000.000 ≈ 30 $/ay). Sınır aşılınca yeni çeviri yapılmaz, ziyaretçi asıl metni görür; ertesi gün/ay kendiliğinden devam eder. Ayrıca OpenAI › Settings › Limits'ten aylık bütçe uyarısı kurulması önerilir.
- `DEEPL_API_KEY` artık kullanılmıyor; ortamdan silinebilir.

## Ne zaman çevrilir

- **İlanlar bir kez, bütün dillere (sahibinin kararı, 2026-11-12):** yeni, düzenlenen ve onaylanan her ilan sıraya girer ve yayındaysa o gece toplu modda (yarı fiyat) bütün dillere çevrilir (aşağıda). Amaç: arama motorları yabancı dildeki sayfaları hazır metinle görsün, ziyaretçi beklemesin, çeviri masrafı ziyaretçiye/bota bağlı olmasın. İlan başına ≈ 0,7 cent (toplu) / 1,4 cent (normal).
- **Yedek, istendiğinde:** gece işinden önce bir ziyaretçi ilanı başka bir dilde açarsa tarayıcı `POST /api/translations` ile o dili ister; çeviri bir kez yapılır ve saklanır. Blog metinleri ve mesajlar yalnızca bu yolla çevrilir. Yönetici, Yönetim › Çeviriler'den elle de hazırlayabilir.
- **Ziyaretçi isteğinde bir istek, bir dil, ilanın bütün alanları:** eksik alanlar tek istekte çevrilir; düşünme kapalı. **Gece işinde bir istek, bir ilan, bütün eksik diller** (yukarıda).
- **Önbellek:** her alan, hedef dil + metnin özetine göre `content_translations` tablosunda saklanır. Düzenlemede yalnızca değişen alan yeniden çevrilir. Anahtar öneki (`deepl:auto:realestate-v1:`) tarihseldir; DeepL döneminin çevirileri bu sayede geçerli kaldı.
- **Elle girilen çeviriler** her zaman önceliklidir ve üzerine yazılmaz. İlanın kendi dili (`presentation.language`) hiçbir zaman çevrilmez.
- **Kilit:** aynı ilan/dil için eş zamanlı iki istek tek çeviri yapar (`translation_leases`).

## İlanlar: gece toplu çeviri

`lib/translation-batch.ts`. Gece işi ilk çalıştığında, bu sistemden önce yayınlanmış bütün ilanları bir kez kendiliğinden sıraya ekler (`backfillOnce`, `translation_batch_mode` içinde `backfill` satırıyla hatırlanır); elle bir şey yapılmaz. Luna'da iş bir **OpenAI Batch**'idir: her satırı bir ilanın bütün eksik dilleri olan JSONL dosyası `/v1/files`'a yüklenir, `/v1/batches` ile 24 saatlik iş başlatılır (normal fiyatın %50'si); saatlik görev durumu sorar, biten işin çıktı dosyasını okuyup önbelleğe yazar ve giriş/çıkış dosyalarını siler. Süresi dolan işin biten cevapları kaydedilir, kalan ilanlar sıraya döner. Gemini'de (OpenAI anahtarı yoksa) eski yol: dil başına istekli `batchGenerateContent`.

İlan verilince (`POST /api/listings`, XML aktarımı dahil), düzenlenince (`PATCH /api/listings/[id]`) ve yönetici onaylayınca (ilan onayı, ofis belgesi onayı) `translation_batch_queue` sırasına girer (`queueListingTranslation`). Günlük görev (`/api/cron/daily`) sıradaki en fazla 300 ilanın eksik bütün dil çevirilerini tek bir Gemini Batch işi olarak gönderir (`batchGenerateContent`, satır içi istekler, normal fiyatın %50'si). Saatlik görev (`/api/cron/health`) biten işleri toplar ve çevirileri normal önbelleğe (`content_translations`) yazar; Google bir işi en geç 24 saatte bitirir. İş bitene kadar ilanlar istenince çevrilir; zaten çevrilmiş diller işe konmaz.

- Aynı anda tek iş çalışır; işler `translation_batch_jobs` tablosunda izlenir. Başarısız/süresi dolan işin ilanları sıraya geri döner.
- İncelemedeki (`pending`) ilan yayına girene kadar en fazla 7 gün sırada bekler; reddedilen/silinen ilan sıradan çıkar.
- Günlük/aylık karakter sınırları burada da geçerlidir; sınırdaki iş ertesi güne kalır.
- Düzenlenen ilanda yalnızca değişen alanlar çevrilir; diğerleri önbellekte olduğu için işe konmaz.
- **Gemini'de Batch API yalnızca faturalandırması açık (ücretli) projelerde çalışır** (OpenAI'de bu sınır yok). Ücretsiz katman anahtarı `400 FAILED_PRECONDITION` döner. O zaman `translation_batch_mode` "direct" olur ve saatlik görev, o gece sırada olan ilanlardan saatte en fazla 6'sını normal fiyatla tek tek çevirir (`translateQueueDirectly`; ücretsiz katmanın istek sınırlarına göre). Sınır, bekleme veya hata çalışmayı durdurur, ilan sırada kalır. Gece işi her gece yeni ilanlarla Batch API'yi tekrar dener; faturalandırma açılınca kendiliğinden toplu moda (yarı fiyata) döner.

## Sunucuda gösterim (arama motorları)

İlan sayfası (`app/ilan/[id]/page.tsx`) ve blog yazısı (`app/blog/[slug]/page.tsx`) sayfa dilinin **kayıtlı** çevirisini sunucuda okur (`lib/translation-stored.ts`): `<title>`, meta açıklama, görünen başlık/açıklama ve JSON-LD (`name`, `description`, `inLanguage` = sayfa dili) böylece her `?lang=` adresinde o dilde gelir. Sayfa oluşturulurken hiçbir zaman çeviri sağlayıcısı çağrılmaz. Elle girilen çeviri önceliklidir; ilanın kendi dilinde bakılmaz; yalnızca bütün alanları kayıtlıysa kullanılır (GET `/api/translations` gibi). Kayıtlı çeviri yoksa sayfa asıl metinle gelir ve tarayıcı çeviriyi eskisi gibi ister; varsa tarayıcı tekrar istemez ve "Yapay zekâ ile otomatik çevrildi" notu ilk görünümde gösterilir.

## Bot koruması

`lib/translation-guard.ts`: kayıtlı bir çeviri herkese (arama motorları dahil) ücretsiz verilir. **Yeni (ücretli) bir çeviri** yalnızca şu üç koşul sağlanınca yapılır; sağlanmazsa ziyaretçi/bot asıl metni alır (`status: "original"`), hata almaz:

1. Bilinen bot, tarayıcı önizlemesi, izleme aracı veya betik değil (User-Agent: Googlebot, bingbot, GPTBot, HeadlessChrome, curl, python… ve `Mozilla/5.0` içermeyen her şey). Sosyal uygulamaların uygulama içi tarayıcıları (Instagram, LinkedIn…) gerçek kullanıcıdır ve engellenmez.
2. Gerçek tarayıcı isteği: `Sec-Fetch-Site: same-origin`, `Sec-Fetch-Mode: cors` ve `Accept-Language` başlıkları (tarayıcılar `fetch()` ile hep gönderir, basit betikler göndermez).
3. Ziyaretçi (IP özeti, `auth_limits`) başına saatte en fazla 20 yeni çeviri (`TRANSLATION_IP_LIMIT`). Gerçek bir ziyaretçi saatte 20 farklı ilanı yeni bir dilde açmaz.

Bunların hepsini aşan bir saldırıda bile günlük/aylık karakter sınırı (yukarıda) harcamayı durdurur. Sonuç: ilanlar zaten gece bütün dillere çevrildiği için Google yabancı dildeki sürümleri kayıtlı çeviriden görür; botlar yeni çeviri masrafı oluşturamaz.

## Mesajlar

`lib/message-translations.ts`: alıcının site diline çevrilir (`POST /api/messages`, `action: "translate"`, en fazla 20 id). Yalnızca `recipient_id`'si oturumdaki kullanıcı olan mesajlar gönderilir. Her (mesaj, dil) bir kez çevrilip `message_translations` tablosunda saklanır, mesajla birlikte silinir. Gönderilmeyenler: zaten okuyucunun dilinde olduğu açık olan metinler (Türkçe harfler, Kiril), harf içermeyen metinler (emoji, sayı, telefon). Gemini kaynak dili de bildirir; aynı dildeyse çeviri gösterilmez.

**Aylık çeviri hakkı (sahibinin isteği, 2026-11-25):** Her üye (yöneticiler hariç) ayda **150 mesaj** çevirebilir; bir mesaj ortalama 5 kelime sayılır, yani hak ayda 750 kelimedir (`MESSAGE_TRANSLATION_MESSAGES` ile sayı değişir). Yalnızca gerçekten başka dilden çevrilen mesajlar hakkı kullanır: saklı çeviriler, okuyucunun dilindeki ve harfsiz mesajlar ücretsizdir. Hak okuyanın hakkından düşer; mesajlar sırayla çevrilir, son mesaj hakkı biraz aşabilir. Hak bitince mesajlar orijinal dilinde görünür (`status: "quota"`) ve ayın 1'inde (İstanbul saati) yenilenir. Kullanım `message_translation_quota(user_id, month, words)` tablosunda tutulur (ilk kullanımda oluşur). Hesabım › Mesajlar'ın üstündeki çizgi kalan hakkı gösterir ve her çeviride kısalır: %30 altında sarı, %10 altında kırmızı (`GET /api/messages?quota=1`, çeviri yanıtındaki `quota`). Site geneli günlük/aylık karakter sınırı ayrıca geçerlidir.

## Hatalar

429 → kısa bekleme (`provider_busy`, 1 dk); OpenAI 429 `insufficient_quota` (bakiye bitti) → `provider_quota` (30 dk); 401/403 → `provider_auth`, 400/404 (model yok/kapatıldı) → `provider_config` (1 saat), diğer → `provider_unavailable`. Eksik/bozuk yanıt (sayı tutmayan sonuç, kesilen cevap) saklanmaz. Hata durumunda asıl metin gösterilir. Gemini çevirisinin token'ları Yönetim › Sistem durumu'ndaki aylık Gemini toplamlarına eklenir; OpenAI çevirisinin maliyeti çevrilen karakterden tahmin edilir (Yönetim › Yapay zekâ kotaları).

## Testler

`tests/translation.test.mjs` (önbellek, kilit, sınırlar, Gemini isteği ve hata kodları), `tests/translation-batch.test.mjs` (Gemini ve OpenAI toplu işi, Luna istekleri, faturalandırma olmadan saatlik çeviri), `tests/message-translations.test.mjs`, `tests/translation-trial.test.mjs`, `tests/translation-stored.test.mjs` (sunucuda kayıtlı çeviriyi okuma).

## Tarayıcıya giden çeviriler (2026-11-17)

Sözlüğün tamamı (8 dil, ~2,4 MB JavaScript) artık tarayıcıya gönderilmiyor. Tarayıcı paketinde `@/lib/i18n-dictionary` yerine `lib/i18n-runtime.ts` kullanılır (Cloudflare: `vite.config.ts` eklentisi, Mittwald: `next.config.ts` `resolveAlias` `browser` koşulu). Tarayıcı sayfanın dilini `/i18n/<dil>.json?v=<sürüm>` adresinden bir kez yükler (`app/i18n/[file]/route.ts`, bir yıl önbellek; sürüm sözlük değişince değişir). Türkçe için hiçbir şey yüklenmez. `LocaleProvider` mesajlar gelene kadar uygulamayı askıda tutar (sunucunun HTML'i ekranda kalır, hidrasyon uyuşmazlığı olmaz); dil değiştirilince yeni dil yüklendikten sonra geçilir. Sunucu tarafı her zaman tam sözlüğü kullanır. Yalnızca dil listesine ihtiyacı olan dosyalar `lib/locales.ts`'i içe aktarır. Test: `tests/i18n-runtime.test.mjs`, `tests/localization.test.mjs` (sunucu ve tarayıcı metinleri aynı).
