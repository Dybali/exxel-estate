# Ön kayıt sayfaları (Google Ads kampanyası)

30 büyükşehir için emlakçılara ve bireysel mülk sahiplerine yönelik ön kayıt sayfaları (sahibinin kampanya metni, 2026-11-20).

- **Ayrı site:** sayfalar ana sitenin parçası değildir; `Dybali/estatemarket24` deposunda statik site olarak durur (GitHub Pages, geçici adres `https://dybali.github.io/estatemarket24/<şehir>/`; sonra `<şehir>.estatemarket24.com`). Formlar ana sistemin `POST /api/on-kayit` ucuna gönderir; bu uç yalnızca `https://dybali.github.io` ve `*.estatemarket24.com` kaynaklarına CORS izni verir (`LANDING_ORIGINS` ile ek test adresi).
- Şehir listesi, görseller ve lisanslar: `lib/landing-cities.ts` (API şehir doğrulaması ve yönetim ekranı kullanır; statik sitedeki kopya aynı veriden üretilir).
- Kayıt: `POST /api/on-kayit` → `pre_registrations` tablosu (`lib/pre-registrations.ts`, ilk kullanımda oluşur; sahibinin onayı 2026-11-20). Aynı e-posta + tür + şehir tekrar gelirse kayıt güncellenir. Adres başına 15 dakikada 10 kayıt; gizli "website" alanı bot tuzağıdır. Her yeni kayıtta `CONTACT_EMAIL` (yoksa `EXXEL_ADMIN_EMAIL`) adresine kısa bildirim gider.
- İzinler: KVKK Aydınlatma Metni onayı zorunlu (metin sürümü `NOTICE_VERSION` ve zamanı saklanır); kampanya/bilgilendirme izni isteğe bağlı, verildiği zamanla saklanır (ETİK, 6563 s. Kanun). Açılış duyurusu yalnızca izin verenlere ticari ileti olarak gönderilebilir; izin vermeyenlere yalnızca talebiyle ilgili bilgilendirme yapılır.
- %50 hediye: ilk 1000 emlakçı kaydına `gift=1` yazılır; teşekkür ekranı hediyeyi yalnızca bu durumda söyler.
- Reklam takibi: `utm_*` ve `gclid` kayda yazılır; gönderimde `generate_lead` (gtag) ve `pre_registration` (dataLayer) olayı tetiklenir — Google Ads dönüşümü bu olaya bağlanır (çerez izni gerekir).
- Yönetim: `/yonetim/on-kayitlar` (filtre: tür, şehir) ve Excel için CSV (`/api/admin/pre-registrations?format=csv`, noktalı virgül, UTF-8; formül olarak çalışabilecek hücreler etkisizleştirilir).

## Alt alan adlarını açmak (iş bitince)

Statik site GitHub Pages'te durduğu için alt alan adları GitHub Pages'e yönlendirilir (CNAME kaydı `dybali.github.io`); ayrıntıları bağlarken yazarım.

## Görseller

Fotoğraflar Wikimedia Commons'tan (lisans ve yazar sayfanın altında). 30 şehrin 10'unda fotoğraf prompt'taki simge yapıyı gösteriyor (`imageShowsLandmark: true`); diğerlerinde genel şehir görünümü var ve `lib/landing-cities.ts` içinden değiştirilebilir.
