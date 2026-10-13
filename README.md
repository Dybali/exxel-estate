# Excell Estate

Türkiye'deki satılık ve kiralık gayrimenkulleri tanıtan çok sayfalı platformun sunum sürümü. `app/` arayüzü, `app/api/` oturum ve ilan API'lerini, `db/schema.ts` mevcut Sites veritabanı şemasını içerir. `postgres/schema.sql` taşınabilir PostgreSQL hedef şemasıdır.

## Çalıştırma

Node.js 22.13+ ile `npm ci`, ardından `npm run db:generate`, `npm run build` ve yerel D1 migrasyon uygulaması gerekir. `npm run dev` geliştirme sunucusunu açar. Sites üzerinde `.openai/hosting.json` içindeki `DB` ve `BUCKET` kaynakları sağlanır; yayın sırasında `drizzle/` migrasyonları uygulanır.

## Veri mülkiyeti ve aktarım

- Gerçek kullanıcı ve ilan verileri Sites D1'de; yüklenen orijinal fotoğraflar R2'de saklanır. Bunlar hesap sahibinin Sites kaynaklarıdır.
- Yönetici hesabıyla `/api/export` tüm yapılandırılmış verileri JSON olarak indirir. Şifre özetleri ve oturum tokenları bu aktarımda yer almaz. Örnek ilanlar ayrıca `lib/listings.ts` içinde kaynak olarak saklanır.
- Büyük veri kümeleri için `/api/export?table=listings&offset=0` gibi uç noktalar her çağrıda 500 kayıt döndürür. `nextOffset` boşalana kadar devam edilir. `users`, `favorites`, `messages`, `packages`, `purchases` ve `countrySettings` tabloları da aynı şekilde alınabilir.
- Fotoğraf adresleri ilan kayıtlarında sıralı olarak bulunur. R2 dosyalarının ayrıca obje depolama aracıyla indirilmesi gerekir. Başka bir sisteme geçerken fotoğraf URL'leri hedef depolama adreslerine dönüştürülür.
- `postgres/schema.sql` aynı tablo kimliklerini ve alanları PostgreSQL'e taşımak için başlangıç şemasıdır. JSON içindeki `images` ve `amenities` alanları PostgreSQL `jsonb` olarak tasarlanmıştır.
- Büyük veri hacminde konum, fiyat, tür ve alan filtreleri için kısmi ve bileşik indeksler hazırdır. Harita araması büyürse PostGIS `geography(Point,4326)` sütunu ve GiST indeksi eklenebilir.
- Katalog API'si 12 ilanlık sayfalar döndürür. `scripts/benchmark_db.py`, 1.000 hesap ve 10.000 örnek ilanla yerel SQL indeks sorgusunu ölçer; bu sonuç gerçek ağ trafiği altında yük testi yerine geçmez.

## Yönetim ve yayın hazırlığı

Yönetici erişimi için Sites ortamında `EXCELL_ADMIN_EMAIL` değişkeni, kaydedilmiş yönetici e-posta adresine eşitlenmelidir. Emlakçı hesapları yönetici onayını bekler; gerçek ilanlar incelemeden sonra yayımlanır. Sunum paketlerindeki fiyatlar örnektir; sanal POS entegrasyonu etkin olmadığı için ücret tahsil edilmez. Kapora kapsamı ikinci teklife bırakılmıştır. Yasal metinler, ülke ayarları, çeviriler, e-posta doğrulama ve ödeme sağlayıcısı yayına açık kullanım öncesinde yapılandırılmalıdır. Demo ilanlarının gerçek satış teklifi olmadığı ilan detayında gösterilir.
