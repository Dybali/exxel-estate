# Zehra'nın teknik değerlendirmesi — çalışma notu (23.10.2026)

Bu belge Zehra'nın ilettiği metindeki maddeleri mevcut kaynak ve çalışan siteyle karşılaştırır. Hukuki onay veya gönderilmiş yanıt değildir.

## Tamamlanan site işleri

- Inter yazı tipi dört yerel WOFF2 dosyasından yükleniyor. Google Fonts isteği yok.
- Kodda kullanılan 18 ayrı Unsplash görselinin sıkıştırılmış WebP kopyası `public/editorial/` klasörüne alındı. Eş dosyalar `apps/web/public/editorial/` içinde. Uygulama kodunda artık `images.unsplash.com` isteği yok. Fotoğraflar temsilidir; ilan sahibinin gerçekte sunduğu mülkleri göstermemelidir.
- İlan iletişimi, hesap güvenliği ve ilan yönetiminde bulunan sabit Türkçe arayüz metinleri çevrilebilir hale getirildi. Yayındaki künye ve gizlilik sayfalarının metinlerine de Almanca, Fransızca, İngilizce, Arapça ve Rusça karşılıklar eklendi. Hukuki anlamın işletmeci tarafından ayrıca denetlenmesi gerekir. Gerçek kullanıcıların serbest metin ilan açıklamaları yalnızca kaydedilmiş/sağlayıcıdan gelen çevirileri olduğunda çevrilir; bulunmazsa orijinal metin gösterilir.
- Çerez panelinde istatistik ve harici video seçenekleri varsayılan olarak kapalıdır; site içi görüntüleme sayacı iki tarafta da izne bağlıdır. Video çerçeveleri izne ve kullanıcının oynatma eylemine bağlıdır. Bu teknik davranış ayrı hukuki incelemenin yerine geçmez.

## Mevcut teknoloji ve veri akışı

| Alan | Bugün çalışan uygulama | Hazırlanan taşıma hedefi |
| --- | --- | --- |
| Arayüz | React / TypeScript / Sites Vinext | Ayrı Next.js / TypeScript (`apps/web`) |
| API | Sites üzerinde Cloudflare Worker rotaları (`app/api`) | NestJS / TypeScript (`apps/api`), işlev eşitliği henüz tamamlanmadı |
| Veritabanı | Neon PostgreSQL ana veri deposu; bazı eski/yardımcı akışlarda Sites D1 | Neon PostgreSQL / Prisma |
| Fotoğraflar | İlan görselleri Cloudflare R2, sunum görselleri yerel | R2 ve yerel varlıklar |
| Kimlik | Uygulama oturumları; Google OAuth ayarlanırsa etkinleşir | JWT/güvenli oturum yönetimi |
| Harici içerik | OpenStreetMap karoları, izinle YouTube/Vimeo; isteğe bağlı Gemini ve yapılandırılırsa DeepL | Hizmet sözleşmeleri ve veri akışları yeniden doğrulanmalı |
| Kaynak | Git deposu, GitHub uzak adresi mevcut | CI/CD ve Mittwald dağıtımı henüz kurulmadı |

Kaynak: `README.md`, `app/api`, `lib/server.ts`, `lib/external-r2.ts`, `apps/api`, `apps/web`.

### Zehra'ya verilecek kesin teknik envanter

- **Canlı sürüm:** React 19 + TypeScript 5.9 arayüzü; Vinext 1 beta / Vite 8 derlemesi; Cloudflare Sites/Workers üzerinde `app/` sayfaları ve `app/api/` API rotaları. Node.js 22.13+ geliştirme ve derleme gereksinimi.
- **Veri ve medya:** Neon PostgreSQL ana veri deposu (`@neondatabase/serverless`, sürümlü SQL migrasyonları); ilan fotoğrafları Cloudflare R2. Geçiş için eski D1/R2 bağları korunuyor. `drizzle-orm` bağımlılığı mevcut, ancak canlı veri katmanını tek başına Prisma veya Drizzle olarak tanımlamamak gerekir.
- **Ayrı dağıtım için hazırlanan kod:** `apps/web` Next.js 16, `apps/api` NestJS 11 + Prisma 6. Bu ikilinin canlı uygulamayla işlev eşitliği ve Mittwald dağıtımı tamamlanmadı.
- **Sürüm kontrolü:** Git kullanılıyor. Canlı Sites kaynağı ve `https://github.com/Dybali/exxel-estate.git` adlı **özel** GitHub deposu ayrı uzak depolar. 23.10.2026'da GitHub'daki beş operasyon iş akışı commit'i, 51 Sites kaynak commit'iyle çakışmadan birleştirildi; yeni birleşik kaynak `main` dalına gönderiliyor. Canlı dağıtımın otomatik olarak GitHub'dan yapılmadığı ayrıca belirtilmeli.
- **Henüz yok / doğrulanacak:** Mittwald üzerinde çalışan Node uygulaması ve bu sunucu için üretim CI/CD süreci yok. GitHub'da zamanlanmış izleme/yedekleme iş akışı ve korunan gizli değişkenler var; `EM24_OPERATIONS_ENABLED=true`. Ancak 23.10.2026 tarihli son saatlik izleme çalışması başarısız. Neon/R2 için başarılı, düzenli bağımsız yedek ve geri yükleme tatbikatının kanıtı bu incelemede doğrulanmadı. Salt-okunur R2 yedek okuma uç noktası tek başına yedek anlamına gelmez.

