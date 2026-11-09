'use client';
import {CompanyIdentity} from './CompanyIdentity';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {LegalPage} from './LegalPage';

export const TERMS_UPDATED='2026-11-09';

export function TermsOfUse(){
  const {t}=useLocale();
  const sections=[
    {id:'kapsam',title:t('Kapsam ve işletmeci'),content:<>
      <p>{t('Bu kullanım koşulları estatemarket24 web sitesinin ve ilgili hizmetlerin kullanımına uygulanır. Siteyi kullanarak bu koşulları kabul etmiş olursunuz. Platform aşağıdaki şirket tarafından işletilir:')}</p>
      <CompanyIdentity/>
    </>},
    {id:'platform',title:t('Platformun niteliği'),content:<p>{t('estatemarket24, Türkiye’deki satılık ve kiralık taşınmaz ilanlarının yayımlandığı bir ilan platformudur. Taşınmaz alım-satımı veya kiralamasında taraf değiliz, emlak danışmanlığı yapmayız ve ödemelere aracılık etmeyiz. Sözleşmeler doğrudan ilan veren ile ilgilenen kişi arasında kurulur.')}</p>},
    {id:'uyelik',title:t('Üyelik ve hesap güvenliği'),content:<>
      <p>{t('İlan verme, mesajlaşma ve favoriler gibi bazı işlevler için üyelik gerekir. Doğru bilgi vermeli, şifrenizi gizli tutmalı ve hesabınızı başkasına devretmemelisiniz. Hesabınızda yetkisiz bir kullanım fark ederseniz bize hemen bildirin.')}</p>
      <p>{t('Emlak ofisleri, inşaat firmaları ve hizmet firmaları için ek doğrulama ve belge incelemesi uygulanabilir.')}</p>
    </>},
    {id:'icerik',title:t('İlanlar ve içerikler'),content:<>
      <p>{t('İlan verenler içeriklerinin doğruluğundan ve hukuka uygunluğundan sorumludur ve İlan kurallarına uymak zorundadır.')} <Link href="/ilan-kurallari">{t('İlan kuralları')}</Link></p>
      <p>{t('Yüklediğiniz metin, fotoğraf ve videoların hakları sizde kalır. Bunları platformda yayımlamamız, çevirmemiz, boyutlandırmamız ve filigran eklememiz için bize, içerik yayında kaldığı sürece ücretsiz ve basit bir kullanım hakkı tanırsınız.')}</p>
    </>},
    {id:'hizmetler',title:t('Hizmetler bölümü'),content:<p>{t('Hizmetler bölümündeki firmalar bağımsız işletmelerdir. “Belgeli firma” rozeti yalnızca firmanın belirli belgeleri yöneticilere sunduğunu gösterir; işin kalitesi veya firmanın güvenilirliği için bir garanti değildir. Teklif talepleri ilgili firmalara iletilir; teklif ve sözleşme doğrudan sizinle firma arasındadır.')}</p>},
    {id:'yasak',title:t('Yasak kullanımlar'),content:<ul>
      <li>{t('Sahte, yanıltıcı veya mükerrer ilan yayımlamak')}</li>
      <li>{t('Başkalarının verilerini izinsiz toplamak veya siteyi otomatik araçlarla toplu olarak taramak')}</li>
      <li>{t('Mesajlaşmayı istenmeyen reklam, taciz veya dolandırıcılık için kullanmak')}</li>
      <li>{t('Sitenin güvenliğini veya işleyişini bozmaya çalışmak')}</li>
    </ul>},
    {id:'denetim',title:t('Denetim ve hesap kısıtlama'),content:<p>{t('İçerikleri otomatik kontroller ve yönetici incelemesiyle denetleriz. Bu koşullara veya İlan kurallarına aykırı içerikleri kaldırabilir, hesapları geçici veya kalıcı olarak kısıtlayabiliriz. Kararlarımıza ilişkin itirazlarınızı İletişim sayfasından iletebilirsiniz.')}</p>},
    {id:'araclar',title:t('Yapay zekâ, çeviriler ve döviz kurları'),content:<p>{t('estateAI asistanı, doğal dil araması ve otomatik çeviriler yardımcı araçlardır; hatalı veya eksik sonuç verebilir. Farklı para birimlerinde gösterilen fiyatlar TCMB kurlarıyla hesaplanan yaklaşık değerlerdir. Önemli kararlarda ilan verenin bilgilerini ve resmî belgeleri esas alın.')}</p>},
    {id:'ucretler',title:t('Ücretler'),content:<p>{t('Ücretli ilan paketleri ve çevrimiçi ödeme şu anda etkin değildir. Ücretli hizmetler sunulduğunda fiyatlar ve koşullar satın almadan önce ayrıca gösterilir.')}</p>},
    {id:'sorumluluk',title:t('Sorumluluk'),content:<p>{t('Platformu özenle işletiriz ancak kesintisiz erişimi garanti edemeyiz. İlan ve firma bilgilerinin doğruluğundan bunları yayımlayanlar sorumludur. Kast, ağır ihmal, hayata, vücut bütünlüğüne veya sağlığa verilen zararlar ve kanundan doğan zorunlu sorumluluk hâllerinde sorumluluğumuz sınırlanmaz.')}</p>},
    {id:'gizlilik',title:t('Kişisel veriler'),content:<p>{t('Kişisel verilerinizin nasıl işlendiğine dair tüm ayrıntılar')} <Link href="/gizlilik-politikasi">{t('Gizlilik politikası')}</Link> · <Link href="/cerez-politikasi">{t('Çerez politikası')}</Link></p>},
    {id:'degisiklikler',title:t('Değişiklikler ve iletişim'),content:<p>{t('Bu koşulları hizmetler veya mevzuat değiştiğinde güncelleyebiliriz. Güncel sürüm bu sayfada yayımlanır; önemli değişikliklerde üyeleri uygun şekilde bilgilendiririz. Tüketiciler bakımından yaşadıkları ülkenin zorunlu tüketici koruma hükümleri saklıdır.')} <Link href="/iletisim">{t('İletişim')}</Link></p>},
  ];
  return <LegalPage current="/kullanim-kosullari" title={t('Kullanım koşulları')} updated={TERMS_UPDATED}
    lede={t('estatemarket24’ü kullanırken geçerli olan kurallar: üyelik, ilanlar, Hizmetler bölümü ve sorumluluklar.')}
    summary={[
      t('estatemarket24 bir ilan platformudur; alım-satım veya kiralamada taraf değildir.'),
      t('İlan verenler içeriklerinin doğruluğundan sorumludur ve İlan kurallarına uyar.'),
      t('Kurallara aykırı içerikler kaldırılabilir, hesaplar kısıtlanabilir.'),
      t('Ücretli paketler ve çevrimiçi ödeme şu anda etkin değildir.'),
    ]}
    sections={sections}/>;
}
