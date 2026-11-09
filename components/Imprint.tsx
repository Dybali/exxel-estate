'use client';
import {useLocale} from '@/lib/i18n';
import {CompanyIdentity} from './CompanyIdentity';
import {LegalPage} from './LegalPage';

export function Imprint(){
  const {t}=useLocale();
  const sections=[
    {id:'saglayici',title:t('Hizmet sağlayıcı'),content:<CompanyIdentity/>},
    {id:'iletisim',title:t('İletişim'),content:<p>{t('Telefon')}: <a href="tel:+498925007616"><bdi dir="ltr">+49 89 250 076 16</bdi></a><br/>{t('Faks')}: <bdi dir="ltr">+49 89 248 879 55</bdi><br/><a href="https://www.exxelmedia.de" target="_blank" rel="noopener noreferrer">www.exxelmedia.de</a></p>},
    {id:'sicil',title:t('Şirket ve sicil bilgileri'),content:<div className="legal-table"><table><tbody>
      <tr><th scope="row">{t('Merkez')}</th><td>eXXelmedia GmbH &amp; Co. KG, Feldkirchen</td></tr>
      <tr><th scope="row">{t('Ticaret sicili')}</th><td>Amtsgericht München HRA 105867</td></tr>
      <tr><th scope="row">{t('KDV kimlik numarası')}</th><td>DE309567893</td></tr>
      <tr><th scope="row">{t('Yönetici')}</th><td>Eyup Aydin</td></tr>
    </tbody></table></div>},
    {id:'hukuki',title:t('Web sitesine ilişkin hukuki açıklamalar'),content:<p>{t('Burada yayımlanan tüm metinler, görseller ve diğer bilgiler, üçüncü kişilere ait telif hakları bulunmadığı ölçüde sağlayıcının telif hakkına tabidir. Her durumda çoğaltma, dağıtma veya kamuya açık sunum yalnızca sağlayıcının geri alınabilir ve devredilemez izniyle mümkündür.')}</p>},
    {id:'ilanlar',title:t('İlan içerikleri'),content:<p>{t('İlanlar ve hizmet firması profilleri, bunları yayımlayan üyeler tarafından hazırlanır; içeriklerinin doğruluğundan ilan verenler sorumludur. Hukuka aykırı bir içerik fark ederseniz ilan sayfasındaki bildirim düğmesini kullanın veya bize yazın.')}</p>},
  ];
  return <LegalPage current="/impressum" title={t('Yasal künye')} lede={t('estatemarket24 platformunun işletmecisi ve iletişim bilgileri.')} sections={sections}/>;
}
