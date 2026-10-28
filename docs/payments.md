# Siparişler ve ödeme

Ücretli özellikler sağlayıcıdan bağımsız bir sipariş tablosu (`orders`) üzerinden satılır. Bugün tek ödeme yöntemi **havale/EFT**dir; ödeme yönetici tarafından onaylanınca ürün otomatik tanımlanır.

## Ürünler (`lib/orders.ts` → `CATALOG`)

| Kod | Ürün | Örnek fiyat |
| --- | --- | --- |
| `featured-7` | İlanı 7 gün öne çıkar | 250 TRY |
| `featured-30` | İlanı 30 gün öne çıkar | 790 TRY |
| `plan-professional` | Profesyonel paket, 30 gün, 5 ilan (yalnızca emlakçı) | 1.490 TRY |
| `plan-prestige` | Prestij paket, 30 gün, 20 ilan (yalnızca emlakçı) | 3.990 TRY |

Fiyatlar `/paketler` sayfasındaki örnek fiyatlarla aynıdır. Gerçek satıştan önce bu dosyada güncellenmeli; KDV ve fatura düzeni muhasebeciyle netleştirilmelidir.

## Akış

1. Kullanıcı **İlanlarım → Öne çıkar** (yayındaki ilan) ile sipariş verir; `EM24-XXXXXX` biçiminde bir ödeme kodu ve banka bilgileri gösterilir. Aynı ürün için aynı anda tek bekleyen sipariş olabilir.
2. Kullanıcı havale/EFT açıklamasına kodu yazar. Bekleyen siparişler **Hesabım → Siparişlerim** bölümünde görünür ve iptal edilebilir.
3. Yönetici **/yonetim → Siparişler** bölümünde ödemeyi gördükten sonra **Ödeme alındı** der:
   - Öne çıkarma: ilan `featured=1` olur, `listing_promotions` tablosuna bitiş tarihi yazılır; süre devam ediyorsa yeni süre eklenir.
   - Paket: `agent_plan_grants` kaydı oluşturulur; etkin paket varsa kalan süre korunur. (`AGENT_PLANS_ENABLED` kapalıyken paketler ilan hakkını sınırlamaz.)
4. Her gün 06:00 UTC'de süresi dolan öne çıkarmalar kapatılır (`expirePromotions`, Worker `scheduled`).

## Etkinleştirme

Banka bilgileri girilmeden sipariş alınmaz:

```bash
npx.cmd wrangler secret put BANK_ACCOUNT_NAME
npx.cmd wrangler secret put BANK_IBAN
npx.cmd wrangler secret put BANK_NAME
```

`BANK_IBAN` geçerli bir `TR` IBAN olmalıdır (26 karakter). Ödeme ve fatura bilgileri işlendiği için gizlilik politikası ve mesafeli satış / ön bilgilendirme metinleri yayından önce hazırlanmalıdır.

## Kartla ödeme eklemek

`lib/payment-providers.ts` içine sağlayıcı eklenir; sağlayıcının imzalı geri bildirim (callback/webhook) rotası imzayı doğruladıktan sonra `fulfillOrder()` çağırır. Sipariş, ürün ve süre mantığı aynı kalır.
