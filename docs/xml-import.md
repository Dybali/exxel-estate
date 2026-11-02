# XML ile toplu ilan aktarma

İlan veren hesaplar (emlakçı, bireysel, yönetici) **Hesabım → Müşteri talepleri** bölümünden bir XML dosyası seçerek en fazla 100 ilanı tek seferde aktarabilir. Örnek dosya: [`/xml-ornek-ilanlar.xml`](../public/xml-ornek-ilanlar.xml).

## Nasıl çalışır

1. Dosya tarayıcıda okunur ve her ilan `lib/listing-import.ts` ile doğrulanır; hatalı ilanlar tabloda gerekçesiyle gösterilir.
2. Mahalle adı `/api/locations` listesinden eşleştirilir. Aynı adlı mahalleler için `postalCode` özniteliği gerekir.
3. Fotoğraflar `POST /api/media/fetch` ile sunucu üzerinden indirilir (yalnızca herkese açık `https` adresler, en fazla 25 MB, JPG/PNG/WEBP imzası doğrulanır), tarayıcıda küçültülüp filigranlanır ve `POST /api/media` ile yüklenir.
4. İlan, ilan formuyla aynı `POST /api/listings` isteğiyle gönderilir. Kota, ofis doğrulaması, konum, alan ve onay kuralları aynen uygulanır.
5. `ref` ve hesap kimliğinden sabit bir `submissionId` üretilir. Aynı dosya tekrar aktarılırsa ilan ikinci kez oluşmaz; satır “Daha önce aktarılmış” olarak gösterilir. Bir ilanı değiştirmek için İlanlarım bölümünü kullanın.

## Biçim

Kök öğe `<listings version="1">`, her ilan `<listing ref="...">`. `ref` hesabınız içinde benzersiz olmalıdır.

| Öğe | Zorunlu | Değer |
| --- | --- | --- |
| `title` | evet | 5–150 karakter |
| `description` | evet | 20–5000 karakter |
| `purpose` | evet | `satilik`, `kiralik`, `gunluk`, `devren` |
| `type` | evet | `lib/listings.ts` içindeki `PROPERTY_TYPES` değerleri (ör. `daire`, `villa`, `mustakil`, `arsa`, `ticari`) |
| `price` | evet | Pozitif sayı; `currency` özniteliği `TRY`, `EUR`, `USD`, `GBP` (varsayılan `TRY`) |
| `city`, `district` | evet | Türkiye il ve ilçe adı |
| `neighborhood` | evet | Mahalle adı; isteğe bağlı `postalCode` özniteliği |
| `grossArea` | evet | m², tam sayı |
| `netArea`, `plotArea`, `gardenArea` | villada zorunlu | m², tam sayı (bahçe yoksa `0`) |
| `rooms` | hayır | ör. `3+1` |
| `bedrooms`, `bathrooms`, `buildingAge`, `floor`, `totalFloors` | hayır | tam sayı |
| `heating` | hayır | serbest metin |
| `furnished` | hayır | `1` / `0` |
| `amenities/amenity` | hayır | `AMENITIES` listesindeki Türkçe adlar (ör. `Asansör`, `Otopark`, `Havuz`) |
| `images/image` | evet | 1–20 adet herkese açık `https` fotoğraf adresi |
| `videoUrl`, `tourUrl` | hayır | YouTube/Vimeo veya Matterport/Kuula `https` bağlantısı |
| `translations/translation[lang]` | hayır | `de`, `fr`, `en`, `ar`, `fa`, `ru`, `nl` için `title` ve `description` |

Dosya en fazla 2 MB olabilir. Fotoğraflar sırayla işlendiği için 100 ilanlık bir aktarma birkaç dakika sürebilir; sayfa açık kalmalıdır.
