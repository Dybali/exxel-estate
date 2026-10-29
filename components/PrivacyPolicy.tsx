'use client';
import {CompanyIdentity} from './CompanyIdentity';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
const sections=[
  {
    "title": "İşlenen veriler ve amaçları",
    "text": "Üyelik için ad, e-posta ve hesap bilgileri; seçtiğiniz özelliklere göre telefon, şirket bilgileri ve doğrulama belgeleri işlenir. İlanlarınız, fotoğraflarınız, favorileriniz ve mesajlarınız ilgili hizmetleri sunmak ve hesabınızı yönetmek için saklanır."
  },
  {
    "title": "E-posta ile iletişim",
    "text": "Bize e-posta gönderdiğinizde adresiniz, mesajınız ve paylaştığınız bilgiler talebinizi yanıtlamak ve ilgili işlemleri yürütmek için kullanılır. Şifre, doğrulama kodu veya gereksiz kimlik belgesi göndermeyin."
  },
  {
    "title": "Hukuki sebepler",
    "text": "İşleme faaliyetleri; talep edilen hizmetin sunulması, sözleşmenin kurulması veya ifası, yasal yükümlülükler ve güvenliğin sağlanması amaçlarına dayanır. İsteğe bağlı istatistik ve harici videolar açık izninize bağlıdır. GDPR uygulanabildiği ölçüde ilgili dayanaklar Madde 6(1)(a), (b), (c) ve (f); Türkiye bakımından KVKK’daki ilgili işleme şartlarıdır."
  },
  {
    "title": "Hizmet sağlayıcılar ve paylaşım",
    "text": "Veritabanı için Neon, barındırma ve dosyalar için Cloudflare tabanlı altyapı kullanılır. estateAİ arama mesajları yanıt üretmek için Google Gemini’ye; çevirilecek ilan metinleri DeepL’e iletilir. İlan ve profilinizde yayımladığınız bilgiler ziyaretçilerce görülebilir; gönderdiğiniz mesajlar alıcısına iletilir. Harici video sağlayıcıları yalnızca ilgili izinden sonra yüklenir."
  },
  {
    "title": "Mesaj çevirisi",
    "text": "Size gelen mesajlar, sitede seçtiğiniz dilde okuyabilmeniz için DeepL’e iletilerek otomatik çevrilir. Çeviri yalnızca mesajın alıcısına gösterilir, mesajla birlikte saklanır ve mesaj silindiğinde silinir. Orijinal metin her zaman görüntülenebilir."
  },
  {
    "title": "Teknik kayıtlar ve Google ile giriş",
    "text": "Siteye erişimde IP adresi, istek zamanı ve tarayıcıya ilişkin teknik bilgiler barındırma, güvenlik ve hata incelemesi için işlenebilir. Google ile giriş seçilirse Google kimlik doğrulama akışı kullanılır; Google hesabınızdan alınan kimlik ve e-posta bilgileri hesabınızla eşleştirilir. Google ile giriş isteğe bağlıdır."
  },
  {
    "title": "Türkiye’den erişim ve uluslararası aktarımlar",
    "text": "Türkiye’deki yetkili geliştirme ve destek ekibi canlı kullanıcı verilerine erişebilir. Avrupa Ekonomik Alanı dışından bu erişimin hukuki niteliği, ekibin statüsü ve veri akışına göre değerlendirilir. Erişim yetkileri ve uygulanacak aktarım güvenceleri veri sorumlusu tarafından belirlenmelidir; yürürlükte olduğu doğrulanmamış bir yeterlilik kararı veya standart sözleşme maddesi bulunduğu ileri sürülmez. Diğer hizmet sağlayıcıların uluslararası veri akışları hakkında bilgi için bize başvurabilirsiniz."
  },
  {
    "title": "Planlanan ödemeler ve faturalama",
    "text": "Ücretli ilan paketleri ve çevrimiçi ödeme şu anda etkin değildir; bu sitede kart veya ödeme işlemi verisi alınmaz. Ödeme açılmadan önce seçilen ödeme sağlayıcısı, fatura ve işlem verilerinin kapsamı, amaçları, hukuki dayanakları, saklama süreleri ve olası uluslararası aktarımları burada açıklanacaktır."
  },
  {
    "title": "Harita ve harici bağlantılar",
    "text": "Harita görünümü açıldığında tarayıcınız OpenStreetMap sunucularından harita parçalarını ister; IP adresiniz ve teknik istek bilgileri sağlayıcıya ulaşabilir. WhatsApp bağlantısını seçerseniz WhatsApp hizmetine yönlendirilirsiniz. Bu harici hizmetlerin kendi gizlilik politikaları geçerlidir."
  },
  {
    "title": "Saklama ve silme",
    "text": "Hesap ve ilan verileri hizmetin sunulması için gerekli olduğu sürece; mesajlar ve başvurular talebin yönetimi, olası uyuşmazlıklar veya yasal yükümlülükler gerektirdiği sürece; doğrulama belgeleri yetki incelemesi ve ilgili yükümlülükler için gerekli olduğu sürece değerlendirilir. E-posta talepleri için otomatik üç aylık silme taahhüdü verilmez. Yedek kopyalar ayrı bir saklama döngüsüne tabi olabilir. Oturum çerezi 30 gün, Google giriş akışı 10 dakika, tercih kaydı 180 gün ve isteğe bağlı görüntüleme çerezi 30 gün sürer; ayrıntılar Çerez Politikası’ndadır. Diğer kayıtlar için sayısal saklama süreleri veri sorumlusu tarafından ayrıca kesinleştirilecektir."
  },
  {
    "title": "Haklarınız",
    "text": "Uygulanabilir mevzuat ve koşulları kapsamında verileriniz hakkında bilgi ve erişim, düzeltme, silme, işlemeyi kısıtlama ve uygulanabildiğinde taşınabilirlik talep edebilirsiniz. Rızanızı geri alabilir ve meşru menfaate dayalı işlemeye itiraz edebilirsiniz. Yetkili denetim makamına şikâyet hakkınız saklıdır. Başvurunuzu info@exxelmedia.de adresine gönderin; kimliğinizi güvenli şekilde doğrulamak için ek bilgi istenebilir."
  }
];
export function PrivacyPolicy(){const {t,locale}=useLocale();return <main className="container cookie-policy"><header className="cookie-policy-header"><span className="market-overline">ESTATEMARKET24 · {t('Güncelleme')}: {new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date('2026-10-29T12:00:00Z'))}</span><h1>{t('Gizlilik politikası')}</h1><h2>{t('Veri sorumlusu ve iletişim')}</h2><CompanyIdentity/></header>{sections.map((s,i)=><section key={s.title}><h2>{i+1}. {t(s.title)}</h2><p>{t(s.text)}</p></section>)}<section><h2>{t('Çerez politikası')}</h2><Link href="/cerez-politikasi">{t('Çerez politikası')}</Link></section></main>;}
