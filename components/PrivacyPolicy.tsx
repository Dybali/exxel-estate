'use client';
import {CompanyIdentity} from './CompanyIdentity';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {LegalContactBox, LegalPage, LegalRights, PRIVACY_EMAIL} from './LegalPage';

// Facts behind this text: docs/auth.md, docs/backups-monitoring.md, docs/email-notifications.md, docs/listing-risk.md,
// docs/nl-search.md, docs/listing-videos.md, docs/mittwald-migration.md. Update the date when the content changes.
export const PRIVACY_UPDATED = '2026-11-09';

export function PrivacyPolicy(){
  const {t}=useLocale();
  const sections=[
    {id:'sorumlu',title:t('Veri sorumlusu'),content:<>
      <p>{t('Bu sitede işlenen kişisel verilerin sorumlusu, GDPR ve KVKK anlamında veri sorumlusu olarak aşağıdaki şirkettir:')}</p>
      <CompanyIdentity/>
      <p>{t('Gizlilikle ilgili talepleriniz için')} <a href={`mailto:${PRIVACY_EMAIL}`}><bdi dir="ltr">{PRIVACY_EMAIL}</bdi></a></p>
    </>},
    {id:'veriler',title:t('Hangi verileri işliyoruz?'),content:<ul>
      <li><strong>{t('Hesap verileri')}:</strong> {t('ad, e-posta adresi, şifrenizin geri döndürülemez özeti, hesap türü ve isteğe bağlı telefon numarası.')}</li>
      <li><strong>{t('İlan verileri')}:</strong> {t('taşınmaz bilgileri, konum, fiyat, açıklama, fotoğraflar, videolar ve sanal tur bağlantıları.')}</li>
      <li><strong>{t('İletişim verileri')}:</strong> {t('ilan sahipleriyle yazışmalarınız, randevu ve bilgi talepleriniz, iletişim formu mesajları ve bunlara verilen yanıtlar.')}</li>
      <li><strong>{t('Tercihler')}:</strong> {t('favoriler, kayıtlı aramalar, e-posta bildirim tercihleri, dil ve para birimi seçimi.')}</li>
      <li><strong>{t('Kurumsal hesaplar')}:</strong> {t('emlak ofisi veya inşaat firması adı, iletişim bilgileri ve yetki ya da faaliyet belgeleri.')}</li>
      <li><strong>{t('Hizmet firmaları')}:</strong> {t('firma adı, telefon ve WhatsApp numarası, e-posta, web sitesi, fotoğraflar, hizmet bölgeleri ve isteğe bağlı olarak yüklenen belgeler.')}</li>
      <li><strong>{t('Geri bildirimler')}:</strong> {t('öneri metniniz, bulunduğunuz sayfa, dil, ekran ve tarayıcı türü ile isteğe bağlı olarak e-posta adresiniz; IP adresiniz bu kayıtta saklanmaz.')}</li>
      <li><strong>{t('Teknik veriler')}:</strong> {t('IP adresi, istek zamanı, tarayıcı bilgileri ve güvenlik kayıtları.')}</li>
    </ul>},
    {id:'amaclar',title:t('Amaçlar ve hukuki sebepler'),content:<>
      <div className="legal-table" role="region" aria-label={t('Amaçlar ve hukuki sebepler')} tabIndex={0}><table>
        <thead><tr><th>{t('Amaç')}</th><th>{t('Hukuki sebep')}</th></tr></thead>
        <tbody>
          <tr><td>{t('Hesabın oluşturulması ve yönetimi, ilan yayımlama, mesajlaşma, randevu ve teklif talepleri')}</td><td>{t('Sözleşmenin kurulması ve ifası')}<br/><small><bdi dir="ltr">GDPR 6(1)(b) · KVKK 5(2)(c)</bdi></small></td></tr>
          <tr><td>{t('Güvenlik, kötüye kullanımın ve dolandırıcılığın önlenmesi, ilan denetimi, hizmetin iyileştirilmesi')}</td><td>{t('Meşru menfaat')}<br/><small><bdi dir="ltr">GDPR 6(1)(f) · KVKK 5(2)(f)</bdi></small></td></tr>
          <tr><td>{t('Yasal saklama ve bildirim yükümlülükleri, resmî makamların talepleri')}</td><td>{t('Hukuki yükümlülük')}<br/><small><bdi dir="ltr">{"GDPR 6(1)(c) · KVKK 5(2)(ç)"}</bdi></small></td></tr>
          <tr><td>{t('İsteğe bağlı istatistik, harici videolar ve günlük e-posta özeti')}</td><td>{t('Açık rıza / izin')}<br/><small><bdi dir="ltr">GDPR 6(1)(a) · KVKK 5(1)</bdi></small></td></tr>
        </tbody>
      </table></div>
      <p>{t('Bize e-posta gönderdiğinizde adresiniz, mesajınız ve paylaştığınız bilgiler talebinizi yanıtlamak ve ilgili işlemleri yürütmek için kullanılır. Şifre, doğrulama kodu veya gereksiz kimlik belgesi göndermeyin.')}</p>
    </>},
    {id:'giris',title:t('Üyelik ve giriş'),content:<>
      <p>{t('Giriş, e-posta adresiniz ve şifrenizle yapılır. Şifreniz yalnızca geri döndürülemez bir özet olarak saklanır. E-posta doğrulama ve şifre sıfırlama için gönderilen tek kullanımlık kodlar 15 dakika geçerlidir ve veritabanında yalnızca HMAC özeti olarak tutulur; kodun kendisi saklanmaz.')}</p>
      <p>{t('Google ile giriş isteğe bağlıdır. Bu yolu seçerseniz Google kimlik doğrulama akışı kullanılır; Google’dan alınan adınız, e-posta adresiniz ve hesap kimliğiniz hesabınızla eşleştirilir.')}</p>
      <p>{t('Telefon numaranızı doğrulamanız istenirse kod bir SMS hizmet sağlayıcısı aracılığıyla gönderilir ve yalnızca özet olarak saklanır.')}</p>
    </>},
    {id:'ilanlar',title:t('İlanlar, mesajlar ve randevular'),content:<>
      <p>{t('İlanınızda ve herkese açık profilinizde yayımladığınız bilgiler ziyaretçilerce görülebilir. Mesajlarınız, randevu ve bilgi talepleriniz yalnızca ilgili ilan sahibine veya firmaya iletilir.')}</p>
      <p>{t('Yüklenen fotoğraflar küçültülür ve konum gibi gizli dosya bilgileri silinir. Yüklenen videolar kendi sunucularımızda dönüştürülür ve fotoğraflarla birlikte saklanır.')}</p>
      <p>{t('Size gelen mesajlar, sitede seçtiğiniz dilde okuyabilmeniz için DeepL’e iletilerek otomatik çevrilir. Çeviri yalnızca mesajın alıcısına gösterilir, mesajla birlikte saklanır ve mesaj silindiğinde silinir. Orijinal metin her zaman görüntülenebilir.')}</p>
      <p>{t('İşlemsel e-postalar (giriş ve doğrulama kodları, şifre sıfırlama, bildirimler ve iletişim yanıtları) noreply@estatemarket24.com adresinden gönderilir. Günlük e-posta özeti varsayılan olarak kapalıdır; bildirimleri Hesabım’dan veya e-postadaki bağlantıyla kapatabilirsiniz.')}</p>
    </>},
    {id:'hizmetler',title:t('Hizmetler bölümü ve teklif talepleri'),content:<ul>
      <li>{t('Hizmetler bölümünde firmalar adlarını, telefon ve WhatsApp numaralarını, e-posta ve web adreslerini, fotoğraflarını ve hizmet bölgelerini yayımlar; bu bilgiler herkese açıktır.')}</li>
      <li>{t('Firmalar “Belgeli firma” rozeti için vergi levhası, ruhsat veya sigorta belgesi yükleyebilir. Bu belgeleri yalnızca yöneticiler görür; herkese açık yayımlanmaz.')}</li>
      <li>{t('Teklif istediğinizde adınız, iletişim bilgileriniz ve iş tanımınız, seçtiğiniz kategori ve bölgede hizmet veren uygun firmalara iletilir. Firmalar talebinizi yanıtlamak için bu verileri kendi sorumluluklarında işler.')}</li>
      <li>{t('Firmalar profil görüntüleme ve tıklama sayılarını yalnızca toplu istatistik olarak görür; ziyaretçilerin kimliği gösterilmez.')}</li>
    </ul>},
    {id:'otomasyon',title:t('Yapay zekâ, çeviri ve otomatik kontroller'),content:<>
      <p>{t('estateAI asistanı ve doğal dil araması, yazdığınız metni yanıt veya arama filtresi üretmek için gerektiğinde Google Gemini’ye iletir. Metin gönderilmeden önce e-posta adresleri ve telefon numaraları maskelenir; arama metni tarafımızdan saklanmaz.')}</p>
      <p>{t('İlan metinleri ve mesajlar, farklı dillerde gösterilebilmeleri için DeepL’e iletilerek çevrilir.')}</p>
      <p>{t('Sahte ve mükerrer ilanları önlemek için ilanlar kaydedilirken fotoğraf ve metin benzerliği, fiyat ve şüpheli ifadeler bakımından otomatik olarak kontrol edilir. Bu kontrol yalnızca yöneticilere uyarı üretir; ilan hakkındaki karar her zaman bir yönetici tarafından verilir. Hukuki sonuç doğuran tamamen otomatik kararlar alınmaz.')}</p>
    </>},
    {id:'saglayicilar',title:t('Barındırma ve hizmet sağlayıcılar'),content:<>
      <p>{t('Aşağıdaki sağlayıcılar, yalnızca belirtilen amaçlar için ve gerektiği ölçüde veri alır:')}</p>
      <ul className="legal-cards">
        <li><strong>Mittwald CM Service GmbH &amp; Co. KG</strong><p>{t('Espelkamp, Almanya. Sitenin ve PostgreSQL veritabanının barındırılması (adanmış konteyner barındırma) ve e-postaların gönderildiği posta sunucusu.')}</p></li>
        <li><strong>Cloudflare, Inc.</strong><p>{t('Cloudflare R2 nesne depolama: fotoğraflar, videolar, özel belgeler (ofis yetki belgeleri, firma belgeleri) ve AES-256-GCM ile şifrelenmiş günlük veritabanı yedekleri.')}</p></li>
        <li><strong>Google</strong><p>{t('Google Gemini (estateAI ve doğal dil araması), isteğe bağlı Google ile giriş ve yalnızca izninizle Google Analytics 4.')}</p></li>
        <li><strong>DeepL SE</strong><p>{t('İlan metinlerinin ve mesajların çevirisi.')}</p></li>
        <li><strong>OpenStreetMap</strong><p>{t('Harita parçaları; yalnızca bir harita açıldığında yüklenir.')}</p></li>
        <li><strong>TCMB</strong><p>{t('Döviz kurları; bu amaçla kişisel veri iletilmez.')}</p></li>
      </ul>
      <p>{t('İlan ve profilinizde yayımladığınız bilgiler ziyaretçilerce görülebilir; gönderdiğiniz mesajlar alıcısına iletilir. Kişisel verilerinizi satmayız.')}</p>
    </>},
    {id:'aktarim',title:t('Türkiye’den erişim ve uluslararası aktarımlar'),content:<>
      <p>{t('Türkiye’deki yetkili geliştirme ve destek ekibi canlı kullanıcı verilerine erişebilir. Avrupa Ekonomik Alanı dışından bu erişimin hukuki niteliği, ekibin statüsü ve veri akışına göre değerlendirilir. Erişim yetkileri ve uygulanacak aktarım güvenceleri veri sorumlusu tarafından belirlenmelidir; yürürlükte olduğu doğrulanmamış bir yeterlilik kararı veya standart sözleşme maddesi bulunduğu ileri sürülmez. Diğer hizmet sağlayıcıların uluslararası veri akışları hakkında bilgi için bize başvurabilirsiniz.')}</p>
      <p>{t('Cloudflare ve Google merkezi ABD’de olan şirketler grubuna aittir; bu sağlayıcılar üzerinden verilerin AB/AEA ve Türkiye dışına aktarılması mümkündür. Uygulanan güvenceler hakkında bilgiyi talep üzerine veririz.')}</p>
    </>},
    {id:'saklama',title:t('Saklama süreleri'),content:<>
      <ul>
        <li>{t('Hesap ve ilan verileri: hesabınız açık olduğu ve hizmet için gerektiği sürece.')}</li>
        <li>{t('Mesajlar, talepler ve doğrulama belgeleri: talebin yönetimi, olası uyuşmazlıklar ve yasal yükümlülükler gerektirdiği sürece.')}</li>
        <li>{t('E-posta kodları: 15 dakika geçerlidir; eski kod kayıtları kısa süre içinde silinir.')}</li>
        <li>{t('Şifreli veritabanı yedekleri: en fazla 30 gün; barındırma sağlayıcısının kendi yedekleri onun saklama ayarlarına tabidir.')}</li>
        <li>{t('Çerezler: Çerez politikasında belirtilen sürelerce.')}</li>
      </ul>
      <p>{t('Diğer kayıtlar için sayısal saklama süreleri veri sorumlusu tarafından ayrıca kesinleştirilecektir. Süre dolduğunda veriler silinir veya anonim hâle getirilir.')}</p>
    </>},
    {id:'guvenlik',title:t('Güvenlik'),content:<p>{t('Bağlantılar HTTPS ile şifrelenir. Şifreler ve doğrulama kodları yalnızca özet olarak saklanır, yönetici erişimi iki adımlı doğrulamayla korunur. Özel belgeler herkese açık depolamadan ayrı tutulur ve yalnızca yetkili yöneticilerce açılabilir; veritabanı yedekleri şifrelenir.')}</p>},
    {id:'odemeler',title:t('Planlanan ödemeler ve faturalama'),content:<p>{t('Ücretli ilan paketleri ve çevrimiçi ödeme şu anda etkin değildir; bu sitede kart veya ödeme işlemi verisi alınmaz. Ödeme açılmadan önce seçilen ödeme sağlayıcısı, fatura ve işlem verilerinin kapsamı, amaçları, hukuki dayanakları, saklama süreleri ve olası uluslararası aktarımları burada açıklanacaktır.')}</p>},
    {id:'harici',title:t('Harita ve harici bağlantılar'),content:<>
      <p>{t('Harita görünümü açıldığında tarayıcınız OpenStreetMap sunucularından harita parçalarını ister; IP adresiniz ve teknik istek bilgileri sağlayıcıya ulaşabilir. WhatsApp bağlantısını seçerseniz WhatsApp hizmetine yönlendirilirsiniz. Bu harici hizmetlerin kendi gizlilik politikaları geçerlidir.')}</p>
      <p>{t('Çerezler ve tarayıcıda saklanan bilgiler hakkında ayrıntılar')} <Link href="/cerez-politikasi">{t('Çerez politikası')}</Link></p>
    </>},
    {id:'haklar',title:t('Haklarınız'),content:<>
      <p>{t('Uygulanabilir mevzuat çerçevesinde aşağıdaki haklara sahipsiniz. Bazı haklar yalnızca GDPR kapsamında veya belirli koşullarda geçerlidir.')}</p>
      <LegalRights/>
      <p>{t('Başvurunuzu e-posta ile veya yazılı olarak yukarıdaki adrese iletebilirsiniz. Talepleri ücretsiz ve yasal süreler içinde (KVKK’da en geç 30 gün, GDPR’da kural olarak bir ay) yanıtlarız; kimliğinizi doğrulamak için ek bilgi isteyebiliriz. Hukuka aykırı işleme nedeniyle zarara uğrarsanız zararın giderilmesini talep etme hakkınız saklıdır.')}</p>
    </>},
    {id:'degisiklikler',title:t('Bu politikadaki değişiklikler'),content:<p>{t('Hizmetlerimiz veya mevzuat değiştiğinde bu politikayı güncelleriz. Güncel sürüm ve tarihi bu sayfada yer alır; önemli değişikliklerde sizi uygun şekilde bilgilendiririz.')}</p>},
  ];
  return <LegalPage current="/gizlilik-politikasi" title={t('Gizlilik politikası')} updated={PRIVACY_UPDATED}
    lede={t('Bu politika, estatemarket24’ü kullandığınızda hangi kişisel verileri neden işlediğimizi, kimlerle paylaştığımızı ve haklarınızı nasıl kullanabileceğinizi açıklar.')}
    summary={[
      t('Yalnızca hizmeti sunmak için gereken verileri işleriz: hesap, ilan, mesaj ve talepleriniz.'),
      t('Site ve veritabanı Almanya’da Mittwald sunucularında çalışır; fotoğraflar, belgeler ve şifreli yedekler Cloudflare R2’de saklanır.'),
      t('Reklam çerezi kullanılmaz; istatistik ve harici videolar yalnızca izninizle etkinleşir.'),
      t('Erişim, düzeltme, silme ve diğer haklarınızı bize yazarak kullanabilirsiniz.'),
    ]}
    sections={sections}>
    <LegalContactBox/>
  </LegalPage>;
}
