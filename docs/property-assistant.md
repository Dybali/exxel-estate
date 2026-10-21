# estatemarket24 — yazılı ev asistanı

## Konum ve üyelik

Ana sayfada hızlı bağlantıların altında `#ev-asistani` bölümü; ayrıca `/asistan` sayfası bulunur. Diğer sayfalardaki “Asistanla ev bul” bağlantısı ana sayfadaki bölüme götürür. Yalnızca mevcut uygulama oturumuyla giriş yapmış üyeler sohbet gönderebilir. Sunucu `currentUser` doğrulamasını model, kota ve ilan erişiminden önce yapar; girişsiz POST 401, başka kaynaktan POST 403 verir. İstemcinin gönderdiği kullanıcı kimliğine güvenilmez. Giriş bağlantısı kullanıcıyı asistan bölümüne geri döndürür. Tüm mevcut hesap rolleri kullanabilir; yönetici olma şartı yoktur.

## Gemini etkinleştirme

`GEMINI_API_KEY` sunucu sırrı native Sites ortam değişkenleri üzerinden tanımlanmalıdır. Anahtar tarayıcıya, kaynak koduna, URL'ye veya NEXT_PUBLIC değişkenine konulmaz. Önerilen başlangıç modeli `GEMINI_MODEL=gemini-2.5-flash-lite`; dış istekler sadece sabit Google endpoint'ine HTTPS üzerinden gider. Yönlendirme takip edilmez. API anahtarı henüz tanımlı değilse arayüz bağlantının etkin olmadığını söyler ve standart aramaya yönlendirir; sahte yapay zekâ yanıtı veya örnek sonuç üretmez.

Google AI Studio ilk kurulumundaki hizmet şartları/yaş beyanı hesap sahibi tarafından kabul edilmelidir. Henüz API anahtarı veya canlı Gemini testi tamamlanmadı. Ücretli Google aboneliği/billing açılmadı. Ücretsiz hizmetlerde veri kullanım koşulları ayrıca değerlendirilmelidir; testler yapay mesajlarla yapılır.

## Arama ve veri

Gemini bir JSON şemasında kriter çıkarır; sunucu bunları yeniden doğrular. Yalnızca izin verilen sabit filtreler ve parametreli SQL kullanılır. İl/ilçe Türkiye kayıtlarıyla eşleştirilir; bütçe para birimi yoksa sorulur. 2 yatak odası ile 2+1 oda düzeni ayrıdır. Bütçe/para birimi kendiliğinden genişletilmez veya çevrilmez. En fazla 6 sonuç ve toplam sayı döner.

İlan kaynağı mevcut `db()` adaptörüdür: canlı DATABASE_URL varsa Neon, yerelde D1. Sadece `status='published'` olan gerçek kayıtlar sorgulanır. DEMO_LISTINGS hiçbir zaman asistan sonuçlarına eklenmez. Sahip iletişim bilgileri, kullanıcı kayıtları, mesajlar, inceleme notları veya özel belgeler modele gönderilmez. Karşılaştırma/güncel bilgi için son görülen ilanlar tekrar published filtresiyle okunur. Başlıklar ve konuşma talimat değil veri kabul edilir. Aidat, denize mesafe, deprem dayanımı gibi kayıtta olmayan bilgiler doğrulanmış gibi sunulmaz.

Türkçe, İngilizce, Almanca, Arapça, Fransızca, Rusça arayüz; otomatik veya elle dil seçimi. Arapça panel RTL, mesajlar `dir=auto`. Ses kaydı veya mikrofon yoktur. Sohbet yalnızca bileşen belleğinde tutulur; veritabanına veya localStorage'a yazılmaz. Çıkış/girişsiz durum algılanınca sohbet temizlenir. Model için iletilen geçmiş 8 mesajla sınırlandırılır; e-posta ve uluslararası telefon desenleri maskelenir. Bu maskeleme her türlü kişisel veriyi tanıma garantisi değildir; kullanıcıya özel bilgi göndermemesi belirtilir.

## Kullanım sınırları

Kota, Site'ın mevcut D1 `DB` binding'inde `0019_faulty_blob.sql` migration'ıyla oluşturulan `ai_usage_limits` tablosunda atomik tutulur; Neon uygulama tabloları değiştirilmez. Üye başına saatte 20 sohbet isteği. Varsayılan global günlük 400 model çağrısı rezervasyonu; her sohbet için iki çağrı ayrılır, aramada biri, karşılaştırma/detayda ikisi kullanılır. Bu yüzden varsayılan en fazla 200 sohbet isteği/gün kabul edilir. Saat/gün UTC'ye göre hesaplanır. Kota anahtarı üye kimliği + sunucu sırrının SHA-256 özetidir. Sadece toplam istek/token sayıları saklanır; 3 gün sonra kayıtlar temizlenir.

`AI_DAILY_CALL_LIMIT` 2–2000 arasıdır. Bu bir dolar bütçesi garantisi değildir; çağrı sayısı sınırıdır. Mesaj uzunluğu 1000 karakter, geçmiş en fazla 10 mesaj, istek 16.000 karakter, her model yanıtı en fazla 1600 token, zaman aşımı 25 saniye. Otomatik tekrar yoktur. Kota/servis hatası dürüstçe gösterilir; standart ilan araması devam eder.

## Doğrulama

`node --test tests/assistant.test.mjs`: para birimi/konum, SQL parametreleri, yayın durumu, gizli alanlar, atomik kota, Gemini istek yapısı, maskelenen iletişim bilgileri, eksik model çıktısı ve sunucu üyelik kontrolü için 10 test. Bunlar yapay verilerle çalışır; gerçek modelin dil/arama kalitesini ölçen canlı pilot yerine geçmez. API anahtarı bağlandıktan sonra dört ana dilde gerçek sorgular, devam eden bütçe değişikliği ve bilinmeyen özellik soruları ayrıca doğrulanmalıdır.
