# Yapay zekâ kotaları

Yönetim › **Yapay zekâ kotaları** (`components/AdminAiLimits.tsx`, `lib/ai-limits.ts`, `lib/ai-limits-server.ts`, `/api/admin/ai-limits`). Asistan, doğal dil araması ve çeviri aynı Gemini anahtarını kullanır; bu ekran hepsinin site geneli tavanlarını ve kullanımını gösterir.

## Tavanlar

| Kota | Varsayılan | Ne olur dolunca |
| --- | --- | --- |
| `AI_DAILY_CALL_LIMIT` asistan + arama, günlük model çağrısı | 400 | Asistan "kota" der, arama yapay zekâsız devam eder |
| `AI_MONTHLY_CALL_LIMIT` asistan + arama, aylık | 12.000 | aynı |
| `NL_SEARCH_DAILY_AI_LIMIT` doğal dil araması, günlük | 200 | arama yapay zekâsız devam eder |
| `TRANSLATION_DAILY_CHAR_LIMIT` çeviri, günlük karakter | 2.000.000 (≈ 2 $) | asıl metin gösterilir |
| `TRANSLATION_MONTHLY_CHAR_LIMIT` çeviri, aylık karakter | 30.000.000 (≈ 30 $) | asıl metin gösterilir |

- Geçerli değer = **temel sınır + onaylı emlakçı sayısı × emlakçı başına ek**. Temel sınır panelde girildiyse o, yoksa aynı adlı ortam değişkeni, yoksa varsayılan kullanılır. Böylece tavan emlakçı sayısıyla kendiliğinden büyür.
- Panelde kaydedilen değer (`ai_settings` tablosu) en geç bir dakika içinde, yeniden başlatmadan geçerli olur. Her değişiklik işlem geçmişine yazılır.
- Asistanın günlük ve aylık tavanı 2026-11-12'ye kadar yalnızca sayılıyordu; artık aşılınca istek reddedilir. Kişi başı sınırlar (asistan üye başına saatte 20, arama ziyaretçi başına günde 10, çeviri ziyaretçi başına saatte 20) kodda sabittir.

## Kullanım ve maliyet

- Saatlik görev (`/api/cron/health`) günün sayaçlarını `ai_usage_history` tablosuna kopyalar (canlı sayaçlar 3 gün sonra silinir); ekran son 30 günün tahmini maliyetini gösterir.
- Maliyet tahmindir: asistan ve arama için Gemini 3.5 Flash-Lite liste fiyatı (1M token: 0,30 $ girdi, 2,50 $ çıktı), çeviri için Çeviri testi'nde GPT-6 Luna ile ölçülen maliyet (≈ 0,18 $ / 1M karakter; gece Batch işi bunun yarısı, Gemini ile çeviride ≈ 5,6 katı). Gerçek faturalar Google Cloud Console › Billing ve platform.openai.com › Usage'dadır.
- Bir tavanın %80'i ve %100'ü dolunca `ALERT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine, her tavan, dönem ve seviye için bir kez e-posta gider (`ai_limit_alerts`).

## Google tarafında ayrıca

Bu tavanlar yalnızca site üzerinden yapılan çağrıları sınırlar. Anahtar çalınırsa işe yaramaz; bu yüzden Google Cloud'da anahtarı Mittwald sunucusunun IP'si ve Generative Language API ile kısıtlayın, Quotas'tan günlük istek tavanı ve Billing › Budgets'tan bütçe uyarısı kurun (`docs/security-checklist.md`).
