'use client';
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
    "title": "Saklama ve silme",
    "text": "Saklama gereksinimi; hizmetin devamı, talebin sonuçlandırılması, yasal yükümlülükler, güvenlik ve uyuşmazlıkların çözümüne göre değerlendirilir. E-posta talepleri için otomatik üç aylık silme taahhüdü verilmez. Yedek kopyalar, ayrı yedek saklama döngüsüne tabi olabilir. Çerezlerin belirli süreleri Çerez Politikası’nda açıklanır."
  },
  {
    "title": "Haklarınız",
    "text": "Uygulanabilir mevzuat ve koşulları kapsamında verileriniz hakkında bilgi ve erişim, düzeltme, silme, işlemeyi kısıtlama ve uygulanabildiğinde taşınabilirlik talep edebilirsiniz. Rızanızı geri alabilir ve meşru menfaate dayalı işlemeye itiraz edebilirsiniz. Yetkili denetim makamına şikâyet hakkınız saklıdır. Başvurunuzu info@exxelmedia.de adresine gönderin; kimliğinizi güvenli şekilde doğrulamak için ek bilgi istenebilir."
  }
];
export function PrivacyPolicy(){const {t,locale}=useLocale();return <main className="container cookie-policy"><header className="cookie-policy-header"><span className="market-overline">ESTATEMARKET24 · {t('Güncelleme')}: {new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date('2026-10-23T12:00:00Z'))}</span><h1>{t('Gizlilik politikası')}</h1><h2>{t('Veri sorumlusu ve iletişim')}</h2><p><strong>exxelmedia</strong><br/><a href="mailto:info@exxelmedia.de">info@exxelmedia.de</a></p></header>{sections.map((s,i)=><section key={s.title}><h2>{i+1}. {t(s.title)}</h2><p>{t(s.text)}</p></section>)}<section><h2>{t('Çerez politikası')}</h2><Link href="/cerez-politikasi">{t('Çerez politikası')}</Link></section></main>;}
