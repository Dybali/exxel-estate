# DeepL content translation

Public listing title/description and blog headline, excerpt, section headings and paragraphs are translated. Received private messages are translated for their recipient (see below). Account records, documents, prices/locations stored as structured fields, and unpublished listings are excluded. Requests are constructed from server-owned content, never arbitrary client text.

Public interface copy is bundled separately in the localization dictionary. `data/editorial-ui-translations.json` supplies 75 previously missing labels in all five languages, including the homepage pricing banner, blog controls, article navigation and pricing-page copy. Static UI labels do not call DeepL at runtime. Dates and reading times follow the selected locale through `Intl`; blog source names/periods use the durable content cache. Localization tests check literal UI keys and dynamic pricing labels for every supported target language.

## Setup

Set `DEEPL_API_KEY` as a secret with the native Sites environment-variable tool; keep existing variables. A key ending in `:fx` uses the fixed DeepL API Free origin; other keys use the fixed Pro origin. Do not put keys in browser code, public variables, URLs, logs or source files. Deploy the same saved version again after setting runtime environment variables. For localhost only, use the ignored `.dev.vars` file.

The user activated the free Developer API account on 2026-10-22. `DEEPL_API_KEY` is configured as a Sites runtime secret (revision 10) and in ignored localhost configuration. Real provider requests succeeded for all five target languages. No key value is recorded in this document or tracked source.

## Storage and invalidation

Migration `0020_glorious_mariko_yashida.sql` adds three tables to the Site's **D1 DB binding**, not the Neon application database. Neon remains the authoritative listing store. D1 holds derived translated text, per-document generation leases, and aggregate character reservations. Source originals are not duplicated into this cache. Migration-owned tables are not created dynamically at request time.

Cache keys hash provider/context version, target language and the exact source segment. Unchanged paragraphs/headings are reused after edits. Readers resolve current published source and compute fresh hashes. Partial/stale machine translations are not served as complete. The browser also verifies the source-document revision; locale changes cannot replace new text with a late response in the old language. Manual listing translations take priority and are never overwritten.

Translation cache data should be included in D1 backup coverage if preserving it is important. It is independently reconstructible from original Neon records/blog sources and the provider, subject to quota and translation cost. It is not part of a Neon-only SQL dump.

## Generation and operation

Publishing/approving/updating a published listing schedules at most five target-language jobs through Workers `waitUntil`, without blocking publication. Existing/manual fields are skipped. Timeout is 18 seconds per provider call, with no automatic retry. The execution window is best-effort: interrupted/failed jobs can be prepared again from the admin panel. Blog source edits are detected automatically by the hash; the admin prepares updated blog translations using the same panel. There is no automatic retry scheduler.

The verified-admin panel offers published listings (latest 50), demo listings and blog content with language selection. `/api/admin/translations` authorizes before any provider call. `GET /api/translations` remains a public cache reader. When the selected language has no saved translation, the browser calls same-origin `POST /api/translations` to prepare that existing published document. No arbitrary client text is accepted; unpublished and unknown IDs cannot be translated. The same shared leases, provider bounds and global daily/monthly character caps apply. Two concurrent preparations per browser limit bursts. A pending shared job is polled with bounded backoff; missing translations are not negatively HTTP-cached. This also covers old listings and demos that predate API activation. If unavailable, original content is shown with a notice. Credentials and provider error bodies are not exposed.

Per-document leases prevent simultaneous duplicate work for a document/language. Default application reservation limits are 50,000 characters/day and 300,000/month (UTC); `DEEPL_DAILY_CHAR_LIMIT` and `DEEPL_MONTHLY_CHAR_LIMIT` can adjust them. Reservations count Unicode code points and are not refunded after ambiguous failures. These limits do not account for calls from other apps using the same DeepL account. Provider billing/quota remains authoritative. Cross-document segments prepared concurrently may both be translated; subsequent reads reuse the saved cache.

## Listings written in another language

Owners abroad may write the title and description in any site language (the listing form's "İlan metninin dili", default: the language the form is shown in). The choice is stored as `presentation.language` (`lib/listing-language.ts`; absent = Turkish, so existing listings are unchanged and no table changed). Readers in that language see the original; everyone else, Turkish readers included, gets the owner's manual translation or the DeepL one (`contentLocales` in `lib/translation.ts` adds `tr` as a target; `translationContent` returns nothing for the listing's own language, so Turkish listings are never sent for a Turkish translation). Manual translations in the form cover the other non-Turkish languages. Search, page titles and e-mails use the original text.

## Private messages

`lib/message-translations.ts` translates messages into the reader's site language (`POST /api/messages` with `action: "translate"`, up to 20 ids). Only messages whose `recipient_id` is the signed-in user are read and sent to DeepL, so a user can never translate someone else's conversation. Each (message, language) result is stored once in the Neon table `message_translations` (created on first use, `ON DELETE CASCADE` from `messages`); an empty `translated_text` records that the message was already in that language. Text that is clearly Turkish (ğ, ı, ş) for a Turkish reader, or Cyrillic for a Russian reader, is not sent. Characters count toward the same D1 usage counters and the shared provider pause applies; when DeepL is unavailable the original text is shown. The inbox shows the translation with a link back to the original. The privacy policy has a matching "Mesaj çevirisi" section.

## Verification

Translation tests cover cache hits, changed-field invalidation, duplicate concurrency, quota enforcement, upstream failure/cooldown, fixed provider hosts, missing-key behavior, admin authorization, published-only source resolution, read-only GET behavior, and same-origin public preparation of published source with subsequent cache reuse. An isolated live API check translated two sample fields into English, German, Arabic, French and Russian using the production translation/cache functions and an in-memory SQLite adapter. Every repeated request returned `cached` with zero additional provider calls (five calls total). No sample translations were placed in production. Public language-selection preparation can be verified without an administrator login; admin actions still require a verified admin.

DeepL text API: https://developers.deepl.com/api-reference/translate/request-translation
Workers background tasks: https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
