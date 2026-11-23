# Sayfa içi yardım (2026-11-23)

Sahibinin isteği: özellikler kolay anlaşılsın, ama rahatsız eden açılır pencere olmasın. Üç parça; hepsi 10 dilde.

## Başlangıç listesi: "Hesabınızı hazırlayın"

`lib/onboarding.ts`, `app/api/onboarding`, `components/StartChecklist.tsx`. Hesabım › Genel Bakış'ın en üstünde, hesap türüne göre adımlar ve ilerleme çubuğu:

- **Emlakçı:** profil fotoğrafı, yetki belgesi (yüklendi = incelemede veya onaylı), ilk ilan, konuştuğu diller, Talep akışına göz atma.
- **Bireysel:** telefon, bir favori, kayıtlı arama, Benim için bul talebi.
- **Hizmet firması:** firma bilgileri, hizmet bölgeleri, belge, paket.
- **Müteahhit:** firma bilgileri, bölgeler, tamamlanan proje, paket.

Adımlar veriden işaretlenir; olmayan tablo "henüz yok" sayılır. "Göz at" türü adımları tarayıcı hatırlar. Liste, bütün adımlar bitince ya da kişi kapatınca (o tarayıcıda, hesap başına) görünmez.

## Tek seferlik ipuçları

`components/FeatureTip.tsx`: özelliğin başında sayfa içinde sarı bir kutu, "Anladım" deyince o tarayıcıda bir daha çıkmaz. Şu an:

- Talep akışı (`talep-akisi`)
- Emlak piyasası haritası (`emlak-piyasasi`)
- Benim için bul taleplerim (`benim-icin-bul-takip`)

Yeni ipucu eklerken sayfa başına en fazla bir tane koyun. Hesabım menüsünde "Talep akışı" sekmesinde 2027-02-01'e kadar **Yeni** rozeti var (`components/Dashboard.tsx`).

## "?" açıklamaları

`components/InfoTip.tsx`: terimin yanında soru işareti; dokununca iki cümlelik açıklama çıkar (telefonda alttan). Escape, ikinci dokunuş veya başka yere dokunuş kapatır. Şu an:

- İlan formunda hizmet bedeli.
- Talep akışında danışman sınırı ve sıcak talep.
- Emlak piyasasında brüt kira getirisi ve konut fiyat endeksi.

Metinler `lib/privacy-clause-translations.ts` içinde, 10 dil.

## Yardım merkezi: `/yardim`

`components/HelpCenter.tsx`: ev arayanlar, ev sahipleri, emlakçılar, hizmet firmaları ve müteahhitler için sekmeli adım adım rehber; her adımın düğmesi işin yapıldığı sayfaya gider (`#alici`, `#ev-sahibi`, `#emlakci`, `#firma` ile doğrudan açılır). Ayrıntılı sorular `/sss`. Girişler: her sayfanın üst çubuğunda "Yardım", Hesabım menüsünün altında ve alt bilgide "Yardım merkezi".