### Sunucu sorumlulukları için önerilen çalışma tablosu

Bu tablo sözleşme hükmü değil; Zehra ve Sayın Aydın'ın onaylayacağı öneridir. Mittwald, [Managed Dedicated Server M](https://www.mittwald.de/dedicated-server) ürününde yönetilen altyapı, proje yedekleri ve Node.js/özel uygulama çalıştırma olanağı listeliyor. [Mittwald güvenlik güncellemesi açıklaması](https://www.mittwald.de/faq/tools-cms/sicherheit/automatische-updates-und-patches), bazı yazılım sürüm güncellemelerinin varsayılan olarak kapalı olabileceğini söylüyor. Gerçek proje ayarları ve satın alma sözleşmesi ayrıca doğrulanmalı.

| İş | Önerilen sorumlu | Bugünkü durum / teslim ölçütü |
| --- | --- | --- |
| Donanım, temel işletim sistemi ve yönetilen altyapı yamaları | Mittwald; Zehra doğrular | Hizmet kapsamı ve destek yolu sözleşmede doğrulanacak. |
| mStudio projesi, üç alan adı ve üç e-posta adresi, DNS ve TLS | Zehra; değişiklik için Aydın kararı | Zehra projeyi oluşturdu; mevcut ayarlar korunuyor. DNS veya yayın geçişi yapılmadı. |
| Proje erişimleri, MFA, yetki gözden geçirme | Zehra ve Aydın; uygulama rolleri geliştirici | Kişiye özel erişim ve en az yetki listesi çıkarılacak; ortak hesap kullanılmayacak. |
| Node.js uygulaması, bağımlılık yamaları, API güvenliği ve sürüm dağıtımı | Geliştirici; yayına alma Zehra ile koordine | Canlı Sites sürümü çalışıyor; Mittwald dağıtımı yapılmadı. Önce staging, derleme, test ve geri alma planı. |
| Mittwald proje dosyası/yerel veritabanı yedeklerinin kapsamı ve saklama süresi | Mittwald hizmeti; Zehra doğrular | [Mittwald yedek açıklamasında](https://www.mittwald.de/faq/administration/faq/backup-einspielen-lassen) web sunucusu ve MySQL belirtilir; kapsam ve süre proje ekranından doğrulanacak. |
| **Neon PostgreSQL ve Cloudflare R2 bağımsız yedekleri** | Geliştirici tasarlar ve işletir; Aydın hedef/erişim politikasını onaylar | Dış hizmetler Mittwald proje yedeğine dahil varsayılmayacak. GitHub'da zamanlanmış iş akışı mevcut; şifreli yedeklerin ve geri yükleme denemesinin gerçekten başarıyla tamamlandığı ayrıca doğrulanmalı. |
| Site sağlığı, API hataları, yedek başarısızlığı ve kapasite uyarıları | Geliştirici uygulama alarmları; Zehra altyapı uyarıları | Uyarı alıcısı, eşik ve ilk müdahale süresi yazılı belirlenecek. |
| Olay yönetimi ve kurtarma | Zehra + geliştirici; iş kararı Aydın | İletişim zinciri, geri alma ve Neon/R2 geri yükleme prosedürü staging ortamında denenip kaydedilecek. |

**Zehra/Aydın ile tek görüşmede netleştirilecekler:** (1) mStudio'da seçili ürün ve sözleşme kapsamı; (2) Mittwald projesine kimlerin hangi rolle erişeceği; (3) alan adlarından hangisinin yeni siteye bağlanacağı ve ne zaman; (4) yedeklerin saklama süresi, bağımsız hedefi ve geri yükleme hedef süresi; (5) uyarıları kimin alacağı. Şifreler veya erişim anahtarları e-postaya yazılmamalı.

## Sayın Aydın / Zehra ile netleştirilecek kararlar

1. Zehra satın alınan ürünü **Yönetilen Özel Sunucu M** olarak bildirdi; Mittwald bunu **Managed Dedicated Server M** adıyla listeliyor. Daha önce konuşulan **Managed vServer M** farklı bir ürün adı. Satın alınan tam paket mStudio sözleşmesinden doğrulanmalı. Zehra projeyi ve üç alan adıyla üç e-posta adresini zaten oluşturmuş; yeni proje açılmamalı.
2. Sunucuya dağıtım, alan adlarının hedefini değiştirme ve DNS işlemleri sunucu yöneticisiyle koordine edilmeli. Şu aşamada Mittwald'da değişiklik yapılmadı.
3. Sağlayıcı / ekip sorumlulukları yazılı belirlenmeli: altyapı ve platform yama yönetimi; uygulama bağımlılıkları; erişimler; Neon/R2 ayrı yedekleri; geri yükleme denemeleri; gözlem ve uyarılar. Mittwald yönetilen planın tam hizmet kapsamı sözleşmeden doğrulanmalı.
4. Sitede `/impressum` künyesi ve `/gizlilik-politikasi` sayfası, footer bağlantılarıyla **zaten yayında**. Kullanıcı, künye için `eXXelmedia GmbH & Co. KG`, Dornacherstraße 3, D-85622 Feldkirchen, +49 89 250 076 16, faks +49 89 248 879 55, `info@exxelmedia.de`, Münih ticaret sicili HRA 105867 ve KDV kimliği DE309567893 bilgilerini verdi; bunlar mevcut sayfayla eşleşiyor. Kullanıcı ayrıca yetkili olarak yazan Eyup Aydin adını doğru ve Sayın Aydın tarafından onaylı olarak teyit etti. Gizlilik metninin hukuki kapsamı ve fiilî veri akışları yine ayrıca gözden geçirilmeli.
5. GDPR gizlilik bildirimi için veri sorumlusu ve temas noktası, işlem amaçları/hukuki dayanakları, veri kategorileri, saklama süreleri, hizmet sağlayıcı sözleşmeleri, üçüncü ülke erişimi ve ilgili haklar/sorumlu makam hukuki incelemeden geçmeli. Türkiye'den yönetim erişimi ayrıca değerlendirilmeli. Mevcut sayfa bunların bir kısmını açıklıyor; eksiksiz hukuki onay anlamına gelmiyor.
6. Mevcut `/cerez-politikasi` çerez ve yerel depolamayı açıklar. Yayındaki künye ve gizlilik metninin, işletmeci ve fiilî veri akışlarıyla tutarlılığı ayrıca doğrulanmalı.
7. Harita karoları OpenStreetMap'ten istekle alınır. Gemini asistanı kullanıcı eylemiyle çalışır; DeepL anahtar varsa kullanılır. Google OAuth ve ödeme sağlayıcısı açıldığında belge ve izin tablosu yeniden gözden geçirilmeli. Ödeme altyapısı henüz etkin değil; fiyatlar/ücretli paketler sunum aşamasındadır.

## Zehra'ya gönderilebilecek taslak yanıt

Merhaba Zehra Hanım,

Değerlendirmeniz için teşekkür ederiz. Canlı uygulamamız React/TypeScript, Vinext ve Cloudflare Sites/Workers üzerinde çalışıyor; arayüz ve API rotaları aynı depoda. Ana ilan ve hesap verileri Neon PostgreSQL'de, ilan fotoğrafları Cloudflare R2'de tutuluyor. Node.js 22 ile derliyoruz ve Git kullanıyoruz. Kaynaklar özel GitHub depomuzda tutuluyor; canlı Sites dağıtımı henüz GitHub tabanlı otomatik yayın değil. GitHub'daki operasyon iş akışlarıyla güncel site kaynağını birleştirdik. Next.js ve NestJS/Prisma tabanlı bağımsız dağıtım için ayrıca kod hazırlanıyor, ancak tüm canlı API işlevlerinin eşitliği ve Mittwald yayını henüz tamamlanmadı.

İşaret ettiğiniz harici font ve görselleri kontrol ettik: Inter fontları yerel dosyalardan yükleniyor; sitede referans verilen 18 Unsplash görselinin yerel kopyalarını hazırladık. Almanca ve diğer dillerde ilan iletişimi ile hesap alanlarındaki eksik arayüz çevirilerini tamamladık. Serbest metin ilan içeriklerinde çeviri yoksa orijinal dilin gösterilebildiğini ayrıca belirtmek isteriz.

Mittwald projesini ve eklediğiniz alan adları/e-posta adreslerini koruyacağız. Sunucuya henüz kod yüklemedik veya ayar değiştirmedik. Ürünün tam plan adını, dağıtım yöntemini, güncelleme/yedekleme/izleme sorumluluklarını Sayın Aydın'la birlikte netleştirelim. Kullanıcı, yayındaki künyenin şirket, iletişim, sicil ve vergi bilgilerini mevcut sayfayla eşleşecek biçimde iletti; Eyup Aydin adının doğru ve onun tarafından onaylı olduğunu da teyit etti. Gizlilik sayfasının fiilî veri işleme akışlarını ayrıca birlikte denetleyelim. Ödeme açılmadan önce sağlayıcı ve ödeme verileriyle ilgili metinleri ayrıca güncelleyeceğiz.

Saygılarımızla

## Resmî referanslar

- [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html)
- [Avrupa Komisyonu: veri işleme bilgileri](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en)
- [EDPB: uluslararası veri aktarımı](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en)
- [AB: çerezler](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm)
- [Unsplash lisansı](https://unsplash.com/license)
