# Exxel Estate

Türkiye'deki satılık ve kiralık gayrimenkulleri tanıtan çok sayfalı platform. `app/` arayüzü, `app/api/` oturum ve ilan API'lerini içerir. Canlı yapılandırmada ana veri deposu Neon PostgreSQL, fotoğraf deposu Cloudflare R2 EU bucket'ıdır. Eski D1/R2 bağları geçiş süresince yalnızca geri dönüş ve eski dosyaları okuyabilmek için korunur.

Arayüzde Türkçe, Almanca, Fransızca, İngilizce, Arapça ve Rusça seçimi bulunur. Seçim tarayıcıda saklanır; Arapça için yazı yönü sağdan sola çevrilir. İlan verirken diğer beş dil için başlık ve açıklama isteğe bağlı girilebilir; bu metinler ilan kartında ve detayında seçilen dile göre gösterilir. Çeviri girilmediyse ana ilan metni gösterilir. Otomatik makine çevirisi yapılmaz.

Arama sayfasında filtreler URL'ye yazılır; bağlantı paylaşılınca aynı arama açılır. Etkin filtreler tek tek kaldırılabilir. Kullanıcı aramalarını aynı tarayıcıda kaydedebilir. Liste/harita görünümünde seçilen ilanın yaklaşık konumu gösterilir; demo ilanlar kartta açıkça etiketlenir. Harita verisi OpenStreetMap gömülü görünümüdür; üretim ölçeğinde özel harita sağlayıcısı değerlendirilebilir.

## Çalıştırma

