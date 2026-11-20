# Ön kayıt sayfaları (Google Ads kampanyası)

30 büyükşehir için emlakçılara ve bireysel mülk sahiplerine yönelik ön kayıt sayfaları (sahibinin kampanya metni, 2026-11-20).

- Adres: `https://<şehir>.estatemarket24.com` (ör. `adana.estatemarket24.com`) ya da her alan adında `/on-kayit/<şehir>`. Şehir listesi, görseller ve görsel lisansları: `lib/landing-cities.ts`; alt alan adı eşleşmesi: `lib/landing-hosts.ts` (`proxy.ts` kök yolu `/on-kayit/<şehir>`'e yönlendirir, yalnızca Mittwald/Node). Test alan adı için `LANDING_BASE_DOMAIN` ortam değişkeni.
- Sayfa: `components/PreRegistrationFlow.tsx`. Her ekranda tek soru; ilk soru emlakçı/bireysel ayrımını yapar ve sorular buna göre değişir. Site çerçevesi (üst menü, alt bilgi) gösterilmez (`lib/site-chrome.ts` "landing"). Sayfalar Google'a kapalıdır (noindex, site haritasında yok).
- Kayıt: `POST /api/on-kayit` → `pre_registrations` tablosu (`lib/pre-registrations.ts`, ilk kullanımda oluşur; sahibinin onayı 2026-11-20). Aynı e-posta + tür + şehir tekrar gelirse kayıt güncellenir. Adres başına 15 dakikada 10 kayıt; gizli "website" alanı bot tuzağıdır. Her yeni kayıtta `CONTACT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine kısa bildirim gider.
- İzinler: KVKK Aydınlatma Metni onayı zorunlu (metin sürümü `NOTICE_VERSION` ve zamanı saklanır); kampanya/bilgilendirme izni isteğe bağlı, verildiği zamanla saklanır (ETİK, 6563 s. Kanun). Açılış duyurusu yalnızca izin verenlere ticari ileti olarak gönderilebilir; izin vermeyenlere yalnızca talebiyle ilgili bilgilendirme yapılır.
- %50 hediye: ilk 1000 emlakçı kaydına `gift=1` yazılır; teşekkür ekranı hediyeyi yalnızca bu durumda söyler.
- Reklam takibi: `utm_*` ve `gclid` kayda yazılır; gönderimde `generate_lead` (gtag) ve `pre_registration` (dataLayer) olayı tetiklenir — Google Ads dönüşümü bu olaya bağlanır (çerez izni gerekir).
- Yönetim: `/yonetim/on-kayitlar` (filtre: tür, şehir) ve Excel için CSV (`/api/admin/pre-registrations?format=csv`, noktalı virgül, UTF-8; formül olarak çalışabilecek hücreler etkisizleştirilir).

## Alt alan adlarını açmak (sahibi, mStudio)

1. mStudio → projeye → **Domains** → her şehir için `şehir.estatemarket24.com` ekleyin ve aynı konteynere (`site`) yönlendirin. SSL sertifikası otomatik gelir.
2. Alan adı DNS'i Mittwald'da değilse, sağlayıcıda her alt alan adı için Mittwald'ın gösterdiği CNAME/A kaydını girin (ya da tek bir `*.estatemarket24.com` joker kaydı).
3. Kontrol: `https://adana.estatemarket24.com` ön kayıt sayfasını açmalı.

## Görseller

Fotoğraflar Wikimedia Commons'tan (lisans ve yazar sayfanın altında). 30 şehrin 10'unda fotoğraf prompt'taki simge yapıyı gösteriyor (`imageShowsLandmark: true`); diğerlerinde genel şehir görünümü var ve `lib/landing-cities.ts` içinden değiştirilebilir.
