# estatemarket24 — yazılı ev asistanı

## Konum ve üyelik

Sağ alttaki düğmeyle açılan 400 px genişliğinde sohbet penceresi; ayrıca `/asistan` sayfası bulunur. Ana sayfanın ortasında asistan bölümü veya fotoğraflı sonuç paneli yoktur. Her aramada gerçek toplam sayı ve aynı filtreleri koruyan ilan sayfası bağlantısı gösterilir. Sonuç sayfasına örnek ilanlar eklenmez; eşyalı olmayan kriteri de korunur. Yalnızca mevcut uygulama oturumuyla giriş yapmış üyeler sohbet gönderebilir. Sunucu üyeliği model, kota ve ilan erişiminden önce doğrular. Giriş bağlantısı kullanıcıyı ana sayfaya getirip sohbeti açar. Kapatma sohbeti silmez; yeni sohbet veya sayfadan ayrılma temizler.

## Gemini etkinleştirme

`GEMINI_API_KEY` sunucu sırrı native Sites ortam değişkenleri üzerinden tanımlanır. Anahtar tarayıcıya, kaynak koduna, URL'ye veya NEXT_PUBLIC değişkenine konulmaz. Model `GEMINI_MODEL=gemini-3.5-flash-lite`; dış istekler sadece sabit Google endpoint'ine HTTPS üzerinden gider. Yönlendirme takip edilmez. API anahtarı tanımlı değilse arayüz bağlantının etkin olmadığını söyler ve standart aramaya yönlendirir; sahte yapay zekâ yanıtı veya örnek sonuç üretmez. Gemini 2.5 Flash-Lite modeller listesinde görünmesine rağmen yeni hesapta generateContent için 404 verdi; gerçek çağrıdan gelen yönlendirme üzerine 3.5 Flash-Lite kullanıldı.

Google AI Studio ilk kurulumundaki hizmet şartları/yaş beyanı hesap sahibi tarafından tamamlandı; API anahtarı Google tarafından doğrulandı ve native Sites'ta secret olarak tanımlandı. Ücretli Google aboneliği/billing açılmadı. Ücretsiz hizmetlerde veri kullanım koşulları ayrıca değerlendirilmelidir; pilotta yapay mesajlar kullanıldı. Yerel önizleme için anahtar sadece Git dışındaki `.dev.vars` içindedir.

## Arama ve veri

Gemini bir JSON şemasında kriter çıkarır; sunucu bunları yeniden doğrular. Yalnızca izin verilen sabit filtreler ve parametreli SQL kullanılır. İl/ilçe Türkiye kayıtlarıyla eşleştirilir; bütçe para birimi yoksa sorulur. 2 yatak odası ile 2+1 oda düzeni ayrıdır. Bütçe/para birimi kendiliğinden genişletilmez veya çevrilmez. En fazla 6 sonuç ve toplam sayı döner.

İlan kaynağı mevcut `db()` adaptörüdür: canlı DATABASE_URL varsa Neon, yerelde D1. Sadece `status='published'` olan gerçek kayıtlar sorgulanır. DEMO_LISTINGS hiçbir zaman asistan sonuçlarına eklenmez. Sahip iletişim bilgileri, kullanıcı kayıtları, mesajlar, inceleme notları veya özel belgeler modele gönderilmez. Karşılaştırma/güncel bilgi için son görülen ilanlar tekrar published filtresiyle okunur. Başlıklar ve konuşma talimat değil veri kabul edilir. Aidat, denize mesafe, deprem dayanımı gibi kayıtta olmayan bilgiler doğrulanmış gibi sunulmaz.

Türkçe, İngilizce, Almanca, Arapça, Fransızca, Rusça arayüz; otomatik veya elle dil seçimi. Arapça panel RTL, mesajlar `dir=auto`. Ses kaydı veya mikrofon yoktur. Sohbet yalnızca bileşen belleğinde tutulur; veritabanına veya localStorage'a yazılmaz. Çıkış/girişsiz durum algılanınca sohbet temizlenir. Model için iletilen geçmiş 8 mesajla sınırlandırılır; e-posta ve uluslararası telefon desenleri maskelenir. Bu maskeleme her türlü kişisel veriyi tanıma garantisi değildir; kullanıcıya özel bilgi göndermemesi belirtilir.

## Kullanım sınırları

Kota, Site'ın mevcut D1 `DB` binding'inde `0019_faulty_blob.sql` migration'ıyla oluşturulan `ai_usage_limits` tablosunda atomik tutulur; Neon uygulama tabloları değiştirilmez. Üye başına saatte 20 sohbet isteği. Varsayılan global günlük 400 model çağrısı rezervasyonu; her sohbet için iki çağrı ayrılır, aramada biri, karşılaştırma/detayda ikisi kullanılır. Bu yüzden varsayılan en fazla 200 sohbet isteği/gün kabul edilir. Saat/gün UTC'ye göre hesaplanır. Kota anahtarı üye kimliği + sunucu sırrının SHA-256 özetidir. Sadece toplam istek/token sayıları saklanır; 3 gün sonra kayıtlar temizlenir.

`AI_DAILY_CALL_LIMIT` 2–2000 arasıdır. Bu bir dolar bütçesi garantisi değildir; çağrı sayısı sınırıdır. Mesaj uzunluğu 1000 karakter, geçmiş en fazla 10 mesaj, istek 16.000 karakter, her model yanıtı en fazla 1600 token, zaman aşımı 25 saniye. Otomatik tekrar yoktur. Kota/servis hatası dürüstçe gösterilir; standart ilan araması devam eder.

## Doğrulama

`node --test tests/assistant.test.mjs`: para birimi/konum, SQL parametreleri, yayın durumu, gizli alanlar, atomik kota, Gemini istek yapısı, maskelenen iletişim bilgileri, eksik model çıktısı ve sunucu üyelik kontrolü ve dinamik sonuç sayısı/bağlantısı için 12 test. Tüm depo testleri: 55 geçti. Gerçek Gemini 3.5 Flash-Lite pilotunda Türkçe, İngilizce, Almanca ve Arapça aynı Bodrum/bahçeli villa/satılık/6 milyon TRY sorgusunu doğru filtrelere dönüştürdü (4/4, toplam 3472 giriş ve 787 çıkış tokenı). Girişsiz canlı POST 401 doğrulandı. Tam tarayıcı üye sohbeti ayrıca kontrol edilmelidir; gerçek kullanıcı parolası veya oturumu test için oluşturulmadı/değiştirilmedi.
