# Exxel Estate

Türkiye'deki satılık ve kiralık gayrimenkulleri tanıtan çok sayfalı platformun sunum sürümü. `app/` arayüzü, `app/api/` oturum ve ilan API'lerini, `db/schema.ts` mevcut Sites veritabanı şemasını içerir. `postgres/schema.sql` taşınabilir PostgreSQL hedef şemasıdır.

Arayüzde Türkçe, Almanca, Fransızca, İngilizce, Arapça ve Rusça seçimi bulunur. Seçim tarayıcıda saklanır; Arapça için yazı yönü sağdan sola çevrilir. İlan verirken diğer beş dil için başlık ve açıklama isteğe bağlı girilebilir; bu metinler ilan kartında ve detayında seçilen dile göre gösterilir. Çeviri girilmediyse ana ilan metni gösterilir. Otomatik makine çevirisi yapılmaz.

Arama sayfasında filtreler URL'ye yazılır; bağlantı paylaşılınca aynı arama açılır. Etkin filtreler tek tek kaldırılabilir. Kullanıcı aramalarını aynı tarayıcıda kaydedebilir. Liste/harita görünümünde seçilen ilanın yaklaşık konumu gösterilir; demo ilanlar kartta açıkça etiketlenir. Harita verisi OpenStreetMap gömülü görünümüdür; üretim ölçeğinde özel harita sağlayıcısı değerlendirilebilir.

## Çalıştırma

Node.js 22.13+ ile `npm ci`, ardından `npm run db:generate`, `npm run build` ve yerel D1 migrasyon uygulaması gerekir. `npm run dev` geliştirme sunucusunu açar. Sites üzerinde `.openai/hosting.json` içindeki `DB` ve `BUCKET` kaynakları sağlanır; yayın sırasında `drizzle/` migrasyonları uygulanır.

## Veri mülkiyeti ve aktarım

- Gerçek kullanıcı ve ilan verileri Sites D1'de; yüklenen orijinal fotoğraflar R2'de saklanır. Bunlar hesap sahibinin Sites kaynaklarıdır.
- PostgreSQL bağlantısı şu anda etkin değildir; PostgreSQL sunucusu veya yönetilen sağlayıcı hesabı kurulunca hedef şema ve veri aktarımı kullanılabilir. Cloudflare Workers için HTTP tabanlı PostgreSQL sürücüsü/bağlantısı gerekir.
- Yönetici hesabıyla `/api/export` tüm yapılandırılmış verileri JSON olarak indirir. Şifre özetleri ve oturum tokenları bu aktarımda yer almaz. Örnek ilanlar ayrıca `lib/listings.ts` içinde kaynak olarak saklanır.
- Büyük veri kümeleri için `/api/export?table=listings&offset=0` gibi uç noktalar her çağrıda 500 kayıt döndürür. `nextOffset` boşalana kadar devam edilir. `users`, `oauthAccounts`, `favorites`, `messages`, `packages`, `purchases` ve `countrySettings` tabloları da aynı şekilde alınabilir.
- Fotoğraf adresleri ilan kayıtlarında sıralı olarak bulunur. R2 dosyalarının ayrıca obje depolama aracıyla indirilmesi gerekir. Başka bir sisteme geçerken fotoğraf URL'leri hedef depolama adreslerine dönüştürülür.
- `postgres/schema.sql` aynı tablo kimliklerini ve alanları PostgreSQL'e taşımak için başlangıç şemasıdır. JSON içindeki `images`, `amenities` ve `translations` alanları PostgreSQL `jsonb` olarak tasarlanmıştır.
- Büyük veri hacminde konum, fiyat, tür ve alan filtreleri için kısmi ve bileşik indeksler hazırdır. Harita araması büyürse PostGIS `geography(Point,4326)` sütunu ve GiST indeksi eklenebilir.
- Katalog API'si 12 ilanlık sayfalar döndürür. `scripts/benchmark_db.py`, 1.000 hesap ve 10.000 örnek ilanla yerel SQL indeks sorgusunu ölçer; bu sonuç gerçek ağ trafiği altında yük testi yerine geçmez.
- Giriş denemeleri IP ve e-posta birleşimine göre 15 dakikalık pencerede sınırlandırılır. Oturum belirteçlerinin yalnızca SHA-256 özeti veritabanında tutulur; tarayıcı oturumu HttpOnly, Secure ve SameSite çerezindedir.

## Yönetim ve yayın hazırlığı

Yönetici erişimi için Sites ortamında `EXXEL_ADMIN_EMAIL` değişkeni, Google ile doğrulanmış bir yönetici e-posta adresine eşitlenmelidir. Şifreyle açılan, e-postası doğrulanmamış bir hesap bu değişken üzerinden yönetici olamaz. Emlakçı hesapları yönetici onayını bekler; gerçek ilanlar incelemeden sonra yayımlanır. Sunum paketlerindeki fiyatlar örnektir; sanal POS entegrasyonu etkin olmadığı için ücret tahsil edilmez. Kapora kapsamı ikinci teklife bırakılmıştır. Yasal metinler, ülke ayarları, çeviriler ve ödeme sağlayıcısı yayına açık kullanım öncesinde yapılandırılmalıdır. Demo ilanlarının gerçek satış teklifi olmadığı ilan detayında gösterilir.

## Google ile giriş kurulumu

Google OAuth kod akışı, PKCE ve tek kullanımlık durum kaydı hazırdır. Google giriş düğmesi yalnızca aşağıdaki üç Sites ortam değişkeni tanımlandığında ve ziyaretçi callback alan adını kullandığında görünür. Google Client Secret kaynak koduna veya `.openai/hosting.json` dosyasına yazılmaz; Sites ortamında gizli değer olarak saklanır. Google erişim ve yenileme tokenları veritabanında tutulmaz.

- `GOOGLE_CLIENT_ID`: Google Cloud Console'da oluşturulan Web application OAuth istemci kimliği.
- `GOOGLE_CLIENT_SECRET`: Aynı istemcinin gizli anahtarı; Sites secret olarak kaydedilir.
- `GOOGLE_REDIRECT_URI`: Google Cloud'daki yetkili yönlendirme URI'siyle birebir aynı tam HTTPS adresi. Bu istemci için `https://www.exxelestate.com/api/auth/callback/google`.

Alan adını satın alıp `www.exxelestate.com` adresini Sites'e bağlayın ve DNS doğrulamasının tamamlanmasını bekleyin. Google Cloud'da aynı alan adını OAuth yetkili alanlarına ekleyin; kayıtlı callback adresini koruyun. Ortam değerleri önceden kaydedilebilir: Google düğmesi yalnızca callback alan adında görünür. Google'ın alan adı sahipliği ve marka doğrulama koşulları nedeniyle `chatgpt.site` alt alan adı kendi OAuth uygulamanızın üretim alan adı olarak kullanılmamalıdır.

Google ile ilk kez gelen kullanıcı seçtiği hesap türünde açılır. Emlakçı hesabı önce `pending` olur ve ofis adı profilinden tamamlanır. Şifreli bir hesapla aynı e-posta varsa hesaplar otomatik birleştirilmez; kullanıcı önce şifreyle girer, ardından profilinden Google hesabını bağlar.
