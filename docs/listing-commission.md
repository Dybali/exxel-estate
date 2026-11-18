# İlanlarda hizmet bedeli (komisyon) (2026-11-18)

Sahibinin isteğiyle, Almanya'daki portallarda (ImmoScout24 "Käuferprovision") olduğu gibi. İsteğe bağlı; yalnızca **satılık** ve **kiralık** ilanlarda (günlük kiralık ve devren yok).

## Yasal sınırlar (Taşınmaz Ticareti Hakkında Yönetmelik)

- Satış: toplam en fazla satış bedelinin **%4'ü + KDV**; aksi kararlaştırılmadıkça alıcı ve satıcı yarı yarıya (genelde her biri %2 + KDV).
- Kiralama: toplam en fazla **bir aylık kira + KDV**; aksi kararlaştırılmadıkça kiracı ve ev sahibi yarı yarıya. Depozito ve aidat hesaba girmez.
- Gösterme için ayrı ücret alınamaz.

İlanda **alıcının / kiracının payı** girilir: satışta %0,25–4, kiralamada 0,25–1 ay. Üstü reddedilir (`lib/listing-commission.ts`). Sınırlar değişirse `COMMISSION_MAX` güncellenir.

## Akış

- Form: `components/CommissionFields.tsx` (ilan verme ve düzenleme, `PresentationFields` içinde): "Belirtmek istemiyorum / Komisyonsuz / Alıcıdan (Kiracıdan) hizmet bedeli alınır" + oran/ay. Taslaklarda saklanır (`lib/listing-drafts.ts`).
- Kayıt: `listings.presentation.commission` = `{type:"none"}` veya `{type:"share",value}`; migrasyon yok. Formsuz güncellemeler kayıtlı beyanı korur; ilan türü değişirse düşer.
- İlan sayfası: fiyatın altında "Alıcı hizmet bedeli: %2 + KDV · ≈ ₺…" veya "Komisyonsuz" (`components/CommissionNote.tsx`).
- Kart: "Komisyonsuz" rozeti (örnek ilanlarda gösterilmez).
- Arama: `?commission=none`, filtrelerde "Hizmet bedeli (komisyon) › Yalnızca komisyonsuz ilanlar" (`lib/search-categories.ts`).

Beyan ilan verene aittir; site doğrulamaz. Testler: `tests/listing-commission.test.mjs`, `tests/search-categories.test.mjs`.
