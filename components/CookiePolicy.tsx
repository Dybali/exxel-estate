'use client';
import {CompanyIdentity} from './CompanyIdentity';
import Link from '@/components/SafeLink';
import {useLocale} from '@/lib/i18n';
import {openCookiePreferences} from './CookieConsent';
import {LegalContactBox, LegalPage} from './LegalPage';

// Real cookies and browser storage of the site: lib/server.ts (excell_session), lib/google-auth.ts (exxel_google_flow),
// lib/cookie-consent.ts (em24_consent, em24_viewer), lib/display-currency.ts (em24_currency, em24:currency),
// lib/admin-totp.ts (em24_admin_2fa), components/GoogleAnalytics.tsx (_ga), lib/i18n.tsx (exxel_locale, em24_locale),
// lib/compare-client.ts, components/WhatsAppPrompt.tsx, components/NaturalSearch.tsx, components/AuthForm.tsx.
export const COOKIES_UPDATED='2026-11-11';
const COOKIES:[name:string,purpose:string,expiry:string,category:string][]=[
  ['excell_session','Güvenli üye oturumu','30 gün','Zorunlu'],
  ['exxel_google_flow','Google giriş güvenliği','10 dakika','Zorunlu'],
  ['em24_consent','İzin ve tercih kaydı','180 gün','Zorunlu'],
  ['em24_locale','Dil tercihi','1 yıl','Zorunlu'],
  ['em24_currency','Para birimi tercihi (fiyatların gösterileceği para birimi; tarayıcıda da saklanır).','1 yıl','Zorunlu'],
  ['em24_admin_2fa','Yönetici iki adımlı doğrulama onayı (yalnızca yöneticiler).','12 saat','Zorunlu'],
  ['em24_viewer','İlan görüntülemelerinin ve iletişim tıklamalarının ölçülmesi.','30 gün','İstatistik'],
  ['_ga, _ga_<ID>','Google Analytics 4 ziyaret istatistikleri (yalnızca izninizle ve etkinleştirilmişse).','2 yıl','İstatistik'],
];
const STORAGE:[name:string,purpose:string,expiry:string][]=[
  ['exxel_locale','Dil tercihi','Siz silene kadar'],
  ['em24:currency','Para birimi tercihi','Siz silene kadar'],
  ['salesorrent:compare','Karşılaştırma listesine eklediğiniz ilanlar','Siz silene kadar'],
  ['salesorrent:whatsapp-prompt:<ID>','Kapattığınız WhatsApp hatırlatması','Siz silene kadar'],
  ['em24:nl-search','Son doğal dil aramanızın sonucu','Sekme kapanana kadar'],
  ['company-invite-code','Kayıtta girilen şirket davet kodu','Sekme kapanana kadar'],
];