Node.js 22.13+ ile `npm ci` ve `npm run build` çalıştırın. Sites üzerinde `DATABASE_URL`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` ve `R2_SECRET_ACCESS_KEY` sunucu gizlisi olarak tanımlanır. `DATABASE_URL` Neon'un havuzlanmış HTTPS uyumlu PostgreSQL adresidir; S3 endpoint EU jurisdiction'a ait olmalıdır. `postgres/migrations/` sıralı SQL migrasyonlarını içerir. Geliştirme ortamında `scripts/neon-migrate.mjs` yerel, Git dışında tutulan `work/integration-secrets.env` dosyasını okur. Bu dosya, `.env` ve tüm anahtarlar hiçbir zaman kaynak deposuna veya build çıktısına alınmaz.

## Veri mülkiyeti ve aktarım

- Üye, oturum, emlakçı, ilan, favori, mesaj, ayar ve fotoğraf referansları Neon'dadır. Orijinal fotoğraflar Cloudflare R2 `exxel-estate-images` bucket'ındadır. `property_images.object_key` site adresinden bağımsızdır.
- Canlı D1 kayıtları aynı UUID kimlikleriyle Neon'a taşınmıştır. Göç betikleri `scripts/neon-import.mjs` ve `scripts/neon-migrate-images.mjs` yeniden çalıştırılabilir; veri doğrulaması yapar.
- Yönetici hesabıyla `/api/export` tüm yapılandırılmış verileri JSON olarak indirir. Şifre özetleri ve oturum tokenları bu aktarımda yer almaz. Örnek ilanlar ayrıca `lib/listings.ts` içinde kaynak olarak saklanır.
- Büyük veri kümeleri için `/api/export?table=listings&offset=0` gibi uç noktalar her çağrıda 500 kayıt döndürür. `nextOffset` boşalana kadar devam edilir. `users`, `oauthAccounts`, `favorites`, `messages`, `packages`, `purchases` ve `countrySettings` tabloları da aynı şekilde alınabilir.
- Fotoğraf dosyaları için `property_images` tablosunda değişmeyen nesne anahtarı, sıra, MIME türü ve boyut tutulur. Mevcut ilan API'si uyumu için `listings.images` alanında aynı anahtarlardan üretilen göreli `/api/media/...` adresleri de saklanır. Yeni sürüm aynı API'yi veya aynı Neon/R2 kaynaklarını kullanabilir.
- `postgres/schema.sql` güncel birleşik PostgreSQL şemasını, `postgres/migrations/` ise sürümlü değişiklikleri tanımlar. Tarih ve JSON alanları mevcut API ile uyumlu metin değerleridir; daha sonra sürümlü migrasyonla `jsonb` ve `timestamptz` tiplerine taşınabilir.
- Büyük veri hacminde konum, fiyat, tür ve alan filtreleri için kısmi ve bileşik indeksler hazırdır. Harita araması büyürse PostGIS `geography(Point,4326)` sütunu ve GiST indeksi eklenebilir.
- Katalog API'si 12 ilanlık sayfalar döndürür. `scripts/benchmark_db.py`, 1.000 hesap ve 10.000 örnek ilanla yerel SQL indeks sorgusunu ölçer; bu sonuç gerçek ağ trafiği altında yük testi yerine geçmez.
- Giriş denemeleri IP ve e-posta birleşimine göre 15 dakikalık pencerede sınırlandırılır. Oturum belirteçlerinin yalnızca SHA-256 özeti veritabanında tutulur; tarayıcı oturumu HttpOnly, Secure ve SameSite çerezindedir.

## API ve işletim

Herkese açık `GET /api/listings`, `GET /api/listings/:id` ve `GET /api/locations` arama ve detay verisi sağlar. `POST /api/media` yalnızca oturum açmış ilan verenin JPG/PNG/WEBP dosyasını (en çok 8 MB) kabul eder, imzasını doğrular ve R2'ye yükler. `POST /api/listings` yalnızca sahibinin yüklediği R2 nesnelerini kabul eder; `property_images` kayıtlarını ilanla aynı veritabanı işleminde oluşturur ve onaylı emlakçı ilanını `published`, bireysel ilanı `pending` kaydeder. `GET /api/media/:key` görüntüleri depodan sunar. Oturum, hesap, favori, mesaj ve yönetim uçları `app/api/` altında belgelenebilir kaynak koduyla bulunur; yönetim işlemleri sunucuda rol kontrolünden geçer.

Günlük otomatik yedekleme ve ikinci konumda fotoğraf kopyası henüz yapılandırılmamıştır. Neon'dan tutarlı `pg_dump` yedeği ve geri yükleme denemesi için Neon panelinden **doğrudan** bağlantı adresi, bağımsız yedek hedefi ve görev zamanlayıcısı gerekir. Havuzlanmış uygulama URL'sini `pg_dump` adresi olarak kullanmayın. Yedekler kişisel veri ve parola özetleri içerir; şifreleme ve erişim sınırlandırması gerektirir.

## Yönetim ve yayın hazırlığı

Yönetici erişimi için Sites ortamında `EXXEL_ADMIN_EMAIL` değişkeni tanımlanır. Google ile doğrulanmış bu e-posta doğrudan yönetici olabilir. Alan adı ve Google yönlendirmesi hazır değilse, yalnızca site sahibine verilen `EXXEL_ADMIN_SETUP_CODE` gizli değeri `/yonetim/kurulum` ekranında bir kez kullanılarak aynı e-posta için yönetici hesabı açılır; mevcut oturumları kapatır ve tekrar kullanılamaz. Şifreyle açılan sıradan, e-postası doğrulanmamış bir hesap yalnızca `EXXEL_ADMIN_EMAIL` eşleşmesiyle yönetici olamaz. Emlakçı hesapları yönetici onayını bekler; onaylı emlakçıların yeni ve düzenlenmiş ilanları doğrudan yayımlanır. Bireysel ilanlar ve değişiklikleri yönetici incelemesine gönderilir. Ret gerekçesi ilan sahibinin hesabında görünür. Örnek ilanlar platformun önceden hazırlanmış sunum içeriğidir ve açıkça örnek olarak işaretlenir.

Türkiye il, ilçe ve 32.254 mahalle kaydı `data/locations` içinde tutulur. Kaynak, sürüm ve lisans bilgisi aynı klasörün README dosyasındadır. Aynı adlı mahalleler posta kodu ve benzersiz kayıt numarasıyla ayrı seçilir; ilanlarda mahalle adı, kaynak ID'si ve posta kodu saklanır. İlan verenler koordinat girmez; yeni ilanlar il/ilçe/mahalle eşleşmesi doğrulanarak kaydedilir.

Sunum paketlerindeki fiyatlar örnektir; sanal POS entegrasyonu etkin olmadığı için ücret tahsil edilmez. Kapora kapsamı ikinci teklife bırakılmıştır. Yasal metinler, ülke ayarları, çeviriler ve ödeme sağlayıcısı yayına açık kullanım öncesinde yapılandırılmalıdır.

## Google ile giriş kurulumu

Google OAuth kod akışı, PKCE ve tek kullanımlık durum kaydı hazırdır. Google giriş düğmesi yalnızca aşağıdaki üç Sites ortam değişkeni tanımlandığında ve ziyaretçi callback alan adını kullandığında görünür. Google Client Secret kaynak koduna veya `.openai/hosting.json` dosyasına yazılmaz; Sites ortamında gizli değer olarak saklanır. Google erişim ve yenileme tokenları veritabanında tutulmaz.

- `GOOGLE_CLIENT_ID`: Google Cloud Console'da oluşturulan Web application OAuth istemci kimliği.
- `GOOGLE_CLIENT_SECRET`: Aynı istemcinin gizli anahtarı; Sites secret olarak kaydedilir.
- `GOOGLE_REDIRECT_URI`: Google Cloud'daki yetkili yönlendirme URI'siyle birebir aynı tam HTTPS adresi. Bu istemci için `https://www.exxelestate.com/api/auth/callback/google`.

Alan adını satın alıp `www.exxelestate.com` adresini Sites'e bağlayın ve DNS doğrulamasının tamamlanmasını bekleyin. Google Cloud'da aynı alan adını OAuth yetkili alanlarına ekleyin; kayıtlı callback adresini koruyun. Ortam değerleri önceden kaydedilebilir: Google düğmesi yalnızca callback alan adında görünür. Google'ın alan adı sahipliği ve marka doğrulama koşulları nedeniyle `chatgpt.site` alt alan adı kendi OAuth uygulamanızın üretim alan adı olarak kullanılmamalıdır.

Google ile ilk kez gelen kullanıcı seçtiği hesap türünde açılır. Emlakçı hesabı önce `pending` olur ve ofis adı profilinden tamamlanır. Şifreli bir hesapla aynı e-posta varsa hesaplar otomatik birleştirilmez; kullanıcı önce şifreyle girer, ardından profilinden Google hesabını bağlar.

Profil, WhatsApp onayı, favoriler ve ilan düzenleme API sözleşmeleri: [Hesap özellikleri](docs/account-features.md).
