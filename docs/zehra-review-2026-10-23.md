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

## Sayın Aydın / Zehra ile netleştirilecek kararlar

1. Metinde satın alınan ürün **Yönetilen Özel Sunucu M** olarak anılıyor. Daha önce konuşulan **Managed vServer M** ile aynı ürün olup olmadığı mStudio sözleşmesinden doğrulanmalı. Zehra projeyi ve üç alan adıyla üç e-posta adresini zaten oluşturmuş; yeni proje açılmamalı.
2. Sunucuya dağıtım, alan adlarının hedefini değiştirme ve DNS işlemleri sunucu yöneticisiyle koordine edilmeli. Şu aşamada Mittwald'da değişiklik yapılmadı.
3. Sağlayıcı / ekip sorumlulukları yazılı belirlenmeli: altyapı ve platform yama yönetimi; uygulama bağımlılıkları; erişimler; Neon/R2 ayrı yedekleri; geri yükleme denemeleri; gözlem ve uyarılar. Mittwald yönetilen planın tam hizmet kapsamı sözleşmeden doğrulanmalı.
4. Sitede `/impressum` künyesi ve `/gizlilik-politikasi` sayfası, footer bağlantılarıyla **zaten yayında**. Kullanıcı, künye için `eXXelmedia GmbH & Co. KG`, Dornacherstraße 3, D-85622 Feldkirchen, +49 89 250 076 16, faks +49 89 248 879 55, `info@exxelmedia.de`, Münih ticaret sicili HRA 105867 ve KDV kimliği DE309567893 bilgilerini verdi; bunlar mevcut sayfayla eşleşiyor. Kullanıcı ayrıca yetkili olarak yazan Eyup Aydin adını doğru ve Sayın Aydın tarafından onaylı olarak teyit etti. Gizlilik metninin hukuki kapsamı ve fiilî veri akışları yine ayrıca gözden geçirilmeli.
5. GDPR gizlilik bildirimi için veri sorumlusu ve temas noktası, işlem amaçları/hukuki dayanakları, veri kategorileri, saklama süreleri, hizmet sağlayıcı sözleşmeleri, üçüncü ülke erişimi ve ilgili haklar/sorumlu makam hukuki incelemeden geçmeli. Türkiye'den yönetim erişimi ayrıca değerlendirilmeli. Mevcut sayfa bunların bir kısmını açıklıyor; eksiksiz hukuki onay anlamına gelmiyor.
6. Mevcut `/cerez-politikasi` çerez ve yerel depolamayı açıklar. Yayındaki künye ve gizlilik metninin, işletmeci ve fiilî veri akışlarıyla tutarlılığı ayrıca doğrulanmalı.
7. Harita karoları OpenStreetMap'ten istekle alınır. Gemini asistanı kullanıcı eylemiyle çalışır; DeepL anahtar varsa kullanılır. Google OAuth ve ödeme sağlayıcısı açıldığında belge ve izin tablosu yeniden gözden geçirilmeli. Ödeme altyapısı henüz etkin değil; fiyatlar/ücretli paketler sunum aşamasındadır.

## Zehra'ya gönderilebilecek taslak yanıt

Merhaba Zehra Hanım,

Değerlendirmeniz için teşekkür ederiz. Geliştirme tarafında TypeScript/React tabanlı, bugün Cloudflare Sites üzerinde çalışan bir uygulama kullanıyoruz. Ana ilan ve hesap verileri Neon PostgreSQL'de, ilan fotoğrafları Cloudflare R2'de tutuluyor. Git ile sürüm kontrolü yapıyoruz; GitHub uzak depomuz mevcut. Next.js ve NestJS tabanlı bağımsız dağıtım için ayrıca kaynak hazırlanıyor, ancak bu sürümde tüm canlı API işlevlerinin eşitliği henüz tamamlanmadı.

İşaret ettiğiniz harici font ve görselleri kontrol ettik: Inter fontları yerel dosyalardan yükleniyor; sitede referans verilen 18 Unsplash görselinin yerel kopyalarını hazırladık. Almanca ve diğer dillerde ilan iletişimi ile hesap alanlarındaki eksik arayüz çevirilerini tamamladık. Serbest metin ilan içeriklerinde çeviri yoksa orijinal dilin gösterilebildiğini ayrıca belirtmek isteriz.

Mittwald projesini ve eklediğiniz alan adları/e-posta adreslerini koruyacağız. Sunucuya henüz kod yüklemedik veya ayar değiştirmedik. Ürünün tam plan adını, dağıtım yöntemini, güncelleme/yedekleme/izleme sorumluluklarını Sayın Aydın'la birlikte netleştirelim. Kullanıcı, yayındaki künyenin şirket, iletişim, sicil ve vergi bilgilerini mevcut sayfayla eşleşecek biçimde iletti; Eyup Aydin adının doğru ve onun tarafından onaylı olduğunu da teyit etti. Gizlilik sayfasının fiilî veri işleme akışlarını ayrıca birlikte denetleyelim. Ödeme açılmadan önce sağlayıcı ve ödeme verileriyle ilgili metinleri ayrıca güncelleyeceğiz.

Saygılarımızla

## Resmî referanslar

- [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html)
- [Avrupa Komisyonu: veri işleme bilgileri](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en)
- [EDPB: uluslararası veri aktarımı](https://www.edpb.europa.eu/sme/be-compliant/international-data-transfers_en)
- [AB: çerezler](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm)
- [Unsplash lisansı](https://unsplash.com/license)