export function CookiePolicy(){
  const {t}=useLocale();
  const tag=(category:string)=><span className={category==='Zorunlu'?'legal-tag':'legal-tag optional'}>{t(category)}</span>;
  const sections=[
    {id:'nedir',title:t('Çerez nedir?'),content:<>
      <p>{t('Çerezler, bir web sitesinin tarayıcınızda sakladığı küçük metin dosyalarıdır. Yerel depolama da benzer şekilde bilgileri yalnızca tarayıcınızda tutar. Bu politika ikisini birlikte açıklar.')}</p>
      <p>{t('Bu sitede reklam veya pazarlama çerezi kullanılmaz. İsteğe bağlı istatistik ve harici video izinleri başlangıçta kapalıdır.')}</p>
    </>},
    {id:'kategoriler',title:t('Kategoriler'),content:<ul className="legal-cards">
      <li><strong>{t('Zorunlu')}</strong><p>{t('Oturum, güvenlik ve bu tercihlerin hatırlanması. Her zaman etkin.')}</p></li>
      <li><strong>{t('İstatistik')}</strong><p>{t('İlan görüntülemelerinin ölçülmesi ve Google Analytics ile ziyaret istatistikleri.')}</p></li>
      <li><strong>{t('Harici videolar')}</strong><p>{t('YouTube ve Vimeo videoları sağlayıcılarına veri iletebilir.')}</p></li>
    </ul>},
    {id:'envanter',title:t('Çerez envanteri'),content:<>
      <div className="legal-table" role="region" aria-label={t('Çerez envanteri')} tabIndex={0}><table>
        <thead><tr><th>{t('Ad')}</th><th>{t('Amaç')}</th><th>{t('Saklama süresi')}</th></tr></thead>
        <tbody>{COOKIES.map(([name,purpose,expiry,category])=><tr key={name}><td><code>{name}</code><br/>{tag(category)}</td><td>{t(purpose)}</td><td>{t(expiry)}</td></tr>)}</tbody>
      </table></div>
      <p>{t('Google Analytics 4 yalnızca İstatistik iznini verdiğinizde yüklenir (Google Ireland Limited). Google izin modu v2 kullanılır: reklam depolaması, reklam kişiselleştirmesi ve Google sinyalleri kapalıdır; IP adresleri Google tarafından saklanmaz. İzninizi geri aldığınızda ölçüm durur ve _ga çerezleri silinir.')}</p>
    </>},
    {id:'yerel-depolama',title:t('Yerel depolama'),content:<>
      <div className="legal-table" role="region" aria-label={t('Yerel depolama')} tabIndex={0}><table>
        <thead><tr><th>{t('Ad')}</th><th>{t('Amaç')}</th><th>{t('Saklama süresi')}</th></tr></thead>
        <tbody>{STORAGE.map(([name,purpose,expiry])=><tr key={name}><td><code>{name}</code><br/>{tag('Zorunlu')}</td><td>{t(purpose)}</td><td>{t(expiry)}</td></tr>)}</tbody>
      </table></div>
      <p>{t('Tarayıcınızdan çerezleri ve yerel depolamayı silebilirsiniz. Oturum çerezini silmek çıkış yapmanıza, tercih kaydını silmek yeniden seçim istenmesine neden olabilir.')}</p>
    </>},
    {id:'harici',title:t('Harici videolar ve haritalar'),content:<>
      <p>{t('İstatistik izni verilirse em24_viewer çerezi 30 gün saklanır. Gömülü videolar YouTube veya Vimeo tarafından sunulur; bu sağlayıcıların kendi politikaları geçerlidir. Harici bağlantılar ve harita sağlayıcıları ayrı hizmetlerdir.')}</p>
      <p>{t('İlan detayındaki OpenStreetMap haritası yalnızca Haritayı yükle düğmesine bastığınızda açılır. İlan arama haritasını seçtiğinizde harita parçaları OpenStreetMap sunucularından alınır.')}</p>
      <p><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">YouTube / Google</a> · <a href="https://vimeo.com/privacy" target="_blank" rel="noopener noreferrer">Vimeo</a> · <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">OpenStreetMap</a></p>
    </>},
    {id:'tercihler',title:t('Çerez tercihleri'),content:<>
      <p>{t('Tercihlerinizi dilediğiniz zaman sayfanın altındaki Çerez tercihleri bağlantısından değiştirebilirsiniz. Reddetmek, ilan aramayı veya üye girişini engellemez.')}</p>
      <p>{t('İzninizi aşağıdaki düğmeden geri alabilirsiniz. İstatistik iznini kaldırdığınızda em24_viewer silinir ve yeni görüntüleme ölçümü durur. Önceden oluşmuş toplu sayımlar geriye dönük silinmez.')}</p>
      <button type="button" className="legal-button" onClick={openCookiePreferences}>{t('Tercihleri düzenle')}</button>
    </>},
    {id:'sorumlu',title:t('Veri sorumlusu ve iletişim'),content:<>
      <CompanyIdentity/>
      <p>{t('Kişisel verilerinizin nasıl işlendiğine dair tüm ayrıntılar')} <Link href="/gizlilik-politikasi">{t('Gizlilik politikası')}</Link></p>
    </>},
  ];
  return <LegalPage collapsible current="/cerez-politikasi" title={t('Çerez politikası')} updated={COOKIES_UPDATED}
    lede={t('Bu sayfa, bu sitede kullanılan çerezleri ve benzer tarayıcı depolamalarını açıklar.')}
    summary={[
      t('Reklam veya pazarlama çerezi kullanılmaz.'),
      t('Zorunlu çerezler giriş, güvenlik ve tercihlerinizin hatırlanması içindir.'),
      t('İstatistik ve harici videolar yalnızca izninizle etkinleşir; izninizi her zaman geri alabilirsiniz.'),
    ]}
    sections={sections}>
    <LegalContactBox/>
  </LegalPage>;
}
